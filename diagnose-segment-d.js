/**
 * Diagnostic script to check why Segment D accounts are not being created
 * 
 * This script will:
 * 1. Check how many accounts have Standard won estimates
 * 2. Check how many accounts have Service won estimates
 * 3. Check how many accounts should be Segment D
 * 4. Show the actual estimate_type values in the database
 * 5. Check if estimates are being properly passed to segment calculation
 */

import { createClient } from '@supabase/supabase-js';
import { isWonStatus } from './src/utils/reportCalculations.js';
import { calculateRevenueSegment, calculateTotalRevenue, autoAssignRevenueSegments } from './src/utils/revenueSegmentCalculator.js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Helper to get current year (simplified for diagnostic)
function getCurrentYearForCalculation() {
  return new Date().getFullYear();
}

// Simplified version of getEstimateYearData for diagnostic
function getEstimateYearData(estimate, currentYear) {
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  const createdDate = estimate.created_date ? new Date(estimate.created_date) : null;
  
  // Determine which date to use for year calculation
  let yearDeterminationDate = null;
  
  if (contractEnd && !isNaN(contractEnd.getTime())) {
    yearDeterminationDate = contractEnd;
  } else if (contractStart && !isNaN(contractStart.getTime())) {
    yearDeterminationDate = contractStart;
  } else if (estimateDate && !isNaN(estimateDate.getTime())) {
    yearDeterminationDate = estimateDate;
  } else if (createdDate && !isNaN(createdDate.getTime())) {
    yearDeterminationDate = createdDate;
  }
  
  if (yearDeterminationDate) {
    const determinationYear = yearDeterminationDate.getFullYear();
    return {
      appliesToCurrentYear: currentYear === determinationYear,
      value: currentYear === determinationYear ? 1 : 0 // Simplified for diagnostic
    };
  }
  
  // No dates - assume applies to current year
  return {
    appliesToCurrentYear: true,
    value: 1
  };
}

async function diagnose() {
  console.log('🔍 Segment D Diagnostic\n');
  console.log('Checking why Segment D accounts are not being created...\n');
  
  const supabase = getSupabase();
  const currentYear = getCurrentYearForCalculation();
  
  console.log(`Using current year: ${currentYear}\n`);
  
  // Fetch all accounts
  console.log('📊 Fetching accounts...');
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, name, revenue_segment, annual_revenue')
    .order('name');
  
  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    return;
  }
  
  console.log(`Found ${accounts.length} accounts\n`);
  
  // Fetch all estimates
  console.log('📊 Fetching estimates...');
  const { data: estimates, error: estimatesError } = await supabase
    .from('estimates')
    .select('id, account_id, estimate_type, status, pipeline_status, contract_start, contract_end, estimate_date, created_date, archived')
    .eq('archived', false); // Exclude archived estimates
  
  if (estimatesError) {
    console.error('Error fetching estimates:', estimatesError);
    return;
  }
  
  console.log(`Found ${estimates.length} estimates\n`);
  
  // Group estimates by account_id
  const estimatesByAccountId = {};
  estimates.forEach(est => {
    if (est.account_id) {
      if (!estimatesByAccountId[est.account_id]) {
        estimatesByAccountId[est.account_id] = [];
      }
      estimatesByAccountId[est.account_id].push(est);
    }
  });
  
  console.log(`Estimates grouped into ${Object.keys(estimatesByAccountId).length} accounts\n`);
  
  // Check estimate_type values
  console.log('📋 Checking estimate_type values...');
  const estimateTypes = new Set();
  estimates.forEach(est => {
    if (est.estimate_type) {
      estimateTypes.add(est.estimate_type.toString().trim());
    }
  });
  console.log(`Found estimate_type values: ${Array.from(estimateTypes).join(', ') || 'NONE'}\n`);
  
  // Analyze each account
  console.log('🔍 Analyzing accounts for Segment D eligibility...\n');
  
  let accountsWithStandard = 0;
  let accountsWithService = 0;
  let accountsWithBoth = 0;
  let accountsWithNeither = 0;
  let accountsEligibleForD = 0;
  let accountsCurrentlyD = 0;
  
  const eligibleAccounts = [];
  const issues = [];
  
  for (const account of accounts) {
    const accountEstimates = estimatesByAccountId[account.id] || [];
    
    // Filter to won estimates that apply to current year
    const wonEstimates = accountEstimates.filter(est => {
      if (!isWonStatus(est)) {
        return false;
      }
      const yearData = getEstimateYearData(est, currentYear);
      return yearData && yearData.appliesToCurrentYear;
    });
    
    if (wonEstimates.length === 0) {
      accountsWithNeither++;
      continue;
    }
    
    // Check estimate types
    const hasStandard = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'standard'
    );
    const hasService = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'service'
    );
    
    if (hasStandard && hasService) {
      accountsWithBoth++;
    } else if (hasStandard) {
      accountsWithStandard++;
      accountsEligibleForD++;
      eligibleAccounts.push({
        account: account.name,
        accountId: account.id,
        currentSegment: account.revenue_segment,
        wonEstimates: wonEstimates.length,
        standardCount: wonEstimates.filter(e => e.estimate_type && e.estimate_type.toString().trim().toLowerCase() === 'standard').length,
        serviceCount: wonEstimates.filter(e => e.estimate_type && e.estimate_type.toString().trim().toLowerCase() === 'service').length
      });
    } else if (hasService) {
      accountsWithService++;
    } else {
      accountsWithNeither++;
      // Check if they have estimates but wrong types
      const uniqueTypes = new Set();
      wonEstimates.forEach(est => {
        if (est.estimate_type) {
          uniqueTypes.add(est.estimate_type.toString().trim());
        }
      });
      if (uniqueTypes.size > 0) {
        issues.push({
          account: account.name,
          accountId: account.id,
          estimateTypes: Array.from(uniqueTypes),
          wonEstimates: wonEstimates.length
        });
      }
    }
    
    if (account.revenue_segment === 'D') {
      accountsCurrentlyD++;
    }
  }
  
  console.log('📊 Summary Statistics:');
  console.log(`  Accounts with Standard won estimates (no Service): ${accountsWithStandard}`);
  console.log(`  Accounts with Service won estimates (no Standard): ${accountsWithService}`);
  console.log(`  Accounts with BOTH Standard and Service: ${accountsWithBoth}`);
  console.log(`  Accounts with neither Standard nor Service: ${accountsWithNeither}`);
  console.log(`  Accounts eligible for Segment D: ${accountsEligibleForD}`);
  console.log(`  Accounts currently marked as Segment D: ${accountsCurrentlyD}\n`);
  
  if (eligibleAccounts.length > 0) {
    console.log(`\n✅ Found ${eligibleAccounts.length} accounts that SHOULD be Segment D:\n`);
    eligibleAccounts.slice(0, 10).forEach(acc => {
      console.log(`  - ${acc.account} (ID: ${acc.accountId})`);
      console.log(`    Current segment: ${acc.currentSegment || 'null'}`);
      console.log(`    Won estimates: ${acc.wonEstimates} (${acc.standardCount} Standard, ${acc.serviceCount} Service)`);
    });
    if (eligibleAccounts.length > 10) {
      console.log(`  ... and ${eligibleAccounts.length - 10} more`);
    }
  } else {
    console.log('\n⚠️  No accounts found that are eligible for Segment D\n');
  }
  
  if (issues.length > 0) {
    console.log(`\n⚠️  Found ${issues.length} accounts with won estimates but unexpected estimate_type values:\n`);
    issues.slice(0, 5).forEach(issue => {
      console.log(`  - ${issue.account}: ${issue.estimateTypes.join(', ') || 'NULL'} (${issue.wonEstimates} won estimates)`);
    });
    if (issues.length > 5) {
      console.log(`  ... and ${issues.length - 5} more`);
    }
  }
  
  // Test the actual segment calculation
  console.log('\n🧪 Testing segment calculation with actual data...\n');
  
  const totalRevenue = calculateTotalRevenue(accounts, estimatesByAccountId);
  console.log(`Total revenue: $${totalRevenue.toLocaleString()}\n`);
  
  // Test with a few eligible accounts
  if (eligibleAccounts.length > 0) {
    console.log('Testing segment calculation for eligible accounts:\n');
    const testAccount = accounts.find(a => a.id === eligibleAccounts[0].accountId);
    if (testAccount) {
      const testEstimates = estimatesByAccountId[testAccount.id] || [];
      const calculatedSegment = calculateRevenueSegment(testAccount, totalRevenue, testEstimates);
      console.log(`  Account: ${testAccount.name}`);
      console.log(`  Current segment: ${testAccount.revenue_segment || 'null'}`);
      console.log(`  Calculated segment: ${calculatedSegment}`);
      console.log(`  Estimates passed: ${testEstimates.length}`);
      console.log(`  Won estimates for current year: ${testEstimates.filter(e => {
        if (!isWonStatus(e)) return false;
        const yearData = getEstimateYearData(e, currentYear);
        return yearData && yearData.appliesToCurrentYear;
      }).length}`);
      
      // Show estimate types
      const wonEsts = testEstimates.filter(e => {
        if (!isWonStatus(e)) return false;
        const yearData = getEstimateYearData(e, currentYear);
        return yearData && yearData.appliesToCurrentYear;
      });
      console.log(`  Estimate types in won estimates: ${wonEsts.map(e => e.estimate_type || 'NULL').join(', ')}`);
    }
  }
  
  // Run the full auto-assign to see what happens
  console.log('\n🔄 Running autoAssignRevenueSegments...\n');
  const updatedAccounts = autoAssignRevenueSegments(accounts, estimatesByAccountId);
  const newDSegments = updatedAccounts.filter(a => a.revenue_segment === 'D').length;
  console.log(`After auto-assignment, ${newDSegments} accounts would be Segment D`);
  
  if (newDSegments !== accountsEligibleForD) {
    console.log(`⚠️  Mismatch! Expected ${accountsEligibleForD} but got ${newDSegments}`);
  }
  
  console.log('\n✅ Diagnostic complete!\n');
}

diagnose().catch(console.error);

