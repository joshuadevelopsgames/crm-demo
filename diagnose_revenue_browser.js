/**
 * Browser-based diagnostic script to identify revenue calculation discrepancies
 * Run this in the browser console on the Accounts page
 * 
 * Usage: Copy and paste this entire script into the browser console
 */

async function diagnoseRevenueDiscrepancy(accountName = 'Royop Development Ltd', selectedYear = 2025) {
  console.log(`\n🔍 Diagnosing revenue discrepancy for: ${accountName} (Year: ${selectedYear})\n`);
  
  // Fetch account
  const accountsResponse = await fetch('/api/data/accounts');
  const accountsResult = await accountsResponse.json();
  const accounts = accountsResult.data || [];
  
  const account = accounts.find(acc => acc.name === accountName);
  if (!account) {
    console.error(`❌ Account "${accountName}" not found`);
    return;
  }
  
  console.log(`✅ Found account: ${account.name} (ID: ${account.id})`);
  console.log(`📊 Stored revenue_by_year:`, account.revenue_by_year);
  const storedRevenue = account.revenue_by_year?.[selectedYear.toString()] || 0;
  console.log(`💰 Stored revenue for ${selectedYear}: $${storedRevenue.toFixed(2)}`);
  
  // Fetch all estimates for this account
  const estimatesResponse = await fetch(`/api/data/estimates?account_id=${encodeURIComponent(account.id)}`);
  const estimatesResult = await estimatesResponse.json();
  const allEstimates = estimatesResult.data || [];
  
  console.log(`\n📋 Total estimates found: ${allEstimates.length}`);
  
  // Import the isWonStatus function logic
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
      'contract signed', 'work complete', 'billing complete', 'email contract award',
      'verbal contract award', 'contract in progress', 'contract + billing complete',
      'sold', 'won'
    ];
    return wonStatuses.includes(statusLower);
  }
  
  // Filter for won estimates
  const wonEstimates = allEstimates.filter(est => isWonStatus(est));
  
  console.log(`✅ Won estimates: ${wonEstimates.length}`);
  console.log(`📦 Archived won estimates: ${wonEstimates.filter(e => e.archived).length}`);
  console.log(`📦 Active won estimates: ${wonEstimates.filter(e => !e.archived).length}`);
  
  // Get year from date string helper
  function getYearFromDateString(dateString) {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      return date.getFullYear();
    } catch {
      return null;
    }
  }
  
  // Calculate duration in months
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
  
  // Get contract years
  function getContractYears(durationMonths) {
    if (durationMonths <= 12) return 1;
    if (durationMonths <= 24) return 2;
    if (durationMonths <= 36) return 3;
    if (durationMonths % 12 === 0) {
      return durationMonths / 12;
    }
    return Math.ceil(durationMonths / 12);
  }
  
  // Calculate revenue for selected year using on-the-fly method (matching the actual code)
  let onTheFlyRevenue = 0;
  const estimateBreakdown = [];
  const excludedEstimates = [];
  
  wonEstimates.forEach(est => {
    // Use the same logic as getEstimateYearData
    const contractEnd = est.contract_end ? new Date(est.contract_end) : null;
    const contractStart = est.contract_start ? new Date(est.contract_start) : null;
    const estimateDate = est.estimate_date ? new Date(est.estimate_date) : null;
    const createdDate = est.created_date ? new Date(est.created_date) : null;
    
    const totalPriceWithTax = parseFloat(est.total_price_with_tax);
    const totalPriceNoTax = parseFloat(est.total_price);
    
    let totalPrice;
    if (isNaN(totalPriceWithTax) || totalPriceWithTax === 0) {
      if (totalPriceNoTax && totalPriceNoTax > 0) {
        totalPrice = totalPriceNoTax;
      } else {
        excludedEstimates.push({
          est,
          reason: 'No price data'
        });
        return;
      }
    } else {
      totalPrice = totalPriceWithTax;
    }
    
    let determinationYear = null;
    let yearDeterminationSource = null;
    
    // Priority 1: contract_end
    if (est.contract_end) {
      determinationYear = getYearFromDateString(est.contract_end);
      if (determinationYear !== null) {
        yearDeterminationSource = 'contract_end';
      }
    }
    // Priority 2: contract_start
    if (determinationYear === null && est.contract_start) {
      determinationYear = getYearFromDateString(est.contract_start);
      if (determinationYear !== null) {
        yearDeterminationSource = 'contract_start';
      }
    }
    // Priority 3: estimate_date
    if (determinationYear === null && est.estimate_date) {
      determinationYear = getYearFromDateString(est.estimate_date);
      if (determinationYear !== null) {
        yearDeterminationSource = 'estimate_date';
      }
    }
    // Priority 4: created_date
    if (determinationYear === null && est.created_date) {
      determinationYear = getYearFromDateString(est.created_date);
      if (determinationYear !== null) {
        yearDeterminationSource = 'created_date';
      }
    }
    
    let appliesToCurrentYear = false;
    let value = 0;
    let contractYears = 1;
    let durationMonths = 0;
    
    // Multi-year contract handling
    if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
      const startYear = getYearFromDateString(est.contract_start);
      if (startYear === null) {
        excludedEstimates.push({
          est,
          reason: 'Multi-year contract but invalid start year'
        });
        return;
      }
      
      durationMonths = calculateDurationMonths(contractStart, contractEnd);
      if (durationMonths <= 0) {
        excludedEstimates.push({
          est,
          reason: 'Invalid contract duration'
        });
        return;
      }
      
      contractYears = getContractYears(durationMonths);
      const annualAmount = totalPrice / contractYears;
      
      // Allocate to sequential calendar years
      const yearsApplied = [];
      for (let i = 0; i < contractYears; i++) {
        yearsApplied.push(startYear + i);
      }
      appliesToCurrentYear = yearsApplied.includes(selectedYear);
      value = appliesToCurrentYear ? annualAmount : 0;
    } else if (determinationYear !== null) {
      appliesToCurrentYear = selectedYear === determinationYear;
      value = appliesToCurrentYear ? totalPrice : 0;
    } else {
      // No dates at all - treat as applying to current year
      appliesToCurrentYear = true;
      value = totalPrice;
    }
    
    if (appliesToCurrentYear && value > 0) {
      onTheFlyRevenue += value;
      
      estimateBreakdown.push({
        id: est.id,
        estimate_number: est.estimate_number,
        total_price_with_tax: est.total_price_with_tax,
        total_price: est.total_price,
        totalPrice,
        contract_start: est.contract_start,
        contract_end: est.contract_end,
        estimate_date: est.estimate_date,
        created_date: est.created_date,
        archived: est.archived,
        determinationYear,
        yearDeterminationSource,
        contractYears,
        durationMonths,
        annualAmount: value,
        appliesToCurrentYear
      });
    } else if (value === 0 && appliesToCurrentYear === false) {
      excludedEstimates.push({
        est,
        reason: `Does not apply to ${selectedYear} (determined year: ${determinationYear})`
      });
    }
  });
  
  console.log(`\n💰 On-the-fly calculated revenue for ${selectedYear}: $${onTheFlyRevenue.toFixed(2)}`);
  console.log(`📊 Stored revenue for ${selectedYear}: $${storedRevenue.toFixed(2)}`);
  const difference = storedRevenue - onTheFlyRevenue;
  console.log(`\n📉 Difference: $${difference.toFixed(2)}`);
  
  console.log(`\n📋 Estimate Breakdown (${estimateBreakdown.length} estimates contributing to ${selectedYear}):`);
  estimateBreakdown.forEach((est, idx) => {
    console.log(`\n  ${idx + 1}. Estimate ${est.estimate_number || est.id}:`);
    console.log(`     - Amount: $${est.annualAmount.toFixed(2)}`);
    console.log(`     - Total Price: $${est.totalPrice.toFixed(2)}`);
    console.log(`     - Contract Years: ${est.contractYears} (${est.durationMonths} months)`);
    console.log(`     - Year Source: ${est.yearDeterminationSource} (${est.determinationYear})`);
    console.log(`     - Archived: ${est.archived}`);
    console.log(`     - Dates: start=${est.contract_start}, end=${est.contract_end}, estimate=${est.estimate_date}, created=${est.created_date}`);
  });
  
  if (excludedEstimates.length > 0) {
    console.log(`\n🚫 Excluded Estimates (${excludedEstimates.length}):`);
    excludedEstimates.forEach((item, idx) => {
      console.log(`\n  ${idx + 1}. Estimate ${item.est.estimate_number || item.est.id}: ${item.reason}`);
      console.log(`     - Total Price: $${(parseFloat(item.est.total_price_with_tax) || parseFloat(item.est.total_price) || 0).toFixed(2)}`);
      console.log(`     - Dates: start=${item.est.contract_start}, end=${item.est.contract_end}`);
    });
  }
  
  // Summary
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Stored Revenue: $${storedRevenue.toFixed(2)}`);
  console.log(`   On-the-fly Revenue: $${onTheFlyRevenue.toFixed(2)}`);
  console.log(`   Difference: $${difference.toFixed(2)}`);
  console.log(`   Contributing Estimates: ${estimateBreakdown.length}`);
  console.log(`   Excluded Estimates: ${excludedEstimates.length}`);
  
  return {
    account,
    storedRevenue,
    onTheFlyRevenue,
    difference,
    estimateBreakdown,
    excludedEstimates,
    allWonEstimates: wonEstimates.length
  };
}

// Make it available globally
window.diagnoseRevenueDiscrepancy = diagnoseRevenueDiscrepancy;

console.log('✅ Diagnostic function loaded! Run: diagnoseRevenueDiscrepancy("Royop Development Ltd", 2025)');

