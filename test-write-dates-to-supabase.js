/**
 * Test script to verify we can write date fields to Supabase
 * Tests estimate_date, contract_start, contract_end, estimate_close_date
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWriteDates() {
  console.log('🧪 Testing date field writes to Supabase...\n');

  // Test data with all date fields
  const testEstimate = {
    id: 'test-estimate-date-write-' + Date.now(),
    lmn_estimate_id: 'TEST-DATE-WRITE',
    estimate_number: 'TEST-DATE-WRITE',
    estimate_type: 'Test',
    project_name: 'Test Date Write',
    status: 'won',
    total_price: 1000,
    total_price_with_tax: 1100,
    // Test all date fields
    estimate_date: '2025-01-15T00:00:00Z',
    estimate_close_date: '2025-01-20T00:00:00Z',
    contract_start: '2025-02-01T00:00:00Z',
    contract_end: '2025-12-31T00:00:00Z',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log('📝 Test estimate data:');
  console.log(JSON.stringify(testEstimate, null, 2));
  console.log('');

  // Test 1: Insert new estimate with all date fields
  console.log('1️⃣ Testing INSERT with all date fields...');
  const { data: insertData, error: insertError } = await supabase
    .from('estimates')
    .insert(testEstimate)
    .select();

  if (insertError) {
    console.error('❌ INSERT failed:', insertError);
    console.error('   Code:', insertError.code);
    console.error('   Message:', insertError.message);
    console.error('   Details:', insertError.details);
    console.error('   Hint:', insertError.hint);
  } else {
    console.log('✅ INSERT successful!');
    console.log('   Inserted estimate:', JSON.stringify(insertData[0], null, 2));
    
    // Verify dates were saved correctly
    const saved = insertData[0];
    console.log('\n   📅 Verifying saved dates:');
    console.log('      estimate_date:', saved.estimate_date, saved.estimate_date ? '✅' : '❌');
    console.log('      estimate_close_date:', saved.estimate_close_date, saved.estimate_close_date ? '✅' : '❌');
    console.log('      contract_start:', saved.contract_start, saved.contract_start ? '✅' : '❌');
    console.log('      contract_end:', saved.contract_end, saved.contract_end ? '✅' : '❌');
  }

  console.log('');

  // Test 2: Update existing estimate with date fields
  if (!insertError && insertData && insertData[0]) {
    console.log('2️⃣ Testing UPDATE with all date fields...');
    const updateData = {
      estimate_date: '2025-02-15T00:00:00Z',
      estimate_close_date: '2025-02-20T00:00:00Z',
      contract_start: '2025-03-01T00:00:00Z',
      contract_end: '2026-12-31T00:00:00Z',
      updated_at: new Date().toISOString()
    };

    const { data: updateDataResult, error: updateError } = await supabase
      .from('estimates')
      .update(updateData)
      .eq('id', insertData[0].id)
      .select();

    if (updateError) {
      console.error('❌ UPDATE failed:', updateError);
      console.error('   Code:', updateError.code);
      console.error('   Message:', updateError.message);
      console.error('   Details:', updateError.details);
      console.error('   Hint:', updateError.hint);
    } else {
      console.log('✅ UPDATE successful!');
      const updated = updateDataResult[0];
      console.log('\n   📅 Verifying updated dates:');
      console.log('      estimate_date:', updated.estimate_date, updated.estimate_date ? '✅' : '❌');
      console.log('      estimate_close_date:', updated.estimate_close_date, updated.estimate_close_date ? '✅' : '❌');
      console.log('      contract_start:', updated.contract_start, updated.contract_start ? '✅' : '❌');
      console.log('      contract_end:', updated.contract_end, updated.contract_end ? '✅' : '❌');
    }

    console.log('');

    // Cleanup: Delete test estimate
    console.log('3️⃣ Cleaning up test estimate...');
    const { error: deleteError } = await supabase
      .from('estimates')
      .delete()
      .eq('id', insertData[0].id);

    if (deleteError) {
      console.error('⚠️  Cleanup failed (non-critical):', deleteError.message);
    } else {
      console.log('✅ Test estimate deleted');
    }
  }

  // Test 3: Try inserting with null dates
  console.log('\n4️⃣ Testing INSERT with null date fields...');
  const testEstimateNull = {
    id: 'test-estimate-null-dates-' + Date.now(),
    lmn_estimate_id: 'TEST-NULL-DATES',
    estimate_number: 'TEST-NULL-DATES',
    estimate_type: 'Test',
    project_name: 'Test Null Dates',
    status: 'lost',
    total_price: 500,
    total_price_with_tax: 550,
    estimate_date: null,
    estimate_close_date: null,
    contract_start: null,
    contract_end: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: nullInsertData, error: nullInsertError } = await supabase
    .from('estimates')
    .insert(testEstimateNull)
    .select();

  if (nullInsertError) {
    console.error('❌ INSERT with null dates failed:', nullInsertError);
  } else {
    console.log('✅ INSERT with null dates successful!');
    
    // Cleanup
    await supabase
      .from('estimates')
      .delete()
      .eq('id', nullInsertData[0].id);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log('If all tests passed, Supabase can write date fields correctly.');
  console.log('If any test failed, check the error details above.');
  console.log('Common issues:');
  console.log('  - Column doesn\'t exist in database schema');
  console.log('  - Column type mismatch (expects timestamptz, got text)');
  console.log('  - RLS (Row Level Security) policy blocking writes');
  console.log('  - Missing permissions');
}

testWriteDates().catch(console.error);

