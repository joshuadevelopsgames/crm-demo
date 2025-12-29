#!/usr/bin/env node

/**
 * Purge all interactions imported from Monday activities
 * This will delete all interactions with metadata->>imported_from = 'monday_activities'
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

async function purgeMondayActivities() {
  console.log('🗑️  Purging all Monday activities interactions...\n');
  
  try {
    // First, count how many interactions we're about to delete
    const { count, error: countError } = await supabase
      .from('interactions')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>imported_from', 'monday_activities');
    
    if (countError) {
      console.error('❌ Error counting interactions:', countError);
      return;
    }
    
    console.log(`📊 Found ${count} interactions to delete\n`);
    
    if (count === 0) {
      console.log('✅ No Monday activities interactions found. Nothing to purge.');
      return;
    }
    
    // Delete all interactions imported from Monday activities
    const { data, error } = await supabase
      .from('interactions')
      .delete()
      .eq('metadata->>imported_from', 'monday_activities')
      .select('id');
    
    if (error) {
      console.error('❌ Error deleting interactions:', error);
      return;
    }
    
    console.log(`✅ Successfully deleted ${data?.length || 0} interactions`);
    console.log('\n✨ Purge complete! You can now re-import the Monday activities data.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

purgeMondayActivities();

