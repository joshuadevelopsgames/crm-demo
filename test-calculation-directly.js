/**
 * Test the actual calculation function with real data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function testCalculation() {
  const supabase = getSupabase();
  
  console.log('🔍 Testing actual calculation function\n');
  
  // Fetch data exactly like the cron job does
  const [accountsRes, estimatesRes, snoozesRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('archived', false),
    supabase.from('estimates').select('*').eq('archived', false),
    supabase.from('notification_snoozes').select('*')
  ]);
  
  const accounts = accountsRes.data || [];
  const estimates = estimatesRes.data || [];
  const snoozes = snoozesRes.data || [];
  
  console.log(`Fetched ${accounts.length} accounts, ${estimates.length} estimates, ${snoozes.length} snoozes\n`);
  
  // Import the calculation function
  const { calculateAtRiskAccounts } = await import('./src/utils/atRiskCalculator.js');
  
  // Run the calculation
  const result = calculateAtRiskAccounts(accounts, estimates, snoozes);
  
  console.log(`📊 Calculation Result:`);
  console.log(`  At-risk accounts: ${result.atRiskAccounts.length}`);
  console.log(`  Duplicate estimates: ${result.duplicateEstimates.length}\n`);
  
  // Check if Public Storage is in the results
  const publicStorage = result.atRiskAccounts.find(a => a.account_id === 'lmn-account-3661753');
  
  if (publicStorage) {
    console.log(`✅ Public Storage IS in results:`);
    console.log(`   Account: ${publicStorage.account_name}`);
    console.log(`   Estimate: ${publicStorage.expiring_estimate_number || publicStorage.expiring_estimate_id}`);
    console.log(`   Days until: ${publicStorage.days_until_renewal}`);
  } else {
    console.log(`❌ Public Storage is NOT in results`);
    
    // Check why
    const account = accounts.find(a => a.id === 'lmn-account-3661753');
    if (!account) {
      console.log(`   Account not found in accounts list`);
    } else if (account.archived) {
      console.log(`   Account is archived`);
    } else {
      const accountEstimates = estimates.filter(e => e.account_id === 'lmn-account-3661753');
      console.log(`   Account found, has ${accountEstimates.length} estimates`);
      
      // Check snoozes
      const accountSnoozes = snoozes.filter(s => 
        s.related_account_id === 'lmn-account-3661753' && 
        s.notification_type === 'renewal_reminder'
      );
      if (accountSnoozes.length > 0) {
        console.log(`   Account is snoozed`);
      }
    }
  }
  
  // List all at-risk account IDs
  console.log(`\n📋 All at-risk account IDs (${result.atRiskAccounts.length}):`);
  result.atRiskAccounts.forEach((acc, idx) => {
    console.log(`  ${idx + 1}. ${acc.account_name} (${acc.account_id})`);
  });
}

testCalculation().catch(console.error);


