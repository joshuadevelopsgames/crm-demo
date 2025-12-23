/**
 * Compare user's estimate list with system calculation
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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

// User's estimate list
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

// Copy calculation functions
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

async function compareEstimates() {
  console.log('🔍 Comparing user\'s estimate list with system calculation...\n');
  console.log(`📋 User provided ${userEstimateIds.length} estimate IDs\n`);
  
  // Find Triovest account
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name')
    .ilike('name', '%Triovest%');
  
  if (!accounts || accounts.length === 0) {
    console.error('❌ Could not find Triovest account');
    return;
  }
  
  const account = accounts[0];
  console.log(`📋 Account: ${account.name}\n`);
  
  // Get all estimates for this account
  const { data: allEstimates } = await supabase
    .from('estimates')
    .select('*')
    .eq('account_id', account.id);
  
  // Create a map of estimates by lmn_estimate_id
  const estimatesMap = new Map();
  allEstimates.forEach(est => {
    const estId = est.lmn_estimate_id || est.estimate_number;
    if (estId) {
      estimatesMap.set(estId.toUpperCase(), est);
    }
  });
  
  const currentYear = 2025;
  
  // Find estimates from user's list
  const foundEstimates = [];
  const missingEstimates = [];
  
  userEstimateIds.forEach(userEstId => {
    const est = estimatesMap.get(userEstId.toUpperCase());
    if (est) {
      foundEstimates.push(est);
    } else {
      missingEstimates.push(userEstId);
    }
  });
  
  console.log(`✅ Found in database: ${foundEstimates.length} estimates`);
  console.log(`❌ Missing from database: ${missingEstimates.length} estimates`);
  if (missingEstimates.length > 0) {
    console.log(`   Missing IDs: ${missingEstimates.join(', ')}\n`);
  }
  
  // Calculate using user's estimates
  const userIncluded = [];
  const userExcluded = [];
  
  foundEstimates.forEach(est => {
    const yearData = getEstimateYearData(est, currentYear);
    const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
    
    if (totalPrice === 0) {
      userExcluded.push({ est, reason: 'Total price is $0' });
      return;
    }
    
    if (!yearData) {
      userExcluded.push({ est, reason: 'No valid date', totalPrice });
      return;
    }
    
    if (yearData.appliesToCurrentYear) {
      userIncluded.push({
        est,
        estId: est.lmn_estimate_id || est.estimate_number || est.id,
        totalPrice,
        value: yearData.value,
        method: yearData.determinationMethod
      });
    } else {
      userExcluded.push({ 
        est, 
        estId: est.lmn_estimate_id || est.estimate_number || est.id,
        reason: `Does not apply to ${currentYear}`, 
        totalPrice, 
        method: yearData.determinationMethod 
      });
    }
  });
  
  const userTotal = userIncluded.reduce((sum, item) => sum + item.value, 0);
  
  // Get system's included estimates
  const systemIncluded = [];
  allEstimates.forEach(est => {
    const yearData = getEstimateYearData(est, currentYear);
    const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
    
    if (totalPrice === 0 || !yearData || !yearData.appliesToCurrentYear) {
      return;
    }
    
    systemIncluded.push({
      est,
      estId: est.lmn_estimate_id || est.estimate_number || est.id,
      totalPrice,
      value: yearData.value,
      method: yearData.determinationMethod
    });
  });
  
  const systemTotal = systemIncluded.reduce((sum, item) => sum + item.value, 0);
  
  // Find estimates in system but not in user's list
  const systemEstimateIds = new Set(systemIncluded.map(item => item.estId.toUpperCase()));
  const userEstimateIdsSet = new Set(userEstimateIds.map(id => id.toUpperCase()));
  const inSystemNotInUser = systemIncluded.filter(item => !userEstimateIdsSet.has(item.estId.toUpperCase()));
  
  // Find estimates in user's list but not in system's included
  const inUserNotInSystem = userIncluded.filter(item => !systemEstimateIds.has(item.estId.toUpperCase()));
  
  console.log('='.repeat(80));
  console.log('📊 COMPARISON RESULTS');
  console.log('='.repeat(80));
  console.log();
  console.log(`USER'S CALCULATION (using provided ${userEstimateIds.length} estimates):`);
  console.log(`  Total: $${userTotal.toFixed(2)}`);
  console.log(`  Expected: $778,118.67`);
  console.log(`  Difference: $${(userTotal - 778118.67).toFixed(2)}`);
  console.log(`  Included: ${userIncluded.length} estimates`);
  console.log(`  Excluded: ${userExcluded.length} estimates`);
  console.log();
  console.log(`SYSTEM'S CALCULATION (all estimates for account):`);
  console.log(`  Total: $${systemTotal.toFixed(2)}`);
  console.log(`  Included: ${systemIncluded.length} estimates`);
  console.log();
  console.log(`DIFFERENCES:`);
  console.log(`  In system but NOT in user's list: ${inSystemNotInUser.length} estimates`);
  if (inSystemNotInUser.length > 0) {
    console.log(`  These estimates add: $${inSystemNotInUser.reduce((sum, item) => sum + item.value, 0).toFixed(2)}`);
    console.log(`  Top 5:`);
    inSystemNotInUser
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .forEach((item, idx) => {
        console.log(`    ${idx + 1}. ${item.estId}: $${item.value.toFixed(2)} (${item.method})`);
      });
  }
  console.log();
  console.log(`  In user's list but NOT in system's included: ${inUserNotInSystem.length} estimates`);
  if (inUserNotInSystem.length > 0) {
    console.log(`  These estimates: $${inUserNotInSystem.reduce((sum, item) => sum + item.value, 0).toFixed(2)}`);
    inUserNotInSystem.forEach((item, idx) => {
      console.log(`    ${idx + 1}. ${item.estId}: $${item.value.toFixed(2)} (${item.method})`);
    });
  }
  console.log();
  
  // Show user's estimates that are excluded
  if (userExcluded.length > 0) {
    console.log(`USER'S ESTIMATES THAT ARE EXCLUDED:`);
    userExcluded.forEach((item, idx) => {
      const estId = item.est?.lmn_estimate_id || item.est?.estimate_number || item.est?.id || item.estId || 'Unknown';
      console.log(`  ${idx + 1}. ${estId}: ${item.reason}`);
      if (item.totalPrice > 0) {
        console.log(`      Total Price: $${item.totalPrice.toFixed(2)}`);
      }
      if (item.method) {
        console.log(`      Method: ${item.method}`);
      }
    });
    console.log();
  }
}

compareEstimates().catch(console.error);

