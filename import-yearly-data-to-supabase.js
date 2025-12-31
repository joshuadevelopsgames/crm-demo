#!/usr/bin/env node

/**
 * Import Yearly Official Data to Supabase
 * 
 * Imports the yearly official data from JSON file into Supabase table.
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function importToSupabase() {
  console.log('📥 Importing Yearly Official Data to Supabase\n');
  console.log('='.repeat(60) + '\n');

  // Read the JSON file
  const jsonPath = join(process.cwd(), 'yearly_official_data.json');
  if (!existsSync(jsonPath)) {
    console.error('❌ yearly_official_data.json not found. Run import-yearly-exports.js first.');
    process.exit(1);
  }

  const yearlyData = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  console.log(`📖 Loaded data for years: ${Object.keys(yearlyData).sort().join(', ')}\n`);

  // First, clear existing data (fresh import)
  console.log('🗑️  Clearing existing yearly official data...\n');
  const { error: deleteError } = await supabase
    .from('yearly_official_estimates')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (this condition is always true)

  if (deleteError) {
    console.error('⚠️  Error clearing existing data (table may not exist yet):', deleteError.message);
    console.log('   This is okay if this is the first import.\n');
  } else {
    console.log('✅ Cleared existing data\n');
  }

  // Import data for each year
  let totalImported = 0;
  const years = Object.keys(yearlyData).sort();

  for (const year of years) {
    const estimates = yearlyData[year];
    console.log(`📥 Importing ${year} (${estimates.length} estimates)...`);

    // Prepare data for insertion
    const records = estimates.map(est => ({
      lmn_estimate_id: est.lmn_estimate_id,
      status: est.status || null,
      total_price: est.total_price || null,
      estimate_close_date: est.estimate_close_date || null,
      division: est.division || null,
      source_year: parseInt(year),
      source_file: est.source_file || null,
      is_official_lmn_data: true,
    }));

    // Insert in batches of 500 (Supabase limit)
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('yearly_official_estimates')
        .upsert(batch, {
          onConflict: 'lmn_estimate_id,source_year',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error(`   ❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      } else {
        console.log(`   ✅ Imported batch ${Math.floor(i / batchSize) + 1} (${batch.length} estimates)`);
        totalImported += batch.length;
      }
    }

    console.log(`   ✅ Completed ${year}: ${estimates.length} estimates\n`);
  }

  console.log('='.repeat(60));
  console.log('📊 Summary\n');
  console.log(`   Total estimates imported: ${totalImported}`);
  console.log(`   Years: ${years.join(', ')}\n`);

  // Verify import
  console.log('🔍 Verifying import...\n');
  for (const year of years) {
    const { count, error } = await supabase
      .from('yearly_official_estimates')
      .select('*', { count: 'exact', head: true })
      .eq('source_year', parseInt(year));

    if (error) {
      console.error(`   ❌ Error verifying ${year}:`, error.message);
    } else {
      console.log(`   ${year}: ${count} estimates in database`);
    }
  }

  console.log('\n✅ Import complete!\n');
}

importToSupabase();

