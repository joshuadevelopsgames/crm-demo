/**
 * Debug script to check why there are 0 at-risk accounts
 * This will help identify if:
 * 1. All renewals are past due (excluded per R6a)
 * 2. No accounts have renewals in 0-180 day window
 * 3. Cache needs refreshing
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { startOfDay, differenceInDays } from 'date-fns';

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
  console.error('❌ Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function debugAtRiskAccounts() {
  console.log('🔍 Debugging At-Risk Accounts...\n');

  try {
    // 1. Check won estimates with contract_end
    const { data: estimates, error: estError } = await supabase
      .from('estimates')
      .select('id, account_id, status, contract_end, division, address')
      .eq('archived', false)
      .in('status', ['won', 'Contract Signed', 'Work Complete']);

    if (estError) throw estError;

    console.log(`📊 Total estimates: ${estimates.length}`);
    
    const wonEstimates = estimates.filter(e => 
      ['won', 'Contract Signed', 'Work Complete'].includes(e.status?.toLowerCase())
    );
    console.log(`   Won estimates: ${wonEstimates.length}`);

    const withContractEnd = wonEstimates.filter(e => e.contract_end);
    console.log(`   Won estimates with contract_end: ${withContractEnd.length}`);

    if (withContractEnd.length === 0) {
      console.log('\n❌ No won estimates with contract_end dates!');
      console.log('   This is why there are 0 at-risk accounts.');
      return;
    }

    // 2. Check accounts
    const { data: accounts, error: accError } = await supabase
      .from('accounts')
      .select('id, name, archived')
      .eq('archived', false);

    if (accError) throw accError;
    console.log(`\n📊 Total non-archived accounts: ${accounts.length}`);

    // 3. Categorize renewals
    const today = startOfDay(new Date());
    const withinWindow = []; // 0-180 days
    const pastDue = []; // < 0 days
    const tooFar = []; // > 180 days

    withContractEnd.forEach(est => {
      try {
        const renewalDate = startOfDay(new Date(est.contract_end));
        if (isNaN(renewalDate.getTime())) return;
        
        const daysUntil = differenceInDays(renewalDate, today);
        
        if (daysUntil >= 0 && daysUntil <= 180) {
          withinWindow.push({ est, daysUntil });
        } else if (daysUntil < 0) {
          pastDue.push({ est, daysUntil });
        } else {
          tooFar.push({ est, daysUntil });
        }
      } catch (error) {
        console.error(`Error processing estimate ${est.id}:`, error);
      }
    });

    console.log(`\n📅 Renewal Date Analysis:`);
    console.log(`   Within 0-180 days (should be at-risk): ${withinWindow.length}`);
    console.log(`   Past due (< 0 days, excluded per R6a): ${pastDue.length}`);
    console.log(`   Too far (> 180 days): ${tooFar.length}`);

    if (withinWindow.length > 0) {
      console.log(`\n✅ Found ${withinWindow.length} estimates that SHOULD be at-risk:`);
      const accountMap = new Map();
      
      withinWindow.forEach(({ est, daysUntil }) => {
        if (!accountMap.has(est.account_id)) {
          accountMap.set(est.account_id, []);
        }
        accountMap.get(est.account_id).push({ est, daysUntil });
      });

      console.log(`\n   Accounts with at-risk estimates: ${accountMap.size}`);
      console.log(`\n   Sample accounts (first 10):`);
      
      let count = 0;
      for (const [accountId, estimates] of accountMap.entries()) {
        if (count >= 10) break;
        const account = accounts.find(a => a.id === accountId);
        const soonest = estimates.sort((a, b) => a.daysUntil - b.daysUntil)[0];
        console.log(`     - ${account?.name || accountId}: ${soonest.daysUntil} days (${soonest.est.contract_end})`);
        count++;
      }
    } else {
      console.log(`\n⚠️  No estimates in 0-180 day window!`);
      if (pastDue.length > 0) {
        console.log(`\n   All ${pastDue.length} renewals are past due (excluded per R6a)`);
        console.log(`   Sample past due renewals (first 5):`);
        pastDue.slice(0, 5).forEach(({ est, daysUntil }) => {
          const account = accounts.find(a => a.id === est.account_id);
          console.log(`     - ${account?.name || est.account_id}: ${Math.abs(daysUntil)} days ago (${est.contract_end})`);
        });
      }
    }

    // 4. Check cache
    console.log(`\n📦 Checking notification cache...`);
    const { data: cache, error: cacheError } = await supabase
      .from('notification_cache')
      .select('*')
      .eq('cache_key', 'at-risk-accounts')
      .single();

    if (cacheError && cacheError.code !== 'PGRST116') {
      console.error('   Cache error:', cacheError);
    } else if (cache) {
      const cacheData = cache.cache_data?.accounts || [];
      const expiresAt = new Date(cache.expires_at);
      const isStale = expiresAt < new Date();
      
      console.log(`   Cache exists: ${cacheData.length} accounts`);
      console.log(`   Expires at: ${expiresAt.toISOString()}`);
      console.log(`   Is stale: ${isStale ? 'YES (needs refresh)' : 'NO'}`);
      
      if (cacheData.length === 0 && withinWindow.length > 0) {
        console.log(`\n   ⚠️  Cache is empty but ${withinWindow.length} accounts should be at-risk!`);
        console.log(`   The background job may need to run to refresh the cache.`);
      }
    } else {
      console.log(`   Cache does not exist or is empty`);
      if (withinWindow.length > 0) {
        console.log(`   ⚠️  Cache needs to be created by background job.`);
      }
    }

    console.log(`\n✅ Debug complete!`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugAtRiskAccounts();

