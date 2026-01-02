#!/usr/bin/env node

/**
 * Test script to verify if contract_end can be saved to Supabase
 * This will help diagnose if there's a schema issue or constraint preventing saves
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
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables or .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testContractEndSave() {
  console.log('🔍 Testing contract_end Save to Supabase\n');
  console.log('='.repeat(80));
  
  // 1. Check schema
  console.log('\n1️⃣ Checking Database Schema:');
  try {
    // Get table structure
    const { data: columns, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'estimates' })
      .catch(() => ({ data: null, error: { message: 'RPC not available' } }));
    
    if (schemaError) {
      // Try alternative method - query information_schema
      console.log('   Using alternative method to check schema...');
    }
    
    // Check if contract_end column exists by trying to select it
    const { data: testSelect, error: selectError } = await supabase
      .from('estimates')
      .select('id, contract_end')
      .limit(1);
    
    if (selectError) {
      console.error('   ❌ Error selecting contract_end:', selectError);
      if (selectError.message.includes('column') && selectError.message.includes('does not exist')) {
        console.error('   ❌ CRITICAL: contract_end column does not exist in estimates table!');
        return;
      }
    } else {
      console.log('   ✅ contract_end column exists');
      console.log('   ✅ Sample contract_end value:', testSelect?.[0]?.contract_end || 'null');
    }
  } catch (err) {
    console.error('   ❌ Error checking schema:', err.message);
  }
  
  // 2. Find a won estimate without contract_end
  console.log('\n2️⃣ Finding Test Estimate:');
  const { data: testEstimates, error: findError } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, status, contract_end, contract_start')
    .eq('status', 'won')
    .is('contract_end', null)
    .limit(5);
  
  if (findError) {
    console.error('   ❌ Error finding test estimates:', findError);
    return;
  }
  
  if (!testEstimates || testEstimates.length === 0) {
    console.log('   ⚠️  No won estimates without contract_end found');
    console.log('   (This might mean contract_end is already being saved, or there are no won estimates)');
    return;
  }
  
  console.log(`   ✅ Found ${testEstimates.length} won estimates without contract_end`);
  const testEstimate = testEstimates[0];
  console.log(`   📝 Testing with: ${testEstimate.lmn_estimate_id || testEstimate.id}`);
  console.log(`      Current contract_end: ${testEstimate.contract_end || 'null'}`);
  console.log(`      Current contract_start: ${testEstimate.contract_start || 'null'}`);
  
  // 3. Test saving contract_end with different formats
  console.log('\n3️⃣ Testing contract_end Save:');
  
  const testDate = '2026-12-31T00:00:00Z'; // ISO timestamp format
  const testDate2 = '2026-12-31'; // Date only format
  
  console.log(`   Testing with ISO timestamp: ${testDate}`);
  const { data: update1, error: error1 } = await supabase
    .from('estimates')
    .update({ contract_end: testDate })
    .eq('id', testEstimate.id)
    .select('id, contract_end');
  
  if (error1) {
    console.error('   ❌ Error saving ISO timestamp:', error1);
    console.error('   Error details:', JSON.stringify(error1, null, 2));
  } else {
    console.log('   ✅ Successfully saved ISO timestamp');
    console.log('   Saved value:', update1?.[0]?.contract_end);
    
    // Try to read it back
    const { data: verify1, error: verifyError1 } = await supabase
      .from('estimates')
      .select('contract_end')
      .eq('id', testEstimate.id)
      .single();
    
    if (verifyError1) {
      console.error('   ❌ Error verifying saved value:', verifyError1);
    } else {
      console.log('   ✅ Verified saved value:', verifyError1?.contract_end || verify1?.contract_end);
    }
  }
  
  // 4. Check for constraints or triggers
  console.log('\n4️⃣ Checking for Constraints/Triggers:');
  try {
    // Try to get table info
    const { data: tableInfo, error: infoError } = await supabase
      .from('estimates')
      .select('*')
      .limit(0);
    
    if (infoError) {
      console.log('   ⚠️  Cannot check constraints directly (Supabase limitation)');
    } else {
      console.log('   ✅ Table is accessible');
    }
  } catch (err) {
    console.log('   ⚠️  Cannot check constraints:', err.message);
  }
  
  // 5. Test bulk upsert (like the import does)
  console.log('\n5️⃣ Testing Bulk Upsert (like import):');
  const testBulkData = {
    lmn_estimate_id: `TEST-${Date.now()}`,
    estimate_number: `TEST-${Date.now()}`,
    status: 'won',
    contract_end: '2027-06-30T00:00:00Z',
    contract_start: '2026-07-01T00:00:00Z',
    estimate_date: '2026-01-01T00:00:00Z',
    total_price_with_tax: 1000
  };
  
  console.log('   Test data:', JSON.stringify(testBulkData, null, 2));
  
  const { data: bulkResult, error: bulkError } = await supabase
    .from('estimates')
    .upsert([testBulkData], { 
      onConflict: 'lmn_estimate_id',
      ignoreDuplicates: false 
    })
    .select('id, lmn_estimate_id, contract_end, contract_start');
  
  if (bulkError) {
    console.error('   ❌ Error in bulk upsert:', bulkError);
    console.error('   Error details:', JSON.stringify(bulkError, null, 2));
  } else {
    console.log('   ✅ Bulk upsert successful');
    console.log('   Result:', JSON.stringify(bulkResult, null, 2));
    
    // Clean up test record
    if (bulkResult && bulkResult[0]) {
      await supabase
        .from('estimates')
        .delete()
        .eq('id', bulkResult[0].id);
      console.log('   🧹 Cleaned up test record');
    }
  }
  
  // 6. Check actual data in database
  console.log('\n6️⃣ Checking Actual Data in Database:');
  const { data: wonEstimates, error: countError } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, status, contract_end')
    .eq('status', 'won')
    .limit(100);
  
  if (countError) {
    console.error('   ❌ Error counting:', countError);
  } else {
    const withContractEnd = wonEstimates.filter(e => e.contract_end).length;
    const withoutContractEnd = wonEstimates.filter(e => !e.contract_end).length;
    console.log(`   📊 Sample of 100 won estimates:`);
    console.log(`      With contract_end: ${withContractEnd}`);
    console.log(`      Without contract_end: ${withoutContractEnd}`);
    
    if (withContractEnd > 0) {
      console.log(`   ✅ Some estimates DO have contract_end - format is working`);
      console.log(`   Sample contract_end value:`, wonEstimates.find(e => e.contract_end)?.contract_end);
    } else {
      console.log(`   ❌ NO estimates have contract_end - something is preventing saves`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test complete!');
}

testContractEndSave()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  });

