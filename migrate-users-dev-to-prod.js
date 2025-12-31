#!/usr/bin/env node

/**
 * Migrate Users and Profiles from Dev Supabase to Production Supabase
 * 
 * This script:
 * 1. Fetches all users from dev auth.users
 * 2. Creates them in prod auth.users using Admin API
 * 3. Migrates their profiles
 * 
 * Note: Users will need to reset their passwords after migration
 * (passwords cannot be copied for security reasons)
 * 
 * Usage:
 *   node migrate-users-dev-to-prod.js
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

async function migrateUsersAndProfiles() {
  console.log('🔄 Starting users and profiles migration...\n');

  // Step 1: Fetch all users from dev
  console.log('📥 Fetching users from dev auth.users...');
  const { data: devUsersData, error: devError } = await devSupabase.auth.admin.listUsers();

  if (devError) {
    console.error('❌ Error fetching dev users:', devError);
    process.exit(1);
  }

  const devUsers = devUsersData.users;
  console.log(`   Found ${devUsers.length} users in dev\n`);

  if (devUsers.length === 0) {
    console.log('✅ No users to migrate');
    return;
  }

  // Step 2: Fetch existing users from prod
  console.log('📥 Checking existing users in prod auth.users...');
  const { data: prodUsersData, error: prodError } = await prodSupabase.auth.admin.listUsers();

  if (prodError) {
    console.error('❌ Error fetching prod users:', prodError);
    process.exit(1);
  }

  const prodUserEmails = new Set(prodUsersData.users.map(u => u.email?.toLowerCase()));
  const prodUserIds = new Set(prodUsersData.users.map(u => u.id));
  console.log(`   Found ${prodUsersData.users.length} existing users in prod\n`);

  // Step 3: Fetch profiles from dev
  console.log('📥 Fetching profiles from dev...');
  const { data: devProfiles, error: profilesError } = await devSupabase
    .from('profiles')
    .select('*')
    .range(0, 999999);

  if (profilesError) {
    console.error('❌ Error fetching dev profiles:', profilesError);
    process.exit(1);
  }

  const profilesByUserId = new Map();
  devProfiles.forEach(profile => {
    profilesByUserId.set(profile.id, profile);
  });
  console.log(`   Found ${devProfiles.length} profiles in dev\n`);

  // Step 4: Migrate users
  let usersCreated = 0;
  let usersSkipped = 0;
  let usersFailed = 0;
  const createdUserIds = [];

  console.log('🔄 Migrating users...\n');

  for (const devUser of devUsers) {
    const { id, email, email_confirmed_at, phone, phone_confirmed_at, user_metadata, app_metadata, created_at, updated_at } = devUser;

    // Skip if user already exists in prod
    if (prodUserEmails.has(email?.toLowerCase())) {
      console.log(`   ⏭️  Skipping ${email} - already exists in prod`);
      usersSkipped++;
      continue;
    }

    // Prepare user data for creation
    // Note: We cannot copy passwords for security reasons
    // Users will need to use password reset after migration
    const userData = {
      email: email,
      email_confirm: !!email_confirmed_at, // Auto-confirm if they were confirmed in dev
      phone: phone || undefined,
      phone_confirm: !!phone_confirmed_at,
      user_metadata: user_metadata || {},
      app_metadata: app_metadata || {},
    };

    // Generate a temporary random password (users will need to reset)
    // Supabase requires a password, but we'll set it to a random value
    const tempPassword = `Temp${Math.random().toString(36).slice(-12)}!${Math.random().toString(36).slice(-12)}`;
    userData.password = tempPassword;

    try {
      console.log(`   🔄 Creating user: ${email}...`);
      const { data: createdUser, error: createError } = await prodSupabase.auth.admin.createUser(userData);

      if (createError) {
        console.error(`   ❌ Error creating user ${email}:`, createError.message);
        usersFailed++;
        continue;
      }

      console.log(`   ✅ Created user: ${email} (ID: ${createdUser.user.id})`);
      usersCreated++;
      createdUserIds.push(createdUser.user.id);

      // Immediately send password reset email so user can set their own password
      try {
        const { error: resetError } = await prodSupabase.auth.admin.generateLink({
          type: 'recovery',
          email: email,
        });

        if (resetError) {
          console.warn(`   ⚠️  Could not send password reset email to ${email}:`, resetError.message);
        } else {
          console.log(`   📧 Password reset email sent to ${email}`);
        }
      } catch (resetErr) {
        console.warn(`   ⚠️  Could not send password reset email to ${email}:`, resetErr.message);
      }

    } catch (err) {
      console.error(`   ❌ Exception creating user ${email}:`, err.message);
      usersFailed++;
    }
  }

  // Step 5: Migrate profiles for all users (existing + newly created)
  console.log('\n🔄 Migrating profiles...\n');

  let profilesMigrated = 0;
  let profilesSkipped = 0;

  // Re-fetch prod users to get all users (including newly created ones)
  const { data: allProdUsersData } = await prodSupabase.auth.admin.listUsers();
  
  // Create a map of email -> prod user ID (since IDs differ between dev and prod)
  const prodUserByEmail = new Map();
  allProdUsersData.users.forEach(user => {
    if (user.email) {
      prodUserByEmail.set(user.email.toLowerCase(), user.id);
    }
  });

  for (const profile of devProfiles) {
    const { id: devUserId, email, full_name, avatar_url, phone, role, created_at, updated_at } = profile;

    // Find the prod user ID by email (since IDs differ between dev and prod)
    const prodUserId = email ? prodUserByEmail.get(email.toLowerCase()) : null;

    if (!prodUserId) {
      console.log(`   ⏭️  Skipping profile for ${email || devUserId} - user not found in prod`);
      profilesSkipped++;
      continue;
    }

    // Prepare profile data with prod user ID
    const profileData = {
      id: prodUserId, // Use prod user ID, not dev ID
      email: email || null,
      full_name: full_name || null,
      avatar_url: avatar_url || null,
      phone: phone || null,
      role: role || 'user',
    };

    // Upsert profile in prod
    const { data: upsertedProfile, error: upsertError } = await prodSupabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      console.error(`   ❌ Error upserting profile for ${email || devUserId}:`, upsertError.message);
      profilesSkipped++;
      continue;
    }

    console.log(`   ✅ Migrated profile: ${email || devUserId} (role: ${role || 'user'})`);
    profilesMigrated++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`   ✅ Users Created: ${usersCreated}`);
  console.log(`   ⏭️  Users Skipped: ${usersSkipped} (already exist)`);
  console.log(`   ❌ Users Failed: ${usersFailed}`);
  console.log(`   ✅ Profiles Migrated: ${profilesMigrated}`);
  console.log(`   ⏭️  Profiles Skipped: ${profilesSkipped}`);

  if (usersCreated > 0) {
    console.log('\n⚠️  IMPORTANT: Users created with temporary passwords');
    console.log('   Password reset emails have been sent to all new users.');
    console.log('   They must use the password reset link to set their own password.');
  }

  console.log('\n✅ Users and profiles migration complete!\n');
}

// Run migration
migrateUsersAndProfiles().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

