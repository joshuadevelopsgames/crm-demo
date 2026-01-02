#!/usr/bin/env node

/**
 * Check for database constraints, triggers, or policies that might prevent contract_end from being saved
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

async function checkConstraints() {
  console.log('🔍 Checking Database Constraints and Schema\n');
  console.log('='.repeat(80));
  
  // 1. Check if contract_end column exists and its type
  console.log('\n1️⃣ Checking contract_end Column:');
  
  // Try to get column info by querying with contract_end
  const { data: testQuery, error: queryError } = await supabase
    .from('estimates')
    .select('contract_end')
    .limit(1);
  
  if (queryError) {
    if (queryError.message.includes('column') && queryError.message.includes('does not exist')) {
      console.error('   ❌ CRITICAL: contract_end column does not exist in estimates table!');
      return;
    }
    console.error('   ❌ Error querying:', queryError);
  } else {
    console.log('   ✅ contract_end column exists');
  }
  
  // 2. Check if there are any won estimates with contract_end
  console.log('\n2️⃣ Checking Current Data:');
  const { data: wonEstimates, error: countError } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, status, contract_end, contract_start')
    .eq('status', 'won')
    .limit(100);
  
  if (countError) {
    console.error('   ❌ Error:', countError);
  } else {
    const withContractEnd = wonEstimates.filter(e => e.contract_end).length;
    const withoutContractEnd = wonEstimates.filter(e => !e.contract_end).length;
    console.log(`   📊 Sample of 100 won estimates:`);
    console.log(`      With contract_end: ${withContractEnd}`);
    console.log(`      Without contract_end: ${withoutContractEnd}`);
    
    if (withContractEnd > 0) {
      console.log(`   ✅ Some estimates DO have contract_end - column works`);
      console.log(`   Sample: ${wonEstimates.find(e => e.contract_end)?.lmn_estimate_id} = ${wonEstimates.find(e => e.contract_end)?.contract_end}`);
    } else {
      console.log(`   ❌ NO estimates have contract_end`);
    }
  }
  
  // 3. Test updating an existing estimate
  console.log('\n3️⃣ Testing Update on Existing Estimate:');
  const testEstimate = wonEstimates?.find(e => !e.contract_end);
  if (!testEstimate) {
    console.log('   ⚠️  No estimate without contract_end to test');
    return;
  }
  
  console.log(`   Testing with: ${testEstimate.lmn_estimate_id || testEstimate.id}`);
  console.log(`   Current contract_end: ${testEstimate.contract_end || 'null'}`);
  
  // Try update with minimal data (like API does)
  const updateData = {
    contract_end: '2026-12-31T00:00:00Z',
    updated_at: new Date().toISOString()
  };
  
  console.log(`   Update data:`, JSON.stringify(updateData, null, 2));
  
  const { data: updateResult, error: updateError } = await supabase
    .from('estimates')
    .update(updateData)
    .eq('id', testEstimate.id)
    .select('id, contract_end')
    .single();
  
  if (updateError) {
    console.error('   ❌ Update failed:', updateError);
    console.error('   Error code:', updateError.code);
    console.error('   Error message:', updateError.message);
    console.error('   Error details:', JSON.stringify(updateError, null, 2));
  } else {
    console.log('   ✅ Update succeeded!');
    console.log('   Result:', JSON.stringify(updateResult, null, 2));
    
    // Verify it was actually saved
    const { data: verify, error: verifyError } = await supabase
      .from('estimates')
      .select('contract_end')
      .eq('id', testEstimate.id)
      .single();
    
    if (verifyError) {
      console.error('   ❌ Verification failed:', verifyError);
    } else {
      console.log(`   ✅ Verified: contract_end = ${verify.contract_end || 'null'}`);
      if (!verify.contract_end) {
        console.log('   ❌ CRITICAL: Update returned success but contract_end is still null!');
        console.log('   This indicates a database trigger or constraint is removing it.');
      }
    }
    
    // Clean up
    await supabase
      .from('estimates')
      .update({ contract_end: null })
      .eq('id', testEstimate.id);
  }
  
  // 4. Check if there's a default value or constraint
  console.log('\n4️⃣ Checking for Defaults/Constraints:');
  console.log('   (Supabase doesn\'t expose this via API, but we can infer from behavior)');
  
  // Try inserting a new estimate with contract_end
  const testInsert = {
    lmn_estimate_id: `TEST-INSERT-${Date.now()}`,
    estimate_number: `TEST-INSERT-${Date.now()}`,
    status: 'won',
    contract_end: '2027-06-30T00:00:00Z',
    contract_start: '2026-07-01T00:00:00Z',
    estimate_date: '2026-01-01T00:00:00Z',
    total_price_with_tax: 1000
  };
  
  console.log(`   Testing insert with contract_end...`);
  const { data: insertResult, error: insertError } = await supabase
    .from('estimates')
    .insert(testInsert)
    .select('id, contract_end')
    .single();
  
  if (insertError) {
    console.error('   ❌ Insert failed:', insertError);
  } else {
    console.log('   ✅ Insert succeeded!');
    console.log(`   Inserted contract_end: ${insertResult.contract_end || 'null'}`);
    
    if (!insertResult.contract_end) {
      console.log('   ❌ CRITICAL: Insert returned success but contract_end is null!');
      console.log('   This indicates a database default or trigger is removing it.');
    }
    
    // Clean up
    await supabase
      .from('estimates')
      .delete()
      .eq('id', insertResult.id);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete!');
}

checkConstraints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

