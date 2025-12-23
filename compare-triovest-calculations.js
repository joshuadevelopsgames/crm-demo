import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Contract-year allocation logic (same as TotalWork.jsx)
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
  
  // Case 1: Both contract_start and contract_end exist
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
        ? `Contract: ${startYear}-${startYear + yearsCount - 1} (${yearsCount} years, ${durationMonths} months, $${annualAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per year)`
        : `Contract: ${startYear} (1 year, ${durationMonths} months)`
    };
  }
  
  // Case 2: Only contract_start exists
  if (contractStart && !isNaN(contractStart.getTime())) {
    const startYear = contractStart.getFullYear();
    const appliesToCurrentYear = currentYear === startYear;
    return {
      appliesToCurrentYear,
      value: totalPrice,
      determinationMethod: `Contract Start: ${startYear}`
    };
  }
  
  // Case 3: No contract dates, use estimate_date
  if (estimateDate && !isNaN(estimateDate.getTime())) {
    const estimateYear = estimateDate.getFullYear();
    const appliesToCurrentYear = currentYear === estimateYear;
    return {
      appliesToCurrentYear,
      value: totalPrice,
      determinationMethod: `Estimate Date: ${estimateYear}`
    };
  }
  
  return null;
}

// Parse Excel file
const filePath = join(__dirname, '../Downloads/Triovest Estimates List.xlsx');
console.log('Reading file:', filePath);

const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' });
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

const headers = rows[0];
const colMap = {
  estimateId: headers.findIndex(h => h === 'Estimate ID'),
  estimateDate: headers.findIndex(h => h === 'Estimate Date'),
  contractStart: headers.findIndex(h => h === 'Contract Start'),
  contractEnd: headers.findIndex(h => h === 'Contract End'),
  totalPrice: headers.findIndex(h => h === 'Total Price'),
  totalPriceWithTax: headers.findIndex(h => h === 'Total Price With Tax'),
  status: headers.findIndex(h => h === 'Status')
};

const currentYear = 2025;
const estimates = [];
const allEstimates = [];

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  
  const estimateId = row[colMap.estimateId]?.toString().trim();
  if (!estimateId) continue;
  
  const parseDate = (value) => {
    if (!value) return null;
    if (typeof value === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return null;
  };
  
  const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : parseFloat(value);
    return isNaN(num) ? null : num;
  };
  
  const estimate = {
    estimate_id: estimateId,
    estimate_date: parseDate(row[colMap.estimateDate]),
    contract_start: parseDate(row[colMap.contractStart]),
    contract_end: parseDate(row[colMap.contractEnd]),
    total_price: parseNumber(row[colMap.totalPrice]),
    total_price_with_tax: parseNumber(row[colMap.totalPriceWithTax]),
    status: row[colMap.status]?.toString().trim() || ''
  };
  
  allEstimates.push(estimate);
  
  const yearData = getEstimateYearData(estimate, currentYear);
  const systemPrice = parseFloat(estimate.total_price_with_tax) || parseFloat(estimate.total_price) || 0;
  
  // Track estimates that should be included but aren't
  const systemPrice = parseFloat(estimate.total_price_with_tax) || parseFloat(estimate.total_price) || 0;
  if (systemPrice > 0 && (!yearData || !yearData.appliesToCurrentYear)) {
    // This estimate has a price but isn't being included - log it
    if (!yearData) {
      // Missing date info
    } else if (!yearData.appliesToCurrentYear) {
      // Has date but doesn't apply to 2025
    }
  }
  
  if (yearData && yearData.appliesToCurrentYear) {
    estimates.push({
      estimate_id: estimateId,
      total_price: estimate.total_price || 0,
      total_price_with_tax: estimate.total_price_with_tax || 0,
      system_uses: systemPrice === estimate.total_price_with_tax ? 'total_price_with_tax' : 'total_price',
      system_value: yearData.value,
      full_amount: systemPrice,
      determination_method: yearData.determinationMethod,
      is_multi_year: yearData.determinationMethod.includes('2 years') || yearData.determinationMethod.includes('3 years')
    });
  }
}

// Calculate different totals
const totalUsingTotalPrice = estimates.reduce((sum, e) => sum + e.total_price, 0);
const totalUsingTotalPriceWithTax = estimates.reduce((sum, e) => sum + e.total_price_with_tax, 0);
const totalSystemCalculation = estimates.reduce((sum, e) => sum + e.system_value, 0);

// Calculate using full amounts (no annualization) for multi-year contracts
const totalUsingFullAmounts = estimates.reduce((sum, e) => {
  return sum + (e.is_multi_year ? e.full_amount : e.system_value);
}, 0);

console.log('\n=== CALCULATION COMPARISON ===\n');
console.log(`Total estimates included: ${estimates.length}`);
console.log(`\nMETHOD 1: Sum of "Total Price" column`);
console.log(`  Result: $${totalUsingTotalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
console.log(`\nMETHOD 2: Sum of "Total Price With Tax" column`);
console.log(`  Result: $${totalUsingTotalPriceWithTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
console.log(`\nMETHOD 3: System calculation (contract-year allocation, uses total_price_with_tax || total_price)`);
console.log(`  Result: $${totalSystemCalculation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
console.log(`\nMETHOD 4: Using full amounts for multi-year contracts (no annualization)`);
console.log(`  Result: $${totalUsingFullAmounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

console.log(`\n=== YOUR MANUAL CALCULATION vs SYSTEM ===\n`);
console.log(`Your manual calculation: $778,118.00`);
console.log(`System calculation: $788,380.67`);
console.log(`Difference: $${(788380.67 - 778118).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

console.log(`\n=== BREAKDOWN OF DIFFERENCES ===\n`);

// Check which method matches your $778,118
const yourTotal = 778118;
const diff1 = Math.abs(totalUsingTotalPrice - yourTotal);
const diff2 = Math.abs(totalUsingTotalPriceWithTax - yourTotal);
const diff3 = Math.abs(totalSystemCalculation - yourTotal);
const diff4 = Math.abs(totalUsingFullAmounts - yourTotal);

console.log(`Difference from your $778,118:`);
console.log(`  Method 1 (Total Price): $${diff1.toFixed(2)} ${diff1 < 1 ? '✅ MATCH!' : ''}`);
console.log(`  Method 2 (Total Price With Tax): $${diff2.toFixed(2)} ${diff2 < 1 ? '✅ MATCH!' : ''}`);
console.log(`  Method 3 (System - contract-year allocation): $${diff3.toFixed(2)} ${diff3 < 1 ? '✅ MATCH!' : ''}`);
console.log(`  Method 4 (Full amounts, no annualization): $${diff4.toFixed(2)} ${diff4 < 1 ? '✅ MATCH!' : ''}`);

// Find estimates with tax differences
const taxDifferences = estimates.filter(e => e.total_price > 0 && e.total_price_with_tax > 0 && Math.abs(e.total_price - e.total_price_with_tax) > 0.01);
const totalTaxAmount = taxDifferences.reduce((sum, e) => sum + (e.total_price_with_tax - e.total_price), 0);

console.log(`\n=== TAX DIFFERENCES ===\n`);
console.log(`Estimates with tax: ${taxDifferences.length}`);
console.log(`Total tax amount: $${totalTaxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
if (taxDifferences.length > 0 && taxDifferences.length <= 20) {
  taxDifferences.forEach(e => {
    const tax = e.total_price_with_tax - e.total_price;
    console.log(`  ${e.estimate_id}: Price=$${e.total_price.toFixed(2)}, WithTax=$${e.total_price_with_tax.toFixed(2)}, Tax=$${tax.toFixed(2)}`);
  });
}

// Find multi-year contracts
const multiYearContracts = estimates.filter(e => e.is_multi_year);
const multiYearFullTotal = multiYearContracts.reduce((sum, e) => sum + e.full_amount, 0);
const multiYearAllocatedTotal = multiYearContracts.reduce((sum, e) => sum + e.system_value, 0);
const multiYearDifference = multiYearFullTotal - multiYearAllocatedTotal;

console.log(`\n=== MULTI-YEAR CONTRACTS ===\n`);
console.log(`Multi-year contracts: ${multiYearContracts.length}`);
console.log(`Full amount total: $${multiYearFullTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
console.log(`Allocated to 2025: $${multiYearAllocatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
console.log(`Difference (allocated to other years): $${multiYearDifference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
if (multiYearContracts.length > 0 && multiYearContracts.length <= 20) {
  multiYearContracts.forEach(e => {
    const diff = e.full_amount - e.system_value;
    console.log(`  ${e.estimate_id}: Full=$${e.full_amount.toFixed(2)}, 2025=$${e.system_value.toFixed(2)}, Other years=$${diff.toFixed(2)}`);
  });
}

// Summary
console.log(`\n=== SUMMARY ===\n`);
console.log(`If you used "Total Price" column: $${totalUsingTotalPrice.toFixed(2)}`);
console.log(`  Difference from your $778,118: $${(totalUsingTotalPrice - yourTotal).toFixed(2)}`);
console.log(`\nIf you used "Total Price With Tax" column: $${totalUsingTotalPriceWithTax.toFixed(2)}`);
console.log(`  Difference from your $778,118: $${(totalUsingTotalPriceWithTax - yourTotal).toFixed(2)}`);
console.log(`\nSystem uses: total_price_with_tax || total_price (whichever exists)`);
console.log(`  Then applies contract-year allocation (splits multi-year contracts)`);
console.log(`  System total: $${totalSystemCalculation.toFixed(2)}`);
console.log(`  Difference from your $778,118: $${(totalSystemCalculation - yourTotal).toFixed(2)}`);

