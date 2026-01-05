/**
 * Diagnostic to find why we're missing accounts
 * Groups Excel estimates by account and compares with our calculation
 */

import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { startOfDay, differenceInDays } from 'date-fns';

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

// Get Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Read Excel file
function readExcelFile(filePath) {
  console.log(`📖 Reading Excel file: ${filePath}`);
  
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rows = XLSX.utils.sheet_to_json(worksheet, { 
    defval: null,
    raw: false 
  });
  
  return rows;
}

// Normalize estimate ID
function normalizeEstimateId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase().replace(/^EST/, 'EST');
}

// Normalize account ID
function normalizeAccountId(id) {
  if (!id) return null;
  return id.toString().trim();
}

async function diagnose() {
  console.log('🔍 Diagnosing Missing At-Risk Accounts\n');
  console.log('='.repeat(80));
  
  // Read Excel file
  const excelPath = join(process.env.HOME, 'Downloads', 'Estimates List - at risk accounts.xlsx');
  const excelRows = readExcelFile(excelPath);
  
  console.log(`✅ Read ${excelRows.length} rows from Excel\n`);
  
  // Group Excel estimates by account
  const excelAccountsMap = new Map(); // account_id -> { account info, estimates[] }
  
  excelRows.forEach(row => {
    const estimateId = row['Estimate ID'];
    const contractEnd = row['Contract End'];
    const division = row['Division'];
    const address = row['Address'];
    
    // Try to find account ID from various columns
    // The Excel might have Contact ID or we need to look it up from estimate
    const contactId = row['Contact ID'];
    
    if (!estimateId) return;
    
    const normalizedEstId = normalizeEstimateId(estimateId);
    
    // We'll need to look up the account_id from the estimate in the database
    // For now, store by estimate ID
    if (!excelAccountsMap.has(normalizedEstId)) {
      excelAccountsMap.set(normalizedEstId, {
        estimateId: normalizedEstId,
        contractEnd: contractEnd,
        division: division,
        address: address,
        contactId: contactId
      });
    }
  });
  
  console.log(`📋 Excel has ${excelAccountsMap.size} unique estimates\n`);
  
  // Fetch our calculated at-risk accounts
  const supabase = getSupabase();
  const { data: cache } = await supabase
    .from('notification_cache')
    .select('*')
    .eq('cache_key', 'at-risk-accounts')
    .single();
  
  const ourAtRiskAccounts = cache?.cache_data?.accounts || [];
  console.log(`📋 Our calculation has ${ourAtRiskAccounts.length} accounts\n`);
  
  // Get all estimates from Excel
  const excelEstimateIds = Array.from(excelAccountsMap.keys());
  
  // Fetch these estimates from database to get account_ids
  console.log('📥 Fetching estimates from database...');
  const { data: estimates } = await supabase
    .from('estimates')
    .select('id, estimate_number, lmn_estimate_id, account_id, status, pipeline_status, contract_end, division, address, archived')
    .or(`estimate_number.in.(${excelEstimateIds.join(',')}),lmn_estimate_id.in.(${excelEstimateIds.join(',')})`);
  
  console.log(`✅ Found ${estimates?.length || 0} estimates in database\n`);
  
  // Group Excel estimates by account_id
  const excelAccountsByAccountId = new Map(); // account_id -> estimates[]
  const estimatesByEstId = new Map();
  
  estimates?.forEach(est => {
    const estId = normalizeEstimateId(est.estimate_number || est.lmn_estimate_id);
    estimatesByEstId.set(estId, est);
    
    if (est.account_id) {
      const accountId = normalizeAccountId(est.account_id);
      if (!excelAccountsByAccountId.has(accountId)) {
        excelAccountsByAccountId.set(accountId, []);
      }
      excelAccountsByAccountId.get(accountId).push(est);
    }
  });
  
  console.log(`📊 Excel estimates map to ${excelAccountsByAccountId.size} unique accounts\n`);
  
  // Get our account IDs
  const ourAccountIds = new Set();
  ourAtRiskAccounts.forEach(acc => {
    ourAccountIds.add(normalizeAccountId(acc.account_id));
  });
  
  // Find missing accounts
  const missingAccountIds = [];
  excelAccountsByAccountId.forEach((estimates, accountId) => {
    if (!ourAccountIds.has(accountId)) {
      missingAccountIds.push({
        accountId: accountId,
        estimates: estimates
      });
    }
  });
  
  console.log(`\n❌ MISSING ACCOUNTS: ${missingAccountIds.length} accounts from Excel are not in our calculation\n`);
  console.log('='.repeat(80));
  
  // Fetch account details for missing accounts
  if (missingAccountIds.length > 0) {
    const missingIds = missingAccountIds.map(m => m.accountId);
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, archived')
      .in('id', missingIds);
    
    const accountsMap = new Map();
    accounts?.forEach(acc => {
      accountsMap.set(normalizeAccountId(acc.id), acc);
    });
    
    // Check each missing account
    for (const missing of missingAccountIds) {
      const account = accountsMap.get(missing.accountId);
      const accountEstimates = missing.estimates;
      
      console.log(`\n📋 Account: ${account?.name || missing.accountId}`);
      console.log(`   Account ID: ${missing.accountId}`);
      console.log(`   Archived: ${account?.archived ? 'YES ❌' : 'NO ✅'}`);
      console.log(`   Estimates in Excel: ${accountEstimates.length}`);
      
      // Check each estimate
      accountEstimates.forEach(est => {
        const estId = normalizeEstimateId(est.estimate_number || est.lmn_estimate_id);
        const excelEst = excelAccountsMap.get(estId);
        
        console.log(`\n   Estimate: ${estId}`);
        console.log(`     Status: ${est.status}`);
        console.log(`     Pipeline Status: ${est.pipeline_status || 'N/A'}`);
        console.log(`     Contract End: ${est.contract_end || 'N/A'}`);
        console.log(`     Archived: ${est.archived ? 'YES ❌' : 'NO ✅'}`);
        
        if (est.contract_end) {
          const renewalDate = startOfDay(new Date(est.contract_end));
          const today = startOfDay(new Date());
          const daysUntil = differenceInDays(renewalDate, today);
          console.log(`     Days Until: ${daysUntil}`);
          console.log(`     In Window (0-180): ${daysUntil >= 0 && daysUntil <= 180 ? 'YES ✅' : 'NO ❌'}`);
        }
      });
    }
  }
  
  // Also check if we have accounts that Excel doesn't have
  const extraAccountIds = [];
  ourAccountIds.forEach(accountId => {
    if (!excelAccountsByAccountId.has(accountId)) {
      extraAccountIds.push(accountId);
    }
  });
  
  if (extraAccountIds.length > 0) {
    console.log(`\n\n⚠️  ACCOUNTS IN OUR CALCULATION BUT NOT IN EXCEL: ${extraAccountIds.length}`);
    console.log('='.repeat(80));
    extraAccountIds.forEach(accountId => {
      const ourAccount = ourAtRiskAccounts.find(a => normalizeAccountId(a.account_id) === accountId);
      console.log(`   ${ourAccount?.account_name || accountId} (${accountId})`);
    });
  }
  
  console.log('\n\n✅ Diagnostic complete!\n');
}

diagnose().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


