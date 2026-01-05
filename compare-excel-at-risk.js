/**
 * Compare Excel file at-risk accounts with our calculation
 * Identifies discrepancies and missing accounts
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
  
  // Convert to JSON with headers
  const rows = XLSX.utils.sheet_to_json(worksheet, { 
    defval: null,
    raw: false 
  });
  
  if (rows.length === 0) {
    throw new Error('Excel file appears to be empty');
  }
  
  console.log(`✅ Read ${rows.length} rows from Excel file\n`);
  return rows;
}

// Normalize estimate ID for comparison
function normalizeEstimateId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase().replace(/^EST/, 'EST');
}

// Normalize account ID for comparison
function normalizeAccountId(id) {
  if (!id) return null;
  return id.toString().trim();
}

async function compare() {
  console.log('🔍 Comparing Excel At-Risk Accounts with Our Calculation\n');
  console.log('='.repeat(80));
  
  // Read Excel file
  const excelPath = join(process.env.HOME, 'Downloads', 'Estimates List - at risk accounts.xlsx');
  const excelRows = readExcelFile(excelPath);
  
  // Extract estimates and accounts from Excel
  const excelEstimates = new Map(); // estimate_id -> row data
  const excelAccounts = new Set(); // account IDs
  
  console.log('📊 Excel file columns:', Object.keys(excelRows[0] || {}));
  console.log('');
  
  excelRows.forEach((row, idx) => {
    // Try to find estimate ID column (could be various names)
    const estimateId = row['Estimate ID'] || row['EstimateID'] || row['Estimate Number'] || row['EstimateNumber'] || row['ID'];
    const accountId = row['Account ID'] || row['AccountID'] || row['Account'] || row['LMN Account ID'];
    const contractEnd = row['Contract End'] || row['ContractEnd'] || row['End Date'] || row['EndDate'];
    const accountName = row['Account Name'] || row['AccountName'] || row['Account'];
    
    if (estimateId) {
      const normalizedId = normalizeEstimateId(estimateId);
      excelEstimates.set(normalizedId, {
        originalId: estimateId,
        accountId: accountId ? normalizeAccountId(accountId) : null,
        accountName: accountName,
        contractEnd: contractEnd,
        row: row,
        rowIndex: idx + 2 // Excel row number (1-indexed + header)
      });
      
      if (accountId) {
        excelAccounts.add(normalizeAccountId(accountId));
      }
    }
  });
  
  console.log(`📋 Excel Summary:`);
  console.log(`   - Unique Estimates: ${excelEstimates.size}`);
  console.log(`   - Unique Accounts: ${excelAccounts.size}`);
  console.log('');
  
  // Fetch our calculated at-risk accounts
  const supabase = getSupabase();
  const { data: cache } = await supabase
    .from('notification_cache')
    .select('*')
    .eq('cache_key', 'at-risk-accounts')
    .single();
  
  const ourAtRiskAccounts = cache?.cache_data?.accounts || [];
  console.log(`📋 Our Calculation Summary:`);
  console.log(`   - At-Risk Accounts: ${ourAtRiskAccounts.length}`);
  console.log('');
  
  // Build maps for comparison
  const ourEstimateIds = new Set();
  const ourAccountIds = new Set();
  
  ourAtRiskAccounts.forEach(account => {
    ourAccountIds.add(normalizeAccountId(account.account_id));
    if (account.expiring_estimate_id) {
      ourEstimateIds.add(normalizeEstimateId(account.expiring_estimate_id));
    }
    if (account.expiring_estimate_number) {
      ourEstimateIds.add(normalizeEstimateId(account.expiring_estimate_number));
    }
  });
  
  // Find discrepancies
  const missingInOurs = [];
  const missingInExcel = [];
  const foundInBoth = [];
  
  excelEstimates.forEach((excelEst, normalizedId) => {
    const inOurs = ourEstimateIds.has(normalizedId);
    
    if (inOurs) {
      foundInBoth.push({
        estimateId: excelEst.originalId,
        accountId: excelEst.accountId,
        accountName: excelEst.accountName,
        contractEnd: excelEst.contractEnd
      });
    } else {
      missingInOurs.push({
        estimateId: excelEst.originalId,
        accountId: excelEst.accountId,
        accountName: excelEst.accountName,
        contractEnd: excelEst.contractEnd,
        rowIndex: excelEst.rowIndex
      });
    }
  });
  
  ourEstimateIds.forEach(ourEstId => {
    if (!excelEstimates.has(ourEstId)) {
      const ourAccount = ourAtRiskAccounts.find(a => 
        normalizeEstimateId(a.expiring_estimate_id) === ourEstId ||
        normalizeEstimateId(a.expiring_estimate_number) === ourEstId
      );
      missingInExcel.push({
        estimateId: ourEstId,
        accountId: ourAccount?.account_id,
        accountName: ourAccount?.account_name
      });
    }
  });
  
  // Print results
  console.log('📊 COMPARISON RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Found in Both: ${foundInBoth.length}`);
  console.log(`❌ In Excel but NOT in Our Calculation: ${missingInOurs.length}`);
  console.log(`⚠️  In Our Calculation but NOT in Excel: ${missingInExcel.length}`);
  console.log('');
  
  if (missingInOurs.length > 0) {
    console.log('\n❌ ESTIMATES IN EXCEL BUT MISSING FROM OUR CALCULATION:');
    console.log('='.repeat(80));
    missingInOurs.forEach((est, idx) => {
      console.log(`\n${idx + 1}. Estimate: ${est.estimateId}`);
      console.log(`   Account: ${est.accountName || est.accountId || 'N/A'}`);
      console.log(`   Account ID: ${est.accountId || 'N/A'}`);
      console.log(`   Contract End: ${est.contractEnd || 'N/A'}`);
      console.log(`   Excel Row: ${est.rowIndex}`);
    });
  }
  
  if (missingInExcel.length > 0) {
    console.log('\n⚠️  ESTIMATES IN OUR CALCULATION BUT NOT IN EXCEL:');
    console.log('='.repeat(80));
    missingInExcel.forEach((est, idx) => {
      console.log(`\n${idx + 1}. Estimate: ${est.estimateId}`);
      console.log(`   Account: ${est.accountName || est.accountId || 'N/A'}`);
      console.log(`   Account ID: ${est.accountId || 'N/A'}`);
    });
  }
  
  // Fetch detailed info about missing estimates
  if (missingInOurs.length > 0) {
    console.log('\n\n🔍 INVESTIGATING MISSING ESTIMATES:');
    console.log('='.repeat(80));
    
    const missingEstimateIds = missingInOurs.map(e => e.estimateId);
    
    // Try to find these estimates in the database
    const { data: estimates } = await supabase
      .from('estimates')
      .select('*')
      .in('estimate_number', missingEstimateIds)
      .or(`lmn_estimate_id.in.(${missingEstimateIds.join(',')})`);
    
    console.log(`\n📥 Found ${estimates?.length || 0} of ${missingInOurs.length} missing estimates in database`);
    
    if (estimates && estimates.length > 0) {
      estimates.forEach(est => {
        const excelRow = missingInOurs.find(e => 
          normalizeEstimateId(e.estimateId) === normalizeEstimateId(est.estimate_number) ||
          normalizeEstimateId(e.estimateId) === normalizeEstimateId(est.lmn_estimate_id)
        );
        
        if (excelRow) {
          console.log(`\n📋 Estimate: ${est.estimate_number || est.lmn_estimate_id}`);
          console.log(`   Status: ${est.status}`);
          console.log(`   Pipeline Status: ${est.pipeline_status || 'N/A'}`);
          console.log(`   Contract End: ${est.contract_end || 'N/A'}`);
          console.log(`   Account ID: ${est.account_id || 'N/A'}`);
          console.log(`   Division: ${est.division || 'N/A'}`);
          console.log(`   Address: ${est.address || 'N/A'}`);
          
          if (est.contract_end) {
            const renewalDate = startOfDay(new Date(est.contract_end));
            const today = startOfDay(new Date());
            const daysUntil = differenceInDays(renewalDate, today);
            console.log(`   Days Until: ${daysUntil}`);
            console.log(`   In Window (0-180): ${daysUntil >= 0 && daysUntil <= 180 ? 'YES' : 'NO'}`);
          }
        }
      });
    }
  }
  
  console.log('\n\n✅ Comparison complete!\n');
}

compare().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


