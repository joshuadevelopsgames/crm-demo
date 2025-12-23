/**
 * Debug script to analyze Triovest Realty Advisors Ltd totals
 * 
 * This script will help identify why the totals don't match:
 * Expected: Estimated $778,118.67, Sold $330,789.72
 * Current:  Estimated $788,104.30, Sold $318,215.32
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Load .env if it exists
try {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
} catch (error) {
  // Silently fail
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Copy the calculation functions from TotalWork.jsx
function calculateDurationMonths(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const dayDiff = end.getDate() - start.getDate();
  let totalMonths = yearDiff * 12 + monthDiff;
  if (dayDiff >= 0) {
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

function getEstimateYearData(estimate, currentYear, useOnlyTaxPrice = false) {
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  
  // If useOnlyTaxPrice is true, only use total_price_with_tax (no fallback)
  const totalPrice = useOnlyTaxPrice 
    ? (estimate.total_price_with_tax ? parseFloat(estimate.total_price_with_tax) : null)
    : (parseFloat(estimate.total_price_with_tax) || parseFloat(estimate.total_price) || 0);
  
  if (totalPrice === null || totalPrice === 0) return null;
  
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
    
    return {
      appliesToCurrentYear,
      value: appliesToCurrentYear ? annualAmount : 0,
      determinationMethod: yearsCount > 1
        ? `Contract: ${startYear}-${startYear + yearsCount - 1} (${yearsCount} years)`
        : `Contract: ${startYear} (1 year)`
    };
  }
  
  if (contractStart && !isNaN(contractStart.getTime())) {
    const startYear = contractStart.getFullYear();
    return {
      appliesToCurrentYear: currentYear === startYear,
      value: totalPrice,
      determinationMethod: `Contract Start: ${startYear}`
    };
  }
  
  if (estimateDate && !isNaN(estimateDate.getTime())) {
    const estimateYear = estimateDate.getFullYear();
    return {
      appliesToCurrentYear: currentYear === estimateYear,
      value: totalPrice,
      determinationMethod: `Estimate Date: ${estimateYear}`
    };
  }
  
  return null;
}

async function analyzeTriovest() {
  console.log('🔍 Analyzing Triovest Realty Advisors Ltd totals...\n');
  
  // Find the account
  const { data: accounts, error: accountError } = await supabase
    .from('accounts')
    .select('id, name')
    .ilike('name', '%Triovest%');
  
  if (accountError || !accounts || accounts.length === 0) {
    console.error('❌ Could not find Triovest account');
    return;
  }
  
  const account = accounts[0];
  console.log(`📋 Account: ${account.name} (ID: ${account.id})\n`);
  
  // Get all estimates for this account
  const { data: estimates, error: estimatesError } = await supabase
    .from('estimates')
    .select('*')
    .eq('account_id', account.id);
  
  if (estimatesError) {
    console.error('❌ Error fetching estimates:', estimatesError);
    return;
  }
  
  console.log(`📊 Total estimates for account: ${estimates.length}\n`);
  
  const currentYear = 2025;
  
  // Calculate ESTIMATED breakdown - CURRENT METHOD (with tax, fallback to without tax)
  const estimatedIncluded = [];
  const estimatedExcluded = [];
  
  estimates.forEach(est => {
    const yearData = getEstimateYearData(est, currentYear, false);
    const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
    
    if (totalPrice === 0) {
      estimatedExcluded.push({ est, reason: 'Total price is $0' });
      return;
    }
    
    if (!yearData) {
      estimatedExcluded.push({ est, reason: 'No valid date', totalPrice });
      return;
    }
    
    if (yearData.appliesToCurrentYear) {
      estimatedIncluded.push({
        est,
        totalPrice,
        value: yearData.value,
        method: yearData.determinationMethod
      });
    } else {
      estimatedExcluded.push({ est, reason: `Does not apply to ${currentYear}`, totalPrice, method: yearData.determinationMethod });
    }
  });
  
  // Calculate SOLD breakdown (won estimates only)
  const soldIncluded = [];
  const soldExcluded = [];
  
  estimates
    .filter(est => est.status === 'won')
    .forEach(est => {
      const yearData = getEstimateYearData(est, currentYear);
      const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
      
      if (totalPrice === 0) {
        soldExcluded.push({ est, reason: 'Total price is $0' });
        return;
      }
      
      if (!yearData) {
        soldExcluded.push({ est, reason: 'No valid date', totalPrice });
        return;
      }
      
      if (yearData.appliesToCurrentYear) {
        soldIncluded.push({
          est,
          totalPrice,
          value: yearData.value,
          method: yearData.determinationMethod
        });
      } else {
        soldExcluded.push({ est, reason: `Does not apply to ${currentYear}`, totalPrice, method: yearData.determinationMethod });
      }
    });
  
  const totalEstimated = estimatedIncluded.reduce((sum, item) => sum + item.value, 0);
  const totalSold = soldIncluded.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate ESTIMATED breakdown - ONLY total_price_with_tax (no fallback)
  const estimatedIncludedTaxOnly = [];
  const estimatedExcludedTaxOnly = [];
  
  estimates.forEach(est => {
    const yearData = getEstimateYearData(est, currentYear, true);
    const totalPrice = est.total_price_with_tax ? parseFloat(est.total_price_with_tax) : null;
    
    if (totalPrice === null || totalPrice === 0) {
      estimatedExcludedTaxOnly.push({ est, reason: 'No total_price_with_tax available' });
      return;
    }
    
    if (!yearData) {
      estimatedExcludedTaxOnly.push({ est, reason: 'No valid date', totalPrice });
      return;
    }
    
    if (yearData.appliesToCurrentYear) {
      estimatedIncludedTaxOnly.push({
        est,
        totalPrice,
        value: yearData.value,
        method: yearData.determinationMethod
      });
    } else {
      estimatedExcludedTaxOnly.push({ est, reason: `Does not apply to ${currentYear}`, totalPrice, method: yearData.determinationMethod });
    }
  });
  
  // Calculate SOLD breakdown - ONLY total_price_with_tax (no fallback)
  const soldIncludedTaxOnly = [];
  const soldExcludedTaxOnly = [];
  
  estimates
    .filter(est => est.status === 'won')
    .forEach(est => {
      const yearData = getEstimateYearData(est, currentYear, true);
      const totalPrice = est.total_price_with_tax ? parseFloat(est.total_price_with_tax) : null;
      
      if (totalPrice === null || totalPrice === 0) {
        soldExcludedTaxOnly.push({ est, reason: 'No total_price_with_tax available' });
        return;
      }
      
      if (!yearData) {
        soldExcludedTaxOnly.push({ est, reason: 'No valid date', totalPrice });
        return;
      }
      
      if (yearData.appliesToCurrentYear) {
        soldIncludedTaxOnly.push({
          est,
          totalPrice,
          value: yearData.value,
          method: yearData.determinationMethod
        });
      } else {
        soldExcludedTaxOnly.push({ est, reason: `Does not apply to ${currentYear}`, totalPrice, method: yearData.determinationMethod });
      }
    });
  
  const totalEstimatedTaxOnly = estimatedIncludedTaxOnly.reduce((sum, item) => sum + item.value, 0);
  const totalSoldTaxOnly = soldIncludedTaxOnly.reduce((sum, item) => sum + item.value, 0);
  
  console.log('='.repeat(80));
  console.log('📊 CALCULATION RESULTS - CURRENT METHOD (with_tax || without_tax)');
  console.log('='.repeat(80));
  console.log();
  console.log(`ESTIMATED: $${totalEstimated.toFixed(2)}`);
  console.log(`  Expected: $778,118.67`);
  console.log(`  Difference: $${(totalEstimated - 778118.67).toFixed(2)}`);
  console.log(`  Included: ${estimatedIncluded.length} estimates`);
  console.log();
  console.log(`SOLD: $${totalSold.toFixed(2)}`);
  console.log(`  Expected: $330,789.72`);
  console.log(`  Difference: $${(totalSold - 330789.72).toFixed(2)}`);
  console.log(`  Included: ${soldIncluded.length} won estimates`);
  console.log();
  console.log('='.repeat(80));
  console.log('📊 CALCULATION RESULTS - ONLY total_price_with_tax (NO FALLBACK)');
  console.log('='.repeat(80));
  console.log();
  console.log(`ESTIMATED: $${totalEstimatedTaxOnly.toFixed(2)}`);
  console.log(`  Expected: $778,118.67`);
  console.log(`  Difference: $${(totalEstimatedTaxOnly - 778118.67).toFixed(2)}`);
  console.log(`  Included: ${estimatedIncludedTaxOnly.length} estimates`);
  console.log(`  Excluded (no tax price): ${estimatedExcludedTaxOnly.filter(e => e.reason === 'No total_price_with_tax available').length} estimates`);
  console.log();
  console.log(`SOLD: $${totalSoldTaxOnly.toFixed(2)}`);
  console.log(`  Expected: $330,789.72`);
  console.log(`  Difference: $${(totalSoldTaxOnly - 330789.72).toFixed(2)}`);
  console.log(`  Included: ${soldIncludedTaxOnly.length} won estimates`);
  console.log(`  Excluded (no tax price): ${soldExcludedTaxOnly.filter(e => e.reason === 'No total_price_with_tax available').length} won estimates`);
  console.log();
  
  // Show top estimates by value to identify discrepancies
  console.log('TOP 10 ESTIMATED (by value):');
  estimatedIncluded
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .forEach((item, idx) => {
      const estId = item.est.lmn_estimate_id || item.est.estimate_number || item.est.id;
      console.log(`  ${idx + 1}. ${estId}: $${item.value.toFixed(2)} (Total: $${item.totalPrice.toFixed(2)}, Method: ${item.method})`);
    });
  console.log();
  
  // Check for estimates that might be incorrectly included
  console.log('ESTIMATES WITH VALUE != TOTAL PRICE (multi-year contracts):');
  const multiYear = estimatedIncluded.filter(item => Math.abs(item.value - item.totalPrice) > 0.01);
  console.log(`  Found ${multiYear.length} multi-year contracts`);
  multiYear.slice(0, 5).forEach(item => {
    const estId = item.est.lmn_estimate_id || item.est.estimate_number || item.est.id;
    console.log(`    ${estId}: Total $${item.totalPrice.toFixed(2)} → Value $${item.value.toFixed(2)} (${item.method})`);
  });
  console.log();
  
  // Export detailed breakdown to file
  const breakdown = {
    account: account.name,
    currentYear,
    estimated: {
      total: totalEstimated,
      included: estimatedIncluded.map(item => ({
        id: item.est.lmn_estimate_id || item.est.estimate_number || item.est.id,
        totalPrice: item.totalPrice,
        value: item.value,
        method: item.method
      })),
      excluded: estimatedExcluded.map(item => ({
        id: item.est.lmn_estimate_id || item.est.estimate_number || item.est.id,
        reason: item.reason,
        totalPrice: item.totalPrice || 0
      }))
    },
    sold: {
      total: totalSold,
      included: soldIncluded.map(item => ({
        id: item.est.lmn_estimate_id || item.est.estimate_number || item.est.id,
        totalPrice: item.totalPrice,
        value: item.value,
        method: item.method
      })),
      excluded: soldExcluded.map(item => ({
        id: item.est.lmn_estimate_id || item.est.estimate_number || item.est.id,
        reason: item.reason,
        totalPrice: item.totalPrice || 0
      }))
    }
  };
  
  const fs = await import('fs');
  fs.writeFileSync('triovest_breakdown.json', JSON.stringify(breakdown, null, 2));
  console.log('✅ Detailed breakdown saved to triovest_breakdown.json');
}

analyzeTriovest().catch(console.error);

