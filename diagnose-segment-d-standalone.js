/**
 * Standalone diagnostic script to check why Segment D accounts are not being created
 * This version doesn't rely on path aliases or React context
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

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

// Simplified isWonStatus (same logic as reportCalculations.js)
function isWonStatus(statusOrEstimate, pipelineStatus = null) {
  let status, pipeline;
  
  if (typeof statusOrEstimate === 'object' && statusOrEstimate !== null) {
    status = statusOrEstimate.status;
    pipeline = statusOrEstimate.pipeline_status;
  } else {
    status = statusOrEstimate;
    pipeline = pipelineStatus;
  }
  
  // Check pipeline_status first (preferred)
  if (pipeline) {
    const pipelineLower = pipeline.toString().toLowerCase().trim();
    if (pipelineLower === 'sold' || pipelineLower.includes('sold')) {
      return true;
    }
  }
  
  // Check status field (fallback)
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  const wonStatuses = [
    'contract signed',
    'work complete',
    'billing complete',
    'email contract award',
    'verbal contract award',
    'contract in progress',
    'contract + billing complete',
    'sold',
    'won'
  ];
  return wonStatuses.includes(statusLower);
}

// Simplified getEstimateYearData
function getEstimateYearData(estimate, currentYear) {
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  const createdDate = estimate.created_date ? new Date(estimate.created_date) : null;
  
  // Priority: contract_end → contract_start → estimate_date → created_date
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
      value: currentYear === determinationYear ? 1 : 0
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
  
  // Fetch all accounts and estimates once
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
    .eq('archived', false);
  
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
  
  // Check multiple years to see where Segment D accounts exist
  const yearsToCheck = [2025, 2026, 2024];
  
  for (const currentYear of yearsToCheck) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Checking year: ${currentYear}`);
    console.log('='.repeat(60));
  
    // Check won estimates with estimate_type
    console.log('📋 Checking won estimates by type...');
    const wonEstimates = estimates.filter(est => isWonStatus(est));
    console.log(`Total won estimates: ${wonEstimates.length}`);
    
    const wonStandard = wonEstimates.filter(est => {
      const type = est.estimate_type ? est.estimate_type.toString().trim().toLowerCase() : '';
      return type === 'standard';
    });
    const wonService = wonEstimates.filter(est => {
      const type = est.estimate_type ? est.estimate_type.toString().trim().toLowerCase() : '';
      return type === 'service';
    });
    console.log(`Won estimates with type "standard": ${wonStandard.length}`);
    console.log(`Won estimates with type "service": ${wonService.length}`);
    
    // Check won estimates that apply to current year
    const wonForCurrentYear = wonEstimates.filter(est => {
      const yearData = getEstimateYearData(est, currentYear);
      return yearData && yearData.appliesToCurrentYear;
    });
    console.log(`Won estimates for current year (${currentYear}): ${wonForCurrentYear.length}\n`);
    
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
    const wonEstimatesForAccount = accountEstimates.filter(est => {
      if (!isWonStatus(est)) {
        return false;
      }
      const yearData = getEstimateYearData(est, currentYear);
      return yearData && yearData.appliesToCurrentYear;
    });
    
    if (wonEstimatesForAccount.length === 0) {
      accountsWithNeither++;
      continue;
    }
    
    // Check estimate types (case-insensitive, trimmed)
    const hasStandard = wonEstimatesForAccount.some(est => {
      const type = est.estimate_type ? est.estimate_type.toString().trim().toLowerCase() : '';
      return type === 'standard';
    });
    const hasService = wonEstimatesForAccount.some(est => {
      const type = est.estimate_type ? est.estimate_type.toString().trim().toLowerCase() : '';
      return type === 'service';
    });
    
    if (hasStandard && hasService) {
      accountsWithBoth++;
    } else if (hasStandard) {
      accountsWithStandard++;
      accountsEligibleForD++;
      eligibleAccounts.push({
        account: account.name,
        accountId: account.id,
        currentSegment: account.revenue_segment,
        wonEstimates: wonEstimatesForAccount.length,
        standardCount: wonEstimatesForAccount.filter(e => {
          const type = e.estimate_type ? e.estimate_type.toString().trim().toLowerCase() : '';
          return type === 'standard';
        }).length,
        serviceCount: wonEstimatesForAccount.filter(e => {
          const type = e.estimate_type ? e.estimate_type.toString().trim().toLowerCase() : '';
          return type === 'service';
        }).length,
        estimateTypes: wonEstimatesForAccount.map(e => e.estimate_type || 'NULL')
      });
    } else if (hasService) {
      accountsWithService++;
    } else {
      accountsWithNeither++;
      // Check if they have estimates but wrong types
      const uniqueTypes = new Set();
      wonEstimatesForAccount.forEach(est => {
        if (est.estimate_type) {
          uniqueTypes.add(est.estimate_type.toString().trim());
        }
      });
      if (uniqueTypes.size > 0) {
        issues.push({
          account: account.name,
          accountId: account.id,
          estimateTypes: Array.from(uniqueTypes),
          wonEstimates: wonEstimatesForAccount.length
        });
      }
    }
    
      if (account.revenue_segment === 'D') {
        accountsCurrentlyD++;
      }
    }
    
    console.log(`\n📊 Summary Statistics for ${currentYear}:`);
  console.log(`  Accounts with Standard won estimates (no Service): ${accountsWithStandard}`);
  console.log(`  Accounts with Service won estimates (no Standard): ${accountsWithService}`);
  console.log(`  Accounts with BOTH Standard and Service: ${accountsWithBoth}`);
  console.log(`  Accounts with neither Standard nor Service: ${accountsWithNeither}`);
  console.log(`  Accounts eligible for Segment D: ${accountsEligibleForD}`);
  console.log(`  Accounts currently marked as Segment D: ${accountsCurrentlyD}\n`);
  
    if (eligibleAccounts.length > 0) {
      console.log(`\n✅ Found ${eligibleAccounts.length} accounts that SHOULD be Segment D for ${currentYear}:\n`);
      eligibleAccounts.slice(0, 10).forEach(acc => {
        console.log(`  - ${acc.account} (ID: ${acc.accountId})`);
        console.log(`    Current segment: ${acc.currentSegment || 'null'}`);
        console.log(`    Won estimates: ${acc.wonEstimates} (${acc.standardCount} Standard, ${acc.serviceCount} Service)`);
        console.log(`    Estimate types: ${acc.estimateTypes.join(', ')}`);
      });
      if (eligibleAccounts.length > 10) {
        console.log(`  ... and ${eligibleAccounts.length - 10} more`);
      }
    } else {
      console.log(`\n⚠️  No accounts found that are eligible for Segment D for ${currentYear}\n`);
    }
    
    if (issues.length > 0 && currentYear === yearsToCheck[0]) {
      console.log(`\n⚠️  Found ${issues.length} accounts with won estimates but unexpected estimate_type values:\n`);
      issues.slice(0, 5).forEach(issue => {
        console.log(`  - ${issue.account}: ${issue.estimateTypes.join(', ') || 'NULL'} (${issue.wonEstimates} won estimates)`);
      });
      if (issues.length > 5) {
        console.log(`  ... and ${issues.length - 5} more`);
      }
    }
    
    // Reset for next year
    accountsWithStandard = 0;
    accountsWithService = 0;
    accountsWithBoth = 0;
    accountsWithNeither = 0;
    accountsEligibleForD = 0;
    accountsCurrentlyD = 0;
    eligibleAccounts.length = 0;
    issues.length = 0;
  } // end for loop
  
  console.log('\n✅ Diagnostic complete!\n');
}

diagnose().catch(console.error);

