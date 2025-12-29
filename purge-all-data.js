#!/usr/bin/env node

/**
 * Purge ALL data from the CRM system
 * This will delete:
 * - All accounts
 * - All contacts
 * - All tasks and related data (attachments, comments)
 * - All sequences and enrollments
 * - All interactions
 * - All estimates
 * - All jobsites
 * - All scorecard responses
 * - All notifications
 * 
 * NOTE: This does NOT delete:
 * - User profiles (authentication data)
 * - User permissions
 * - Scorecard templates (system templates)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function countTable(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error(`  ⚠️  Error counting ${tableName}:`, error.message);
    return 0;
  }
  return count || 0;
}

async function deleteTable(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (this condition is always true)
    .select('id');
  
  if (error) {
    console.error(`  ❌ Error deleting from ${tableName}:`, error.message);
    return 0;
  }
  return data?.length || 0;
}

async function purgeAllData() {
  console.log('🗑️  Purging ALL data from CRM system...\n');
  console.log('⚠️  WARNING: This will delete ALL accounts, contacts, tasks, sequences, interactions, estimates, jobsites, and more!\n');
  
  const results = {};
  
  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete child records first (those with foreign keys)
    console.log('📋 Step 1: Deleting child records...\n');
    
    const childTables = [
      'task_attachments',
      'task_comments',
      'notification_snoozes',
      'notifications',
      'interactions',
      'scorecard_responses',
      'sequence_enrollments',
      'tasks',
    ];
    
    for (const table of childTables) {
      const count = await countTable(table);
      if (count > 0) {
        console.log(`  Deleting ${count} records from ${table}...`);
        const deleted = await deleteTable(table);
        results[table] = deleted;
        console.log(`  ✅ Deleted ${deleted} records from ${table}\n`);
      } else {
        console.log(`  ⏭️  ${table} is already empty\n`);
        results[table] = 0;
      }
    }
    
    // 2. Delete records that reference accounts/contacts
    console.log('📋 Step 2: Deleting records with account/contact references...\n');
    
    const referenceTables = [
      'contacts',  // References accounts
      'estimates', // References accounts and contacts
      'jobsites',  // References accounts and contacts
    ];
    
    for (const table of referenceTables) {
      const count = await countTable(table);
      if (count > 0) {
        console.log(`  Deleting ${count} records from ${table}...`);
        const deleted = await deleteTable(table);
        results[table] = deleted;
        console.log(`  ✅ Deleted ${deleted} records from ${table}\n`);
      } else {
        console.log(`  ⏭️  ${table} is already empty\n`);
        results[table] = 0;
      }
    }
    
    // 3. Delete parent records
    console.log('📋 Step 3: Deleting parent records...\n');
    
    const parentTables = [
      'accounts',
      'sequences',
    ];
    
    for (const table of parentTables) {
      const count = await countTable(table);
      if (count > 0) {
        console.log(`  Deleting ${count} records from ${table}...`);
        const deleted = await deleteTable(table);
        results[table] = deleted;
        console.log(`  ✅ Deleted ${deleted} records from ${table}\n`);
      } else {
        console.log(`  ⏭️  ${table} is already empty\n`);
        results[table] = 0;
      }
    }
    
    // Summary
    console.log('\n📊 Purge Summary:');
    console.log('═'.repeat(50));
    let totalDeleted = 0;
    for (const [table, count] of Object.entries(results)) {
      if (count > 0) {
        console.log(`  ${table.padEnd(30)} ${count.toString().padStart(10)} records`);
        totalDeleted += count;
      }
    }
    console.log('═'.repeat(50));
    console.log(`  ${'TOTAL'.padEnd(30)} ${totalDeleted.toString().padStart(10)} records`);
    console.log('\n✨ Purge complete! All data has been deleted.');
    console.log('\n📝 Note: User profiles, permissions, and scorecard templates were NOT deleted.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

purgeAllData();

