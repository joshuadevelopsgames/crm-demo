#!/usr/bin/env node

/**
 * Test updating an existing estimate with contract_end
 * This simulates what happens during import updates
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

async function testUpdate() {
  console.log('🔍 Testing Update Path (like import does)\n');
  
  // Find a won estimate without contract_end
  const { data: testEstimate, error: findError } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, status, contract_end, contract_start')
    .eq('status', 'won')
    .is('contract_end', null)
    .limit(1)
    .single();
  
  if (findError || !testEstimate) {
    console.error('❌ Could not find test estimate:', findError);
    return;
  }
  
  console.log(`📝 Testing with estimate: ${testEstimate.lmn_estimate_id || testEstimate.id}`);
  console.log(`   Current contract_end: ${testEstimate.contract_end || 'null'}`);
  console.log(`   Current contract_start: ${testEstimate.contract_start || 'null'}`);
  
  // Simulate what the API does - create estimateData without id
  const estimateData = {
    lmn_estimate_id: testEstimate.lmn_estimate_id,
    estimate_number: testEstimate.lmn_estimate_id,
    contract_end: '2026-12-31T00:00:00Z',
    contract_start: '2025-01-01T00:00:00Z',
    updated_at: new Date().toISOString()
  };
  
  console.log('\n📤 Update data (simulating API):');
  console.log(JSON.stringify(estimateData, null, 2));
  
  // Update using the same method as the API
  const { data: updateResult, error: updateError } = await supabase
    .from('estimates')
    .update(estimateData)
    .eq('id', testEstimate.id)
    .select('id, lmn_estimate_id, contract_end, contract_start');
  
  if (updateError) {
    console.error('\n❌ Update failed:', updateError);
    console.error('Error details:', JSON.stringify(updateError, null, 2));
  } else {
    console.log('\n✅ Update successful!');
    console.log('Result:', JSON.stringify(updateResult, null, 2));
    
    // Verify it was saved
    const { data: verify, error: verifyError } = await supabase
      .from('estimates')
      .select('contract_end, contract_start')
      .eq('id', testEstimate.id)
      .single();
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log('\n✅ Verified saved values:');
      console.log(`   contract_end: ${verify.contract_end || 'null'}`);
      console.log(`   contract_start: ${verify.contract_start || 'null'}`);
    }
  }
}

testUpdate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

