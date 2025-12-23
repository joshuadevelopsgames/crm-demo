/**
 * Detailed breakdown of user's estimates to find the $5,733 discrepancy
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load .env
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
} catch (error) {}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const userEstimateIds = [
  'EST2948972', 'EST2949003', 'EST2949022', 'EST3015462', 'EST3015636',
  'EST3015715', 'EST3015813', 'EST3270334', 'EST3270368', 'EST3270381',
  'EST3270794', 'EST3299572', 'EST5206145', 'EST5255379', 'EST5255410',
  'EST5263149', 'EST5334039', 'EST5334065', 'EST5334084', 'EST5334122',
  'EST5334212', 'EST5334226', 'EST5334250', 'EST5334273', 'EST5367065',
  'EST5432414', 'EST5432422', 'EST5436938', 'EST5450635', 'EST5450865',
  'EST5455650', 'EST5456796', 'EST5457122', 'EST5482169', 'EST5492918',
  'EST5492965', 'EST5497919', 'EST5507681', 'EST5552200', 'EST5554724',
  'EST5554750', 'EST5560678', 'EST5562364', 'EST5562797', 'EST5566837',
  'EST5567905', 'EST5575757', 'EST5599711', 'EST5609396', 'EST5649036',
  'EST5669644', 'EST5669679', 'EST5770259', 'EST5770273', 'EST5814054',
  'EST5838658', 'EST5850652', 'EST5850683', 'EST5850702', 'EST5850726',
  'EST5850755', 'EST5850780', 'EST5850796', 'EST5850847', 'EST5850859',
  'EST5850874', 'EST5850892', 'EST5850908', 'EST5850929', 'EST5850941',
  'EST5850958', 'EST5850973', 'EST5850994'
];

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

function getEstimateYearData(estimate, currentYear) {
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  
  const totalPrice = parseFloat(estimate.total_price_with_tax) || parseFloat(estimate.total_price) || 0;
  if (totalPrice === 0) return null;
  
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

async function analyzeUserEstimates() {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name')
    .ilike('name', '%Triovest%');
  
  const account = accounts[0];
  const { data: allEstimates } = await supabase
    .from('estimates')
    .select('*')
    .eq('account_id', account.id);
  
  const estimatesMap = new Map();
  allEstimates.forEach(est => {
    const estId = est.lmn_estimate_id || est.estimate_number;
    if (estId) {
      estimatesMap.set(estId.toUpperCase(), est);
    }
  });
  
  const currentYear = 2025;
  const results = [];
  
  userEstimateIds.forEach(userEstId => {
    const est = estimatesMap.get(userEstId.toUpperCase());
    if (!est) return;
    
    const yearData = getEstimateYearData(est, currentYear);
    const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
    const totalPriceNoTax = parseFloat(est.total_price) || 0;
    const totalPriceWithTax = parseFloat(est.total_price_with_tax) || 0;
    
    if (totalPrice === 0 || !yearData || !yearData.appliesToCurrentYear) {
      return;
    }
    
    results.push({
      id: userEstId,
      totalPrice,
      totalPriceNoTax,
      totalPriceWithTax,
      value: yearData.value,
      method: yearData.determinationMethod,
      difference: totalPrice - yearData.value
    });
  });
  
  const total = results.reduce((sum, item) => sum + item.value, 0);
  const totalUsingNoTax = results.reduce((sum, item) => sum + (item.totalPriceNoTax || 0), 0);
  const totalUsingWithTax = results.reduce((sum, item) => sum + (item.totalPriceWithTax || 0), 0);
  
  console.log('='.repeat(80));
  console.log('DETAILED BREAKDOWN OF USER\'S ESTIMATES');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total using system calculation: $${total.toFixed(2)}`);
  console.log(`Total using total_price (no tax): $${totalUsingNoTax.toFixed(2)}`);
  console.log(`Total using total_price_with_tax: $${totalUsingWithTax.toFixed(2)}`);
  console.log(`Expected: $778,118.67`);
  console.log();
  console.log(`Difference from expected:`);
  console.log(`  System calc: $${(total - 778118.67).toFixed(2)}`);
  console.log(`  Using no tax: $${(totalUsingNoTax - 778118.67).toFixed(2)}`);
  console.log(`  Using with tax: $${(totalUsingWithTax - 778118.67).toFixed(2)}`);
  console.log();
  
  // Show estimates where value != totalPrice (multi-year contracts)
  const multiYear = results.filter(item => Math.abs(item.value - item.totalPrice) > 0.01);
  console.log(`Multi-year contracts (${multiYear.length}):`);
  multiYear.forEach(item => {
    console.log(`  ${item.id}: Total $${item.totalPrice.toFixed(2)} → Value $${item.value.toFixed(2)} (${item.method})`);
  });
  console.log();
  
  // Show estimates sorted by value
  console.log('All estimates sorted by value:');
  results
    .sort((a, b) => b.value - a.value)
    .forEach((item, idx) => {
      const taxNote = item.totalPriceWithTax && item.totalPriceNoTax && Math.abs(item.totalPriceWithTax - item.totalPriceNoTax) > 0.01
        ? ` (tax diff: $${(item.totalPriceWithTax - item.totalPriceNoTax).toFixed(2)})`
        : '';
      console.log(`  ${idx + 1}. ${item.id}: $${item.value.toFixed(2)}${taxNote}`);
    });
}

analyzeUserEstimates().catch(console.error);

