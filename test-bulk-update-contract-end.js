#!/usr/bin/env node

/**
 * Test bulk update to see if contract_end can be updated on existing estimates
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

async function testBulkUpdate() {
  console.log('🔍 Testing Bulk Update (like import does)\n');
  
  // Find 5 won estimates without contract_end
  const { data: testEstimates, error: findError } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, status, contract_end')
    .eq('status', 'won')
    .is('contract_end', null)
    .limit(5);
  
  if (findError || !testEstimates || testEstimates.length === 0) {
    console.error('❌ Could not find test estimates:', findError);
    return;
  }
  
  console.log(`📝 Found ${testEstimates.length} test estimates\n`);
  
  // Simulate what the API does - create updateData objects
  const toUpdate = testEstimates.map(est => {
    // Simulate estimateData from API (after all transformations)
    const estimateData = {
      lmn_estimate_id: est.lmn_estimate_id,
      estimate_number: est.lmn_estimate_id,
      contract_end: '2026-12-31T00:00:00Z', // Test value
      contract_start: '2025-01-01T00:00:00Z',
      updated_at: new Date().toISOString()
    };
    
    return {
      id: est.id,
      data: estimateData
    };
  });
  
  console.log('📤 Update data (first estimate):');
  console.log(JSON.stringify(toUpdate[0], null, 2));
  
  // Test bulk update (like the API does)
  console.log('\n🔄 Executing bulk update...');
  const updatePromises = toUpdate.map(({ id, data: updateData }) =>
    supabase
      .from('estimates')
      .update(updateData)
      .eq('id', id)
      .then(({ data, error }) => {
        if (error) {
          console.error(`❌ Update error for ${id}:`, error);
          return { success: false, error };
        }
        return { success: true, data };
      })
  );
  
  const results = await Promise.all(updatePromises);
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;
  
  console.log(`\n📊 Results: ${successCount} succeeded, ${errorCount} failed`);
  
  // Verify the updates
  console.log('\n🔍 Verifying updates...');
  const { data: updatedEstimates, error: verifyError } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, contract_end, contract_start')
    .in('id', testEstimates.map(e => e.id));
  
  if (verifyError) {
    console.error('❌ Verification error:', verifyError);
  } else {
    console.log(`\n✅ Verification results:`);
    updatedEstimates.forEach(est => {
      const hasContractEnd = !!est.contract_end;
      console.log(`   ${est.lmn_estimate_id}: contract_end = ${est.contract_end || 'null'} ${hasContractEnd ? '✅' : '❌'}`);
    });
    
    const withContractEnd = updatedEstimates.filter(e => e.contract_end).length;
    console.log(`\n   Summary: ${withContractEnd}/${updatedEstimates.length} now have contract_end`);
    
    if (withContractEnd === 0) {
      console.log(`\n   ❌ CRITICAL: Updates executed but contract_end was NOT saved!`);
      console.log(`   This indicates a database constraint or trigger issue.`);
    }
  }
  
  // Clean up - restore null values
  console.log('\n🧹 Cleaning up test data...');
  const cleanupPromises = testEstimates.map(est =>
    supabase
      .from('estimates')
      .update({ contract_end: null, contract_start: null })
      .eq('id', est.id)
  );
  await Promise.all(cleanupPromises);
  console.log('✅ Cleanup complete');
}

testBulkUpdate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

