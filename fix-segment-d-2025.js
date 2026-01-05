/**
 * Script to manually fix Segment D assignments for 2025
 * This will calculate and update segments for all accounts based on 2025 data
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

// Simplified isWonStatus
function isWonStatus(statusOrEstimate, pipelineStatus = null) {
  let status, pipeline;
  
  if (typeof statusOrEstimate === 'object' && statusOrEstimate !== null) {
    status = statusOrEstimate.status;
    pipeline = statusOrEstimate.pipeline_status;
  } else {
    status = statusOrEstimate;
    pipeline = pipelineStatus;
  }
  
  if (pipeline) {
    const pipelineLower = pipeline.toString().toLowerCase().trim();
    if (pipelineLower === 'sold' || pipelineLower.includes('sold')) {
      return true;
    }
  }
  
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

// Simplified getEstimateYearData for 2025
function getEstimateYearData(estimate, currentYear) {
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  const createdDate = estimate.created_date ? new Date(estimate.created_date) : null;
  
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
  
  return {
    appliesToCurrentYear: true,
    value: 1
  };
}

// Simplified calculateRevenueSegment for 2025
function calculateRevenueSegment(account, totalRevenue, estimates = [], currentYear = 2025) {
  // Check for Segment D first
  if (estimates && estimates.length > 0) {
    const wonEstimates = estimates.filter(est => {
      if (!isWonStatus(est)) {
        return false;
      }
      const yearData = getEstimateYearData(est, currentYear);
      return yearData && yearData.appliesToCurrentYear;
    });
    
    const hasStandardEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'standard'
    );
    const hasServiceEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'service'
    );
    
    // Segment D: has Standard but NO Service
    if (hasStandardEstimates && !hasServiceEstimates) {
      return 'D';
    }
  }
  
  // Use annual_revenue for A/B/C segments
  const accountRevenue = typeof account.annual_revenue === 'number' 
    ? account.annual_revenue 
    : parseFloat(account.annual_revenue) || 0;
  
  if (accountRevenue <= 0 || !totalRevenue || totalRevenue <= 0) {
    return 'C';
  }

  const revenuePercentage = (accountRevenue / totalRevenue) * 100;

  if (revenuePercentage >= 15) {
    return 'A';
  }
  
  if (revenuePercentage >= 5 && revenuePercentage < 15) {
    return 'B';
  }
  
  return 'C';
}

// Calculate total revenue
function calculateTotalRevenue(accounts) {
  return accounts.reduce((total, account) => {
    const revenue = typeof account.annual_revenue === 'number' 
      ? account.annual_revenue 
      : parseFloat(account.annual_revenue) || 0;
    return total + revenue;
  }, 0);
}

async function fixSegments() {
  console.log('🔧 Fixing Segment D assignments for 2025...\n');
  
  const supabase = getSupabase();
  const currentYear = 2025;
  
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
  
  // Calculate total revenue
  const totalRevenue = calculateTotalRevenue(accounts);
  console.log(`Total revenue for ${currentYear}: $${totalRevenue.toLocaleString()}\n`);
  
  // Calculate segments for all accounts
  console.log('🔄 Calculating segments...');
  const updates = [];
  let dSegmentCount = 0;
  
  for (const account of accounts) {
    const accountEstimates = estimatesByAccountId[account.id] || [];
    const newSegment = calculateRevenueSegment(account, totalRevenue, accountEstimates, currentYear);
    
    if (newSegment === 'D') {
      dSegmentCount++;
    }
    
    // Only update if segment changed
    if (account.revenue_segment !== newSegment) {
      updates.push({
        id: account.id,
        name: account.name,
        oldSegment: account.revenue_segment || 'null',
        newSegment: newSegment
      });
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`  Accounts that will be Segment D: ${dSegmentCount}`);
  console.log(`  Accounts that need updates: ${updates.length}\n`);
  
  if (updates.length === 0) {
    console.log('✅ All segments are already correct!\n');
    return;
  }
  
  // Show preview of changes
  console.log('Preview of changes (first 10):\n');
  updates.slice(0, 10).forEach(update => {
    console.log(`  ${update.name}: ${update.oldSegment} → ${update.newSegment}`);
    if (update.newSegment === 'D') {
      console.log(`    ⭐ This account will be Segment D!`);
    }
  });
  if (updates.length > 10) {
    console.log(`  ... and ${updates.length - 10} more`);
  }
  
  // Ask for confirmation
  console.log(`\n⚠️  This will update ${updates.length} accounts.`);
  console.log('To proceed, uncomment the update code at the bottom of this script.\n');
  
  // Update the database
  console.log('\n💾 Updating accounts in database...');
  let successCount = 0;
  let errorCount = 0;
  
  for (const update of updates) {
    const { error } = await supabase
      .from('accounts')
      .update({ revenue_segment: update.newSegment })
      .eq('id', update.id);
    
    if (error) {
      console.error(`  ❌ Error updating ${update.name}:`, error.message);
      errorCount++;
    } else {
      successCount++;
      if (update.newSegment === 'D') {
        console.log(`  ✅ Updated ${update.name} to Segment D`);
      }
    }
  }
  
  console.log(`\n✅ Update complete!`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Segment D accounts: ${dSegmentCount}\n`);
}

fixSegments().catch(console.error);

