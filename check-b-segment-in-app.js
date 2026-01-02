#!/usr/bin/env node

/**
 * Check B segment count in LECRM application database
 * Compares with the Excel file analysis (should be 5 B segment clients for 2025)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });
dotenv.config({ path: join(__dirname, '.env') });

// Standalone revenue segment calculation (replicated from revenueSegmentCalculator.js)
const CURRENT_YEAR = 2025; // For 2025 analysis

function calculateDurationMonths(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const dayDiff = end.getDate() - start.getDate();
  let totalMonths = yearDiff * 12 + monthDiff;
  if (dayDiff > 0) {
    totalMonths += 1;
  }
  return totalMonths;
}

function getContractYears(durationMonths) {
  if (durationMonths <= 12) return 1;
  if (durationMonths <= 24) return 2;
  if (durationMonths <= 36) return 3;
  if (durationMonths % 12 === 0) {
    return durationMonths / 12;
  }
  return Math.ceil(durationMonths / 12);
}

function getEstimateYearData(estimate, currentYear) {
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  
  const totalPriceWithTax = parseFloat(estimate.total_price_with_tax);
  const totalPriceNoTax = parseFloat(estimate.total_price);
  
  if (isNaN(totalPriceWithTax) || totalPriceWithTax === 0) {
    if (totalPriceNoTax && totalPriceNoTax > 0) {
      // Use total_price as fallback
      const totalPrice = totalPriceNoTax;
      if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
        const startYear = contractStart.getFullYear();
        const durationMonths = calculateDurationMonths(contractStart, contractEnd);
        if (durationMonths <= 0) return null;
        const yearsCount = getContractYears(durationMonths);
        const yearsApplied = [];
        for (let i = 0; i < yearsCount; i++) {
          yearsApplied.push(startYear + i);
        }
        const appliesToCurrentYear = yearsApplied.includes(currentYear);
        const annualAmount = totalPrice / yearsCount;
        return { appliesToCurrentYear, value: appliesToCurrentYear ? annualAmount : 0 };
      }
      if (contractStart && !isNaN(contractStart.getTime())) {
        const startYear = contractStart.getFullYear();
        return { appliesToCurrentYear: currentYear === startYear, value: totalPrice };
      }
      if (estimateDate && !isNaN(estimateDate.getTime())) {
        const estimateYear = estimateDate.getFullYear();
        return { appliesToCurrentYear: currentYear === estimateYear, value: totalPrice };
      }
      return { appliesToCurrentYear: true, value: totalPrice };
    }
    return null;
  }
  
  const totalPrice = totalPriceWithTax;
  
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    const startYear = contractStart.getFullYear();
    const durationMonths = calculateDurationMonths(contractStart, contractEnd);
    if (durationMonths <= 0) return null;
    const yearsCount = getContractYears(durationMonths);
    const yearsApplied = [];
    for (let i = 0; i < yearsCount; i++) {
      yearsApplied.push(startYear + i);
    }
    const appliesToCurrentYear = yearsApplied.includes(currentYear);
    const annualAmount = totalPrice / yearsCount;
    return { appliesToCurrentYear, value: appliesToCurrentYear ? annualAmount : 0 };
  }
  
  if (contractStart && !isNaN(contractStart.getTime())) {
    const startYear = contractStart.getFullYear();
    return { appliesToCurrentYear: currentYear === startYear, value: totalPrice };
  }
  
  if (estimateDate && !isNaN(estimateDate.getTime())) {
    const estimateYear = estimateDate.getFullYear();
    return { appliesToCurrentYear: currentYear === estimateYear, value: totalPrice };
  }
  
  return { appliesToCurrentYear: true, value: totalPrice };
}

function getAccountRevenue(account, estimates = []) {
  return estimates
    .filter(est => {
      if (!est.status || est.status.toLowerCase() !== 'won') return false;
      const yearData = getEstimateYearData(est, CURRENT_YEAR);
      return yearData && yearData.appliesToCurrentYear;
    })
    .reduce((sum, est) => {
      const yearData = getEstimateYearData(est, CURRENT_YEAR);
      if (!yearData) return sum;
      return sum + (isNaN(yearData.value) ? 0 : yearData.value);
    }, 0);
}

function calculateRevenueSegment(account, totalRevenue, estimates = []) {
  // Check for Segment D (project only)
  if (estimates && estimates.length > 0) {
    const wonEstimates = estimates.filter(est => {
      if (!est.status || est.status.toLowerCase() !== 'won') return false;
      const yearData = getEstimateYearData(est, CURRENT_YEAR);
      return yearData && yearData.appliesToCurrentYear;
    });
    
    const hasStandardEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'standard'
    );
    const hasServiceEstimates = wonEstimates.some(est => 
      est.estimate_type && est.estimate_type.toString().trim().toLowerCase() === 'service'
    );
    
    if (hasStandardEstimates && !hasServiceEstimates) {
      return 'D';
    }
  }
  
  let accountRevenue = getAccountRevenue(account, estimates);
  
  if (accountRevenue <= 0 && account?.annual_revenue) {
    const annualRevenue = typeof account.annual_revenue === 'number' 
      ? account.annual_revenue 
      : parseFloat(account.annual_revenue) || 0;
    if (annualRevenue > 0) {
      accountRevenue = annualRevenue;
    }
  }
  
  if (accountRevenue <= 0 || !totalRevenue || totalRevenue <= 0) {
    return 'C';
  }
  
  const revenuePercentage = (accountRevenue / totalRevenue) * 100;
  
  if (revenuePercentage >= 15) return 'A';
  if (revenuePercentage >= 5) return 'B';
  return 'C';
}

function calculateTotalRevenue(accounts, estimatesByAccountId = {}) {
  return accounts.reduce((total, account) => {
    const estimates = estimatesByAccountId[account.id] || [];
    const revenue = getAccountRevenue(account, estimates);
    return total + revenue;
  }, 0);
}

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL environment variable not set');
    return null;
  }
  
  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    return null;
  }
  
  console.log('✅ Supabase client initialized\n');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function checkBSegmentInApp() {
  console.log('🔍 Checking B Segment Count in LECRM Application (2025)\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ Cannot connect to Supabase. Check environment variables.');
    return;
  }

  try {
    // Fetch all accounts
    console.log('📊 Fetching accounts from database...');
    let allAccounts = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, revenue_segment, annual_revenue, archived, status')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching accounts:', error);
        return;
      }

      if (data && data.length > 0) {
        allAccounts = allAccounts.concat(data);
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Found ${allAccounts.length} total accounts\n`);

    // Filter out archived accounts
    const activeAccounts = allAccounts.filter(acc => !acc.archived);
    console.log(`📊 Active accounts (not archived): ${activeAccounts.length}\n`);

    // Count by segment (as stored in database)
    const segmentCounts = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      null: 0
    };

    activeAccounts.forEach(acc => {
      const segment = acc.revenue_segment || 'null';
      segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Current Segment Counts (from database):\n');
    console.log(`Segment A: ${segmentCounts.A}`);
    console.log(`Segment B: ${segmentCounts.B} ⭐`);
    console.log(`Segment C: ${segmentCounts.C}`);
    console.log(`Segment D: ${segmentCounts.D}`);
    console.log(`No Segment (null): ${segmentCounts.null}\n`);

    // Now fetch estimates to recalculate segments
    console.log('📊 Fetching estimates to recalculate segments...');
    let allEstimates = [];
    page = 0;
    hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, account_id, status, estimate_type, total_price, total_price_with_tax, estimate_date, estimate_close_date, contract_start, contract_end, exclude_stats, archived')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching estimates:', error);
        return;
      }

      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Found ${allEstimates.length} total estimates\n`);

    // Filter estimates for 2025 won estimates (matching Excel logic)
    const won2025Estimates = allEstimates.filter(est => {
      // Must be won
      if (!est.status || est.status.toLowerCase() !== 'won') return false;
      
      // Must not be excluded
      if (est.exclude_stats === true || est.exclude_stats === 'True' || est.exclude_stats === 'true' || est.exclude_stats === 1) return false;
      
      // Must not be archived
      if (est.archived === true || est.archived === 'True' || est.archived === 'true' || est.archived === 1) return false;
      
      // Must have price > 0
      const price = parseFloat(est.total_price_with_tax || est.total_price || 0);
      if (price <= 0) return false;
      
      // Check if applies to 2025
      const yearData = getEstimateYearData(est, CURRENT_YEAR);
      return yearData && yearData.appliesToCurrentYear;
    });

    console.log(`✅ Found ${won2025Estimates.length} won estimates for 2025\n`);

    // Group estimates by account_id
    const estimatesByAccountId = {};
    won2025Estimates.forEach(est => {
      if (est.account_id) {
        const accountId = String(est.account_id).trim();
        if (!estimatesByAccountId[accountId]) {
          estimatesByAccountId[accountId] = [];
        }
        estimatesByAccountId[accountId].push(est);
      }
    });

    // Recalculate segments using the same logic as the app
    console.log('🔄 Recalculating segments using app logic...\n');
    
    // Calculate total revenue
    const totalRevenue = calculateTotalRevenue(activeAccounts, estimatesByAccountId);
    console.log(`💰 Total Revenue (2025): $${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`);

    // Recalculate segments for each account
    const recalculatedSegments = {
      A: [],
      B: [],
      C: [],
      D: []
    };

    activeAccounts.forEach(account => {
      const estimates = estimatesByAccountId[account.id] || [];
      const calculatedSegment = calculateRevenueSegment(account, totalRevenue, estimates);
      const accountRevenue = getAccountRevenue(account, estimates);
      const percentage = totalRevenue > 0 ? (accountRevenue / totalRevenue) * 100 : 0;

      recalculatedSegments[calculatedSegment].push({
        id: account.id,
        name: account.name,
        revenue: accountRevenue,
        percentage: percentage,
        storedSegment: account.revenue_segment
      });
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Recalculated Segment Counts (using app logic):\n');
    console.log(`Segment A (≥15%): ${recalculatedSegments.A.length}`);
    console.log(`Segment B (5-15%): ${recalculatedSegments.B.length} ⭐`);
    console.log(`Segment C (0-5%): ${recalculatedSegments.C.length}`);
    console.log(`Segment D (Project Only): ${recalculatedSegments.D.length}\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ ANSWER: LECRM app shows', recalculatedSegments.B.length, 'B segment clients for 2025\n');

    // Show B segment details
    if (recalculatedSegments.B.length > 0) {
      console.log('📋 B Segment Clients (from app):\n');
      recalculatedSegments.B
        .sort((a, b) => b.revenue - a.revenue)
        .forEach((client, idx) => {
          console.log(`${idx + 1}. ${client.name || 'Unknown'} (ID: ${client.id})`);
          console.log(`   Revenue: $${client.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          console.log(`   Percentage: ${client.percentage.toFixed(2)}%`);
          console.log(`   Stored Segment: ${client.storedSegment || 'null'}`);
          console.log(`   Estimates: ${estimatesByAccountId[client.id]?.length || 0}`);
          console.log('');
        });
    }

    // Compare with expected (5 from Excel)
    const expectedBSegment = 5;
    const actualBSegment = recalculatedSegments.B.length;
    const difference = actualBSegment - expectedBSegment;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 Comparison:\n');
    console.log(`Expected (from Excel): ${expectedBSegment} B segment clients`);
    console.log(`Actual (from app): ${actualBSegment} B segment clients`);
    
    if (difference === 0) {
      console.log(`✅ MATCH! The counts are identical.\n`);
    } else if (difference > 0) {
      console.log(`⚠️  DIFFERENCE: App has ${difference} MORE B segment clients than expected.\n`);
    } else {
      console.log(`⚠️  DIFFERENCE: App has ${Math.abs(difference)} FEWER B segment clients than expected.\n`);
    }

    // Check for mismatches between stored and calculated segments
    const mismatches = [];
    activeAccounts.forEach(account => {
      const estimates = estimatesByAccountId[account.id] || [];
      const calculatedSegment = calculateRevenueSegment(account, totalRevenue, estimates);
      const storedSegment = account.revenue_segment;
      
      if (calculatedSegment !== storedSegment) {
        mismatches.push({
          id: account.id,
          name: account.name,
          stored: storedSegment || 'null',
          calculated: calculatedSegment
        });
      }
    });

    if (mismatches.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`⚠️  Found ${mismatches.length} accounts with mismatched segments:\n`);
      mismatches.slice(0, 10).forEach(m => {
        console.log(`   ${m.name} (ID: ${m.id}): stored="${m.stored}", calculated="${m.calculated}"`);
      });
      if (mismatches.length > 10) {
        console.log(`   ... and ${mismatches.length - 10} more`);
      }
      console.log('\n💡 Tip: Run "Recalculate Segments" in the Accounts page to fix these.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

checkBSegmentInApp().catch(console.error);
