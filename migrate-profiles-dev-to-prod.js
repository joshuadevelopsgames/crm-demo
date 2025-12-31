#!/usr/bin/env node

/**
 * Migrate Profiles from Dev Supabase to Production Supabase
 * 
 * Profiles have a foreign key to auth.users, so we need to:
 * 1. Check if users exist in prod auth.users
 * 2. If not, we can't migrate that profile (user must sign in first)
 * 3. If yes, copy the profile data
 * 
 * Usage:
 *   node migrate-profiles-dev-to-prod.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load env
try {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^[\"']|[\"']$/g, '');
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  }
} catch (e) {}

// Dev Supabase connection
const DEV_SUPABASE_URL = process.env.DEV_SUPABASE_URL || process.env.SUPABASE_URL;
const DEV_SUPABASE_SERVICE_ROLE_KEY = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Prod Supabase connection
const PROD_SUPABASE_URL = process.env.PROD_SUPABASE_URL || process.env.SUPABASE_URL;
const PROD_SUPABASE_SERVICE_ROLE_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DEV_SUPABASE_URL || !DEV_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing dev Supabase credentials');
  console.error('   Set DEV_SUPABASE_URL and DEV_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!PROD_SUPABASE_URL || !PROD_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing prod Supabase credentials');
  console.error('   Set PROD_SUPABASE_URL and PROD_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const devSupabase = createClient(DEV_SUPABASE_URL, DEV_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const prodSupabase = createClient(PROD_SUPABASE_URL, PROD_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function migrateProfiles() {
  console.log('🔄 Starting profiles migration...\n');

  // Step 1: Fetch all profiles from dev
  console.log('📥 Fetching profiles from dev Supabase...');
  const { data: devProfiles, error: devError } = await devSupabase
    .from('profiles')
    .select('*')
    .range(0, 999999);

  if (devError) {
    console.error('❌ Error fetching dev profiles:', devError);
    process.exit(1);
  }

  console.log(`   Found ${devProfiles.length} profiles in dev\n`);

  if (devProfiles.length === 0) {
    console.log('✅ No profiles to migrate');
    return;
  }

  // Step 2: Fetch all users from prod auth.users
  console.log('📥 Fetching users from prod auth.users...');
  const { data: prodUsers, error: prodUsersError } = await prodSupabase.auth.admin.listUsers();

  if (prodUsersError) {
    console.error('❌ Error fetching prod users:', prodUsersError);
    process.exit(1);
  }

  const prodUserIds = new Set(prodUsers.users.map(u => u.id));
  console.log(`   Found ${prodUsers.users.length} users in prod\n`);

  // Step 3: Migrate profiles that have matching users in prod
  let migrated = 0;
  let skipped = 0;
  const skippedProfiles = [];

  console.log('🔄 Migrating profiles...\n');

  for (const profile of devProfiles) {
    const { id, email, full_name, avatar_url, phone, role, created_at, updated_at } = profile;

    // Check if user exists in prod
    if (!prodUserIds.has(id)) {
      console.log(`   ⏭️  Skipping profile for ${email || id} - user not found in prod auth.users`);
      skipped++;
      skippedProfiles.push({ id, email, reason: 'User not found in prod auth.users' });
      continue;
    }

    // Prepare profile data (exclude id from update data, but use it for upsert)
    const profileData = {
      id,
      email: email || null,
      full_name: full_name || null,
      avatar_url: avatar_url || null,
      phone: phone || null,
      role: role || 'user',
      // Note: We don't copy created_at/updated_at to preserve prod timestamps
    };

    // Upsert profile in prod
    const { data: upsertedProfile, error: upsertError } = await prodSupabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      console.error(`   ❌ Error upserting profile for ${email || id}:`, upsertError.message);
      skipped++;
      skippedProfiles.push({ id, email, reason: upsertError.message });
      continue;
    }

    console.log(`   ✅ Migrated profile: ${email || id} (role: ${role || 'user'})`);
    migrated++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`   ✅ Migrated: ${migrated} profiles`);
  console.log(`   ⏭️  Skipped: ${skipped} profiles`);

  if (skippedProfiles.length > 0) {
    console.log('\n⚠️  Skipped Profiles:');
    skippedProfiles.forEach(p => {
      console.log(`   - ${p.email || p.id}: ${p.reason}`);
    });
    console.log('\n💡 Note: Skipped profiles are for users that don\'t exist in prod auth.users.');
    console.log('   These users need to sign in to prod first, then their profiles will be auto-created.');
  }

  console.log('\n✅ Profiles migration complete!\n');
}

// Run migration
migrateProfiles().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

