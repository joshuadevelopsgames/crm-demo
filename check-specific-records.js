#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Try to load .env file if it exists (for local development)
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
} catch (e) {
  console.error('Error loading .env file:', e);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables or .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkSpecificRecords() {
  console.log('🔍 Checking for specific estimates and jobsites in database...\n');

  // Estimates to check
  const estimateIds = [
    'EST5703935',
    'EST5685587',
    'EST5492985',
    'EST5230771',
    'EST5230791'
  ];

  // Jobsites to check
  const jobsiteIds = [
    '7695461',
    '8526852',
    '3730678',
    '9703450',
    '9618131',
    '9906807',
    '6347524',
    '3948460',
    '5567721',
    '9471049',
    '7450257',
    '8561379',
    '9814225',
    '5246186',
    '6148702',
    '8629924',
    '8629925',
    '8700630'
  ];

  console.log('='.repeat(60));
  console.log('📋 CHECKING ESTIMATES');
  console.log('='.repeat(60));

  for (const estId of estimateIds) {
    // Try multiple lookup strategies
    const queries = [
      { field: 'lmn_estimate_id', value: estId },
      { field: 'lmn_estimate_id', value: estId.toUpperCase() },
      { field: 'lmn_estimate_id', value: estId.toLowerCase() },
      { field: 'estimate_number', value: estId },
      { field: 'estimate_number', value: estId.toUpperCase() },
      { field: 'estimate_number', value: estId.toLowerCase() },
      { field: 'id', value: `lmn-estimate-${estId}` },
      { field: 'id', value: `lmn-estimate-${estId.toUpperCase()}` },
      { field: 'id', value: `lmn-estimate-${estId.toLowerCase()}` }
    ];

    let found = false;
    for (const query of queries) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, account_id, status, total_price, created_at')
        .eq(query.field, query.value)
        .limit(1);

      if (error) {
        console.error(`  ❌ Error querying ${query.field}=${query.value}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        console.log(`  ✅ FOUND: ${estId}`);
        console.log(`     Found using: ${query.field} = ${query.value}`);
        console.log(`     Database record:`, {
          id: data[0].id,
          lmn_estimate_id: data[0].lmn_estimate_id,
          estimate_number: data[0].estimate_number,
          account_id: data[0].account_id,
          status: data[0].status,
          total_price: data[0].total_price,
          created_at: data[0].created_at
        });
        found = true;
        break;
      }
    }

    if (!found) {
      console.log(`  ❌ NOT FOUND: ${estId}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏗️  CHECKING JOBSITES');
  console.log('='.repeat(60));

  for (const jobsiteId of jobsiteIds) {
    // Try multiple lookup strategies
    const queries = [
      { field: 'lmn_jobsite_id', value: jobsiteId },
      { field: 'lmn_jobsite_id', value: String(jobsiteId) },
      { field: 'lmn_jobsite_id', value: parseInt(jobsiteId, 10) },
      { field: 'id', value: `lmn-jobsite-${jobsiteId}` }
    ];

    let found = false;
    for (const query of queries) {
      const { data, error } = await supabase
        .from('jobsites')
        .select('id, lmn_jobsite_id, name, account_id, created_at')
        .eq(query.field, query.value)
        .limit(1);

      if (error) {
        console.error(`  ❌ Error querying ${query.field}=${query.value}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        console.log(`  ✅ FOUND: ${jobsiteId}`);
        console.log(`     Found using: ${query.field} = ${query.value}`);
        console.log(`     Database record:`, {
          id: data[0].id,
          lmn_jobsite_id: data[0].lmn_jobsite_id,
          lmn_jobsite_idType: typeof data[0].lmn_jobsite_id,
          name: data[0].name,
          account_id: data[0].account_id,
          created_at: data[0].created_at
        });
        found = true;
        break;
      }
    }

    if (!found) {
      console.log(`  ❌ NOT FOUND: ${jobsiteId}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log('Check the output above to see which records exist in the database.');
  console.log('If records exist but are not being matched, there may be a format mismatch.');
}

checkSpecificRecords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

