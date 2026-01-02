/**
 * Test script to verify Supabase can update null date fields to actual dates
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdateNullDates() {
  console.log('🧪 Testing if Supabase can update null date fields...\n');

  // Step 1: Create an estimate with null dates
  const testEstimate = {
    id: 'test-update-null-dates-' + Date.now(),
    lmn_estimate_id: 'TEST-UPDATE-NULL',
    estimate_number: 'TEST-UPDATE-NULL',
    estimate_type: 'Test',
    project_name: 'Test Update Null Dates',
    status: 'won',
    total_price: 1000,
    total_price_with_tax: 1100,
    estimate_date: null,
    estimate_close_date: null,
    contract_start: null,
    contract_end: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log('1️⃣ Creating estimate with null dates...');
  const { data: insertData, error: insertError } = await supabase
    .from('estimates')
    .insert(testEstimate)
    .select();

  if (insertError) {
    console.error('❌ INSERT failed:', insertError);
    return;
  }

  console.log('✅ Created estimate with null dates');
  console.log('   ID:', insertData[0].id);
  console.log('   estimate_date:', insertData[0].estimate_date);
  console.log('   contract_start:', insertData[0].contract_start);
  console.log('   contract_end:', insertData[0].contract_end);
  console.log('');

  // Step 2: Try updating with actual dates (simulating what happens during import)
  console.log('2️⃣ Updating estimate with actual dates...');
  const updateData = {
    estimate_date: '2025-01-15T00:00:00Z',
    estimate_close_date: '2025-01-20T00:00:00Z',
    contract_start: '2025-02-01T00:00:00Z',
    contract_end: '2025-12-31T00:00:00Z',
    updated_at: new Date().toISOString()
  };

  console.log('   Update data:', JSON.stringify(updateData, null, 2));

  const { data: updateDataResult, error: updateError } = await supabase
    .from('estimates')
    .update(updateData)
    .eq('id', insertData[0].id)
    .select();

  if (updateError) {
    console.error('❌ UPDATE failed:', updateError);
    console.error('   Code:', updateError.code);
    console.error('   Message:', updateError.message);
  } else {
    console.log('✅ UPDATE successful!');
    const updated = updateDataResult[0];
    console.log('\n   📅 Verifying updated dates:');
    console.log('      estimate_date:', updated.estimate_date, updated.estimate_date ? '✅' : '❌');
    console.log('      estimate_close_date:', updated.estimate_close_date, updated.estimate_close_date ? '✅' : '❌');
    console.log('      contract_start:', updated.contract_start, updated.contract_start ? '✅' : '❌');
    console.log('      contract_end:', updated.contract_end, updated.contract_end ? '✅' : '❌');
    
    if (!updated.estimate_date || !updated.contract_start || !updated.contract_end) {
      console.error('\n   ⚠️  WARNING: Some dates are still null after update!');
      console.error('   This suggests Supabase might not be updating null fields correctly.');
    }
  }

  console.log('');

  // Step 3: Test updating with null dates again (to see if it works both ways)
  console.log('3️⃣ Testing update back to null dates...');
  const nullUpdateData = {
    estimate_date: null,
    contract_start: null,
    contract_end: null,
    updated_at: new Date().toISOString()
  };

  const { data: nullUpdateResult, error: nullUpdateError } = await supabase
    .from('estimates')
    .update(nullUpdateData)
    .eq('id', insertData[0].id)
    .select();

  if (nullUpdateError) {
    console.error('❌ UPDATE to null failed:', nullUpdateError);
  } else {
    console.log('✅ UPDATE to null successful!');
    const nullUpdated = nullUpdateResult[0];
    console.log('   estimate_date:', nullUpdated.estimate_date);
    console.log('   contract_start:', nullUpdated.contract_start);
    console.log('   contract_end:', nullUpdated.contract_end);
  }

  // Cleanup
  console.log('\n4️⃣ Cleaning up...');
  await supabase
    .from('estimates')
    .delete()
    .eq('id', insertData[0].id);
  console.log('✅ Test estimate deleted');

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log('If UPDATE from null to dates worked, Supabase can handle null overwrites.');
  console.log('If UPDATE failed or dates stayed null, there may be an issue with how');
  console.log('Supabase handles null-to-value updates.');
}

testUpdateNullDates().catch(console.error);

