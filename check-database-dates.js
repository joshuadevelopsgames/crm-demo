#!/usr/bin/env node

/**
 * Check if estimates have dates in the database
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
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
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkDatabaseDates() {
  console.log('🔍 Checking Dates in Database\n');
  console.log('='.repeat(80));
  
  // Estimates from screenshot
  const problemEstimates = [
    'EST1053033',
    'EST1053051',
    'EST1343721',
    'EST1869281'
  ];
  
  console.log('📋 Checking Problem Estimates in Database:');
  
  for (const estimateId of problemEstimates) {
    const { data, error } = await supabase
      .from('estimates')
      .select('id, lmn_estimate_id, estimate_date, contract_start, contract_end, status, total_price_with_tax')
      .eq('lmn_estimate_id', estimateId)
      .single();
    
    if (error) {
      console.log(`\n   ❌ ${estimateId}: Not found in database`);
      continue;
    }
    
    console.log(`\n   📝 ${estimateId}:`);
    console.log(`      ID: ${data.id}`);
    console.log(`      Status: ${data.status || 'N/A'}`);
    console.log(`      Total Price: ${data.total_price_with_tax || 'N/A'}`);
    console.log(`      estimate_date: ${data.estimate_date || 'null'} (type: ${typeof data.estimate_date})`);
    console.log(`      contract_start: ${data.contract_start || 'null'} (type: ${typeof data.contract_start})`);
    console.log(`      contract_end: ${data.contract_end || 'null'} (type: ${typeof data.contract_end})`);
    
    // Test if dates can be parsed
    const estimateDateParsed = data.estimate_date ? new Date(data.estimate_date) : null;
    const contractStartParsed = data.contract_start ? new Date(data.contract_start) : null;
    const contractEndParsed = data.contract_end ? new Date(data.contract_end) : null;
    
    console.log(`      estimate_date parsed: ${estimateDateParsed && !isNaN(estimateDateParsed.getTime()) ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`      contract_start parsed: ${contractStartParsed && !isNaN(contractStartParsed.getTime()) ? '✅ Valid' : '❌ Invalid'}`);
    console.log(`      contract_end parsed: ${contractEndParsed && !isNaN(contractEndParsed.getTime()) ? '✅ Valid' : '❌ Invalid'}`);
    
    // Test getEstimateYearData logic
    const hasAnyDate = !!(data.estimate_date || data.contract_start || data.contract_end);
    const canParseAnyDate = !!(estimateDateParsed && !isNaN(estimateDateParsed.getTime())) ||
                            !!(contractStartParsed && !isNaN(contractStartParsed.getTime())) ||
                            !!(contractEndParsed && !isNaN(contractEndParsed.getTime()));
    
    console.log(`      Has any date in DB: ${hasAnyDate ? '✅' : '❌'}`);
    console.log(`      Can parse any date: ${canParseAnyDate ? '✅' : '❌'}`);
    
    if (hasAnyDate && !canParseAnyDate) {
      console.log(`      ⚠️  ISSUE: Dates exist but cannot be parsed!`);
      console.log(`         This means dates are in an invalid format in the database.`);
    } else if (!hasAnyDate) {
      console.log(`      ⚠️  ISSUE: No dates in database at all!`);
      console.log(`         Dates were not saved during import.`);
    }
  }
  
  // Check overall statistics
  console.log('\n📊 Overall Statistics:');
  const { data: allEstimates, error: statsError } = await supabase
    .from('estimates')
    .select('estimate_date, contract_start, contract_end, total_price_with_tax')
    .limit(1000);
  
  if (statsError) {
    console.error('❌ Error fetching statistics:', statsError);
  } else {
    let withEstimateDate = 0;
    let withContractStart = 0;
    let withContractEnd = 0;
    let withAnyDate = 0;
    let withoutAnyDate = 0;
    let canParseEstimateDate = 0;
    let canParseContractStart = 0;
    let canParseContractEnd = 0;
    
    allEstimates.forEach(est => {
      if (est.estimate_date) {
        withEstimateDate++;
        const parsed = new Date(est.estimate_date);
        if (!isNaN(parsed.getTime())) canParseEstimateDate++;
      }
      if (est.contract_start) {
        withContractStart++;
        const parsed = new Date(est.contract_start);
        if (!isNaN(parsed.getTime())) canParseContractStart++;
      }
      if (est.contract_end) {
        withContractEnd++;
        const parsed = new Date(est.contract_end);
        if (!isNaN(parsed.getTime())) canParseContractEnd++;
      }
      
      if (est.estimate_date || est.contract_start || est.contract_end) {
        withAnyDate++;
      } else {
        withoutAnyDate++;
      }
    });
    
    console.log(`   Total estimates checked: ${allEstimates.length}`);
    console.log(`   With estimate_date: ${withEstimateDate} (${(withEstimateDate/allEstimates.length*100).toFixed(1)}%)`);
    console.log(`   With contract_start: ${withContractStart} (${(withContractStart/allEstimates.length*100).toFixed(1)}%)`);
    console.log(`   With contract_end: ${withContractEnd} (${(withContractEnd/allEstimates.length*100).toFixed(1)}%)`);
    console.log(`   With any date: ${withAnyDate} (${(withAnyDate/allEstimates.length*100).toFixed(1)}%)`);
    console.log(`   Without any date: ${withoutAnyDate} (${(withoutAnyDate/allEstimates.length*100).toFixed(1)}%)`);
    console.log(`\n   Can parse estimate_date: ${canParseEstimateDate}/${withEstimateDate} (${withEstimateDate > 0 ? (canParseEstimateDate/withEstimateDate*100).toFixed(1) : 0}%)`);
    console.log(`   Can parse contract_start: ${canParseContractStart}/${withContractStart} (${withContractStart > 0 ? (canParseContractStart/withContractStart*100).toFixed(1) : 0}%)`);
    console.log(`   Can parse contract_end: ${canParseContractEnd}/${withContractEnd} (${withContractEnd > 0 ? (canParseContractEnd/withContractEnd*100).toFixed(1) : 0}%)`);
    
    if (canParseEstimateDate < withEstimateDate) {
      console.log(`\n   ⚠️  Some estimate_date values cannot be parsed!`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete!');
}

checkDatabaseDates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  });

