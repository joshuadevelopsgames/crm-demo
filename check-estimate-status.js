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

async function checkEstimateStatus() {
  console.log('🔍 Checking estimate statuses and contract_end dates...\n');

  try {
    // Get all estimates
    const { data: allEstimates, error: allError } = await supabase
      .from('estimates')
      .select('id, status, contract_end');

    if (allError) throw allError;

    console.log(`📋 Total estimates: ${allEstimates.length}\n`);

    // Count by status
    const byStatus = {};
    for (const est of allEstimates) {
      const status = est.status || 'null';
      if (!byStatus[status]) {
        byStatus[status] = { total: 0, withContractEnd: 0 };
      }
      byStatus[status].total++;
      if (est.contract_end) {
        byStatus[status].withContractEnd++;
      }
    }

    console.log('══════════════════════════════════════════════════');
    console.log('📊 ESTIMATE STATUS BREAKDOWN');
    console.log('══════════════════════════════════════════════════\n');

    for (const [status, counts] of Object.entries(byStatus)) {
      console.log(`${status}:`);
      console.log(`   Total: ${counts.total}`);
      console.log(`   With contract_end: ${counts.withContractEnd}`);
      console.log(`   Without contract_end: ${counts.total - counts.withContractEnd}`);
      console.log('');
    }

    // Check won estimates specifically
    const wonEstimates = allEstimates.filter(e => e.status === 'won');
    const wonWithContractEnd = wonEstimates.filter(e => e.contract_end);

    console.log('══════════════════════════════════════════════════');
    console.log('⚠️  WON ESTIMATES ANALYSIS');
    console.log('══════════════════════════════════════════════════\n');
    console.log(`Total won estimates: ${wonEstimates.length}`);
    console.log(`Won estimates with contract_end: ${wonWithContractEnd.length}`);
    console.log(`Won estimates WITHOUT contract_end: ${wonEstimates.length - wonWithContractEnd.length}`);

    if (wonEstimates.length > 0 && wonWithContractEnd.length === 0) {
      console.log('\n❌ PROBLEM IDENTIFIED:');
      console.log('   All won estimates are missing contract_end dates!');
      console.log('   This is why there are no at-risk accounts.');
      console.log('\n💡 SOLUTION:');
      console.log('   The import process needs to populate contract_end dates for won estimates.');
      console.log('   Check if the import is reading contract_end from the source data.');
    }

    // Check estimates with contract_end (any status)
    const estimatesWithContractEnd = allEstimates.filter(e => e.contract_end);
    console.log(`\n📅 Total estimates with contract_end (any status): ${estimatesWithContractEnd.length}`);

    if (estimatesWithContractEnd.length > 0 && wonWithContractEnd.length === 0) {
      console.log('\n⚠️  Some estimates have contract_end dates, but NONE of them are won status.');
      console.log('   This suggests estimates need to be marked as "won" or contract_end needs to be copied to won estimates.');
    }

  } catch (error) {
    console.error('❌ Error checking estimate status:', error);
  }
}

checkEstimateStatus();

