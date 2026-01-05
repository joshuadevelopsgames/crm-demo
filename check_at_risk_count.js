/**
 * Script to check how many at-risk accounts are in the database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function checkAtRiskAccounts() {
  try {
    const supabase = getSupabase();
    
    console.log('🔍 Checking at-risk accounts in database...\n');
    
    // Check notification cache (this is what the app uses)
    console.log('📦 Checking notification cache...');
    const { data: cacheData, error: cacheError } = await supabase
      .from('notification_cache')
      .select('*')
      .eq('cache_key', 'at-risk-accounts')
      .single();
    
    if (cacheError) {
      console.error('❌ Error fetching cache:', cacheError);
    } else if (cacheData) {
      const cacheContent = cacheData.cache_data;
      const cachedAccounts = cacheContent?.accounts || [];
      const cachedCount = cacheContent?.count || cachedAccounts.length || 0;
      const expiresAt = new Date(cacheData.expires_at);
      const isExpired = expiresAt < new Date();
      const updatedAt = new Date(cacheData.updated_at);
      
      console.log(`📊 Total at-risk accounts in cache: ${cachedCount}`);
      console.log(`⏰ Cache updated: ${updatedAt.toISOString()}`);
      console.log(`⏰ Cache expires: ${expiresAt.toISOString()} ${isExpired ? '(EXPIRED ⚠️)' : '(Active ✓)'}`);
      
      if (cachedAccounts.length > 0) {
        console.log('\n📋 At-risk accounts from cache:');
        cachedAccounts.slice(0, 10).forEach((account, index) => {
          console.log(`  ${index + 1}. Account ID: ${account.account_id || account.id}`);
          console.log(`     Renewal Date: ${account.renewal_date || 'N/A'}`);
          console.log(`     Days Until Renewal: ${account.days_until_renewal || 'N/A'}`);
          if (account.expiring_estimate_number) {
            console.log(`     Estimate Number: ${account.expiring_estimate_number}`);
          }
          console.log('');
        });
        if (cachedAccounts.length > 10) {
          console.log(`  ... and ${cachedAccounts.length - 10} more accounts\n`);
        }
        
        // Get account names
        const accountIds = cachedAccounts.map(a => a.account_id || a.id).filter(Boolean);
        if (accountIds.length > 0) {
          const { data: accounts, error: accountsError } = await supabase
            .from('accounts')
            .select('id, name, archived')
            .in('id', accountIds.slice(0, 20)); // Limit to first 20 to avoid query size issues
          
          if (!accountsError && accounts) {
            console.log('📝 Sample Account Details (first 20):');
            accounts.forEach(account => {
              const atRiskData = cachedAccounts.find(a => (a.account_id || a.id) === account.id);
              console.log(`  - ${account.name} (${account.id})`);
              console.log(`    Archived: ${account.archived}`);
              if (atRiskData) {
                console.log(`    Renewal: ${atRiskData.renewal_date || 'N/A'} (${atRiskData.days_until_renewal || 'N/A'} days)`);
              }
              console.log('');
            });
          }
        }
      } else {
        console.log('⚠️  Cache exists but contains no accounts.');
      }
    } else {
      console.log('⚠️  No cache entry found for at-risk-accounts');
      console.log('💡 The cache may need to be refreshed. Try calling /api/admin/refresh-cache');
    }
    
    // Check snoozes
    console.log('\n🔍 Checking snoozes for at-risk accounts...');
    const { data: snoozes, error: snoozesError } = await supabase
      .from('notification_snoozes')
      .select('*')
      .eq('notification_type', 'at-risk-account')
      .gt('snoozed_until', new Date().toISOString());
    
    if (!snoozesError && snoozes) {
      console.log(`🔕 Active snoozes for at-risk accounts: ${snoozes.length}`);
      if (snoozes.length > 0) {
        snoozes.forEach(snooze => {
          console.log(`  - Account ID: ${snooze.related_account_id || 'All'}`);
          console.log(`    Snoozed until: ${snooze.snoozed_until}`);
        });
      }
    } else if (snoozesError) {
      console.log(`⚠️  Error checking snoozes: ${snoozesError.message}`);
    }
    
    // Try to check if at_risk_accounts table exists (might be in some environments)
    console.log('\n🔍 Checking if at_risk_accounts table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('at_risk_accounts')
      .select('count')
      .limit(1);
    
    if (tableError && tableError.code === 'PGRST205') {
      console.log('ℹ️  at_risk_accounts table does not exist (using notification_cache instead)');
    } else if (!tableError) {
      const { count } = await supabase
        .from('at_risk_accounts')
        .select('*', { count: 'exact', head: true });
      console.log(`📊 at_risk_accounts table exists with ${count || 0} records`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAtRiskAccounts();

