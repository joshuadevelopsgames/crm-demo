#!/usr/bin/env node

/**
 * Migrate Data from Dev Supabase to Production Supabase
 * 
 * This script copies all data from your dev Supabase instance to production.
 * It handles foreign key relationships by migrating tables in the correct order.
 * 
 * Usage:
 *   1. Set environment variables for both dev and prod:
 *      export DEV_SUPABASE_URL="https://your-dev-project.supabase.co"
 *      export DEV_SUPABASE_SERVICE_ROLE_KEY="your-dev-service-role-key"
 *      export PROD_SUPABASE_URL="https://your-prod-project.supabase.co"
 *      export PROD_SUPABASE_SERVICE_ROLE_KEY="your-prod-service-role-key"
 * 
 *   2. Run: node migrate-data-dev-to-prod.js
 * 
 * Or create a .env file with these variables.
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

// Dev Supabase connection (fallback to regular SUPABASE_ vars if DEV_ not set)
const DEV_SUPABASE_URL = process.env.DEV_SUPABASE_URL || process.env.SUPABASE_URL;
const DEV_SUPABASE_SERVICE_ROLE_KEY = process.env.DEV_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Prod Supabase connection (fallback to regular SUPABASE_ vars if PROD_ not set)
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

// Migration order: tables must be migrated in this order due to foreign keys
const MIGRATION_ORDER = [
  // Core tables (no dependencies)
  'accounts',
  // 'profiles', // Skip - requires auth.users to exist first, will be created automatically on sign-in
  
  // Depend on accounts
  'contacts',
  'interactions',
  'jobsites',
  'sequence_enrollments',
  'scorecard_responses',
  'account_attachments',
  
  // Depend on accounts and contacts
  'estimates',
  'tasks',
  
  // Depend on tasks
  'task_attachments',
  'task_comments',
  
  // Depend on profiles
  'user_permissions',
  'user_notification_states',
  
  // Depend on accounts (for notifications)
  'notifications',
  'notification_snoozes',
  
  // Independent
  'sequences',
  'scorecard_templates',
  'yearly_official_estimates',
];

// Tables to skip (auth tables, system tables, etc.)
const SKIP_TABLES = [
  'auth.users',
  'auth.sessions',
  'auth.refresh_tokens',
  'storage.objects',
  'storage.buckets',
  'profiles', // Skip - requires auth.users to exist first, will be created automatically on sign-in
];

async function getTableCount(supabase, tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error(`   ⚠️  Error counting ${tableName}:`, error.message);
    return 0;
  }
  return count || 0;
}

async function migrateTable(tableName) {
  console.log(`\n📦 Migrating ${tableName}...`);
  
  // Check if table exists in dev
  // Use range() to get all rows (Supabase defaults to 1000 row limit)
  const { data: devData, error: devError } = await devSupabase
    .from(tableName)
    .select('*', { count: 'exact' })
    .range(0, 999999); // Get all rows
  
  if (devError) {
    console.error(`   ❌ Error reading from dev: ${devError.message}`);
    return { success: false, count: 0 };
  }
  
  if (!devData || devData.length === 0) {
    console.log(`   ⏭️  No data to migrate (table is empty)`);
    return { success: true, count: 0 };
  }
  
  console.log(`   📊 Found ${devData.length} rows in dev`);
  
  // For profiles table, temporarily disable foreign key constraint
  let fkDisabled = false;
  if (tableName === 'profiles') {
    console.log(`   🔓 Temporarily disabling foreign key constraint...`);
    const { error: disableError } = await prodSupabase.rpc('exec_sql', {
      sql: 'ALTER TABLE profiles DISABLE TRIGGER ALL;'
    }).catch(async () => {
      // If RPC doesn't work, try direct SQL via query
      // Note: This requires service role key which bypasses RLS
      return { error: null };
    });
    
    // Alternative: Use raw SQL query if RPC doesn't work
    // We'll handle the constraint by using INSERT with ON CONFLICT DO NOTHING
    fkDisabled = true;
  }
  
  // Clear existing data in prod (optional - comment out if you want to merge)
  console.log(`   🗑️  Clearing existing data in prod...`);
  const { error: deleteError } = await prodSupabase
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (deleteError && !deleteError.message.includes('does not exist')) {
    console.error(`   ⚠️  Error clearing prod data: ${deleteError.message}`);
    // Continue anyway - table might not exist yet
  }
  
  // Insert data in batches (Supabase has limits)
  // Use smaller batch size for notifications to avoid hitting limits
  const BATCH_SIZE = tableName === 'notifications' ? 500 : 1000;
  let totalInserted = 0;
  let totalErrors = 0;
  
  for (let i = 0; i < devData.length; i += BATCH_SIZE) {
    const batch = devData.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(devData.length / BATCH_SIZE);
    
    console.log(`   📤 Inserting batch ${batchNum}/${totalBatches} (${batch.length} rows)...`);
    
    const { data: insertedData, error: insertError } = await prodSupabase
      .from(tableName)
      .insert(batch)
      .select();
    
    if (insertError) {
      console.error(`   ❌ Error inserting batch ${batchNum}:`, insertError.message);
      totalErrors += batch.length;
      
      // Try inserting one by one to identify problematic rows
      if (batch.length > 1) {
        console.log(`   🔍 Trying individual inserts for batch ${batchNum}...`);
        for (const row of batch) {
          const { error: singleError } = await prodSupabase
            .from(tableName)
            .insert(row);
          
          if (singleError) {
            console.error(`      ❌ Failed: ${JSON.stringify(row).substring(0, 100)}...`);
            console.error(`         Error: ${singleError.message}`);
          } else {
            totalInserted++;
          }
        }
      }
    } else {
      totalInserted += insertedData?.length || batch.length;
      console.log(`   ✅ Inserted ${insertedData?.length || batch.length} rows`);
    }
  }
  
  // Verify
  const prodCount = await getTableCount(prodSupabase, tableName);
  const devCount = await getTableCount(devSupabase, tableName);
  
  if (prodCount === devCount) {
    console.log(`   ✅ Success! ${prodCount} rows migrated`);
    return { success: true, count: prodCount };
  } else {
    console.log(`   ⚠️  Count mismatch: dev=${devCount}, prod=${prodCount}`);
    return { success: false, count: prodCount };
  }
}

async function main() {
  console.log('🚀 Starting Data Migration: Dev → Production\n');
  console.log('='.repeat(60));
  console.log(`Dev:  ${DEV_SUPABASE_URL}`);
  console.log(`Prod: ${PROD_SUPABASE_URL}`);
  console.log('='.repeat(60));
  
  // Confirm before proceeding
  console.log('\n⚠️  This will:');
  console.log('   1. Read all data from dev Supabase');
  console.log('   2. Clear existing data in prod Supabase (for each table)');
  console.log('   3. Insert all data into prod Supabase');
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const results = {};
  let totalTables = 0;
  let successfulTables = 0;
  let totalRows = 0;
  
  for (const tableName of MIGRATION_ORDER) {
    if (SKIP_TABLES.includes(tableName)) {
      console.log(`\n⏭️  Skipping ${tableName} (system table)`);
      continue;
    }
    
    totalTables++;
    const result = await migrateTable(tableName);
    results[tableName] = result;
    
    if (result.success) {
      successfulTables++;
      totalRows += result.count;
    }
    
    // Small delay between tables to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`Tables processed: ${totalTables}`);
  console.log(`Successful: ${successfulTables}`);
  console.log(`Failed: ${totalTables - successfulTables}`);
  console.log(`Total rows migrated: ${totalRows.toLocaleString()}`);
  console.log('\n📋 Per-table results:');
  
  for (const [table, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${table}: ${result.count} rows`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Migration complete!');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

