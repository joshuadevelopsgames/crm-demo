#!/usr/bin/env node

/**
 * Investigate why BentallGreenOak (ID: 2746052) shows as B segment in Excel but C in app
 */

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { join } from 'path';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });
dotenv.config({ path: join(__dirname, '.env') });

const CURRENT_YEAR = 2025;
const TARGET_ACCOUNT_ID = '2746052';

function getYearFromDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
    return date.getUTCFullYear();
  }
  if (dateValue instanceof Date) {
    return dateValue.getFullYear();
  }
  const dateStr = String(dateValue);
  if (dateStr.length >= 4) {
    return parseInt(dateStr.substring(0, 4));
  }
  return null;
}

function isWonStatus(status) {
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  const wonStatuses = [
    'contract signed',
    'work complete',
    'billing complete',
    'email contract award',
    'verbal contract award',
    'won'
  ];
  return wonStatuses.includes(statusLower);
}

function calculateDurationMonths(startDate, endDate) {
  if (!startDate || !endDate) return 12;
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
  return Math.ceil(durationMonths / 12);
}

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function investigateBentallGreenOak() {
  console.log('🔍 Investigating BentallGreenOak (Account ID: 2746052)\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Read Excel data
  const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List.xlsx');
  if (!existsSync(excelPath)) {
    console.error('❌ Estimates List.xlsx not found in Downloads');
    return;
  }

  console.log('📂 Reading Excel file...');
  const workbook = XLSX.readFile(excelPath);
  const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  // Filter for BentallGreenOak estimates (Contact ID = 2746052)
  const excelEstimates = excelData.filter(row => {
    const contactId = String(row['Contact ID'] || row['Account ID'] || '').trim();
    return contactId === TARGET_ACCOUNT_ID;
  });

  console.log(`✅ Found ${excelEstimates.length} estimates for BentallGreenOak in Excel\n`);

  // Filter for 2025 won estimates from Excel
  const excelWon2025 = excelEstimates.filter(row => {
    if (!isWonStatus(row['Status'])) return false;
    
    const exclude = row['Exclude Stats'];
    if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;
    
    const archived = row['Archived'];
    if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;
    
    const dateValue = row['Estimate Close Date'] || row['Estimate Date'] || row['Close Date'];
    if (!dateValue) return false;
    
    const year = getYearFromDate(dateValue);
    if (year !== CURRENT_YEAR) return false;
    
    const price = parseFloat(row['Total Price With Tax'] || row['Total Price'] || 0);
    if (price <= 0) return false;
    
    return true;
  });

  console.log(`✅ Found ${excelWon2025.length} won 2025 estimates for BentallGreenOak in Excel\n`);

  // Calculate revenue from Excel
  let excelRevenue = 0;
  excelWon2025.forEach(est => {
    const price = parseFloat(est['Total Price With Tax'] || est['Total Price'] || 0);
    const startDate = est['Contract Start Date'] || est['contract_start_date'];
    const endDate = est['Contract End Date'] || est['contract_end_date'];
    
    let annualRevenue = price;
    if (startDate && endDate) {
      const durationMonths = calculateDurationMonths(startDate, endDate);
      const years = getContractYears(durationMonths);
      if (years > 0) {
        annualRevenue = price / years;
      }
    }
    
    excelRevenue += annualRevenue;
  });

  console.log(`💰 Excel Revenue (2025): $${excelRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`);

  // Get app data
  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ Cannot connect to Supabase');
    return;
  }

  console.log('📊 Fetching data from app...');
  
  // Find account by ID
  const { data: accounts, error: accountError } = await supabase
    .from('accounts')
    .select('id, name, revenue_segment, annual_revenue')
    .or(`id.eq.lmn-account-${TARGET_ACCOUNT_ID},id.eq.${TARGET_ACCOUNT_ID}`);

  if (accountError) {
    console.error('❌ Error fetching account:', accountError);
    return;
  }

  const account = accounts && accounts.length > 0 ? accounts[0] : null;
  if (!account) {
    console.error(`❌ Account ${TARGET_ACCOUNT_ID} not found in app`);
    return;
  }

  console.log(`✅ Found account: ${account.name} (ID: ${account.id})`);
  console.log(`   Stored Segment: ${account.revenue_segment || 'null'}`);
  console.log(`   Stored Annual Revenue: $${account.annual_revenue || 0}\n`);

  // Get estimates for this account
  const { data: appEstimates, error: estimateError } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, account_id, status, estimate_type, total_price, total_price_with_tax, estimate_date, estimate_close_date, contract_start, contract_end, exclude_stats, archived')
    .or(`account_id.eq.lmn-account-${TARGET_ACCOUNT_ID},account_id.eq.${TARGET_ACCOUNT_ID}`);

  if (estimateError) {
    console.error('❌ Error fetching estimates:', estimateError);
    return;
  }

  console.log(`✅ Found ${appEstimates.length} estimates for this account in app\n`);

  // Filter for 2025 won estimates
  const appWon2025 = appEstimates.filter(est => {
    if (!est.status || est.status.toLowerCase() !== 'won') return false;
    if (est.exclude_stats === true || est.exclude_stats === 'True' || est.exclude_stats === 'true' || est.exclude_stats === 1) return false;
    if (est.archived === true || est.archived === 'True' || est.archived === 'true' || est.archived === 1) return false;
    
    const price = parseFloat(est.total_price_with_tax || est.total_price || 0);
    if (price <= 0) return false;
    
    // Check if applies to 2025
    const contractStart = est.contract_start ? new Date(est.contract_start) : null;
    const contractEnd = est.contract_end ? new Date(est.contract_end) : null;
    const estimateDate = est.estimate_date ? new Date(est.estimate_date) : null;
    
    if (contractStart && contractEnd) {
      const startYear = contractStart.getFullYear();
      const durationMonths = calculateDurationMonths(contractStart, contractEnd);
      const years = getContractYears(durationMonths);
      const yearsApplied = [];
      for (let i = 0; i < years; i++) {
        yearsApplied.push(startYear + i);
      }
      if (!yearsApplied.includes(CURRENT_YEAR)) return false;
    } else if (contractStart) {
      if (contractStart.getFullYear() !== CURRENT_YEAR) return false;
    } else if (estimateDate) {
      if (estimateDate.getFullYear() !== CURRENT_YEAR) return false;
    } else {
      // No date - assume applies to current year
    }
    
    return true;
  });

  console.log(`✅ Found ${appWon2025.length} won 2025 estimates in app\n`);

  // Calculate revenue from app
  let appRevenue = 0;
  appWon2025.forEach(est => {
    const price = parseFloat(est.total_price_with_tax || est.total_price || 0);
    const contractStart = est.contract_start ? new Date(est.contract_start) : null;
    const contractEnd = est.contract_end ? new Date(est.contract_end) : null;
    
    let annualRevenue = price;
    if (contractStart && contractEnd) {
      const durationMonths = calculateDurationMonths(contractStart, contractEnd);
      const years = getContractYears(durationMonths);
      if (years > 0) {
        annualRevenue = price / years;
      }
    }
    
    appRevenue += annualRevenue;
  });

  console.log(`💰 App Revenue (2025): $${appRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`);

  // Get total revenue for percentage calculation
  let allAppEstimates = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('estimates')
      .select('id, account_id, status, total_price, total_price_with_tax, contract_start, contract_end, exclude_stats, archived')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) break;
    if (data && data.length > 0) {
      allAppEstimates = allAppEstimates.concat(data);
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  // Calculate total revenue from all accounts
  const { data: allAccounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('archived', false);

  let totalRevenue = 0;
  allAccounts?.forEach(acc => {
    const accountEstimates = allAppEstimates.filter(e => String(e.account_id).trim() === String(acc.id).trim());
    const won2025 = accountEstimates.filter(est => {
      if (!est.status || est.status.toLowerCase() !== 'won') return false;
      if (est.exclude_stats === true || est.exclude_stats === 'True' || est.exclude_stats === 'true' || est.exclude_stats === 1) return false;
      if (est.archived === true || est.archived === 'True' || est.archived === 'true' || est.archived === 1) return false;
      const price = parseFloat(est.total_price_with_tax || est.total_price || 0);
      if (price <= 0) return false;
      
      const contractStart = est.contract_start ? new Date(est.contract_start) : null;
      const contractEnd = est.contract_end ? new Date(est.contract_end) : null;
      if (contractStart && contractEnd) {
        const startYear = contractStart.getFullYear();
        const durationMonths = calculateDurationMonths(contractStart, contractEnd);
        const years = getContractYears(durationMonths);
        const yearsApplied = [];
        for (let i = 0; i < years; i++) {
          yearsApplied.push(startYear + i);
        }
        if (!yearsApplied.includes(CURRENT_YEAR)) return false;
      }
      return true;
    });
    
    won2025.forEach(est => {
      const price = parseFloat(est.total_price_with_tax || est.total_price || 0);
      const contractStart = est.contract_start ? new Date(est.contract_start) : null;
      const contractEnd = est.contract_end ? new Date(est.contract_end) : null;
      let annualRevenue = price;
      if (contractStart && contractEnd) {
        const durationMonths = calculateDurationMonths(contractStart, contractEnd);
        const years = getContractYears(durationMonths);
        if (years > 0) {
          annualRevenue = price / years;
        }
      }
      totalRevenue += annualRevenue;
    });
  });

  console.log(`💰 Total Revenue (all accounts, 2025): $${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`);

  // Calculate percentages
  const excelPercentage = totalRevenue > 0 ? (excelRevenue / totalRevenue) * 100 : 0;
  const appPercentage = totalRevenue > 0 ? (appRevenue / totalRevenue) * 100 : 0;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 Comparison:\n');
  console.log(`Excel Revenue: $${excelRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Excel Percentage: ${excelPercentage.toFixed(2)}%`);
  console.log(`Excel Segment: ${excelPercentage >= 15 ? 'A' : excelPercentage >= 5 ? 'B' : 'C'}\n`);
  
  console.log(`App Revenue: $${appRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`App Percentage: ${appPercentage.toFixed(2)}%`);
  console.log(`App Segment: ${appPercentage >= 15 ? 'A' : appPercentage >= 5 ? 'B' : 'C'}\n`);

  const revenueDiff = excelRevenue - appRevenue;
  console.log(`Revenue Difference: $${revenueDiff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${revenueDiff > 0 ? 'Excel has more' : 'App has more'})\n`);

  // Compare estimates
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 Estimate Comparison:\n');
  console.log(`Excel: ${excelWon2025.length} won 2025 estimates`);
  console.log(`App: ${appWon2025.length} won 2025 estimates`);
  console.log(`Difference: ${excelWon2025.length - appWon2025.length} estimates\n`);

  // Show estimate IDs from Excel
  if (excelWon2025.length > 0) {
    console.log('📋 Excel Estimate IDs:');
    excelWon2025.slice(0, 10).forEach((est, idx) => {
      const estId = est['Estimate ID'] || est['Estimate ID'] || 'N/A';
      const price = parseFloat(est['Total Price With Tax'] || est['Total Price'] || 0);
      const date = est['Estimate Close Date'] || est['Estimate Date'] || 'N/A';
      console.log(`   ${idx + 1}. ID: ${estId}, Price: $${price.toLocaleString()}, Date: ${date}`);
    });
    if (excelWon2025.length > 10) {
      console.log(`   ... and ${excelWon2025.length - 10} more`);
    }
    console.log('');
  }

  // Show estimate IDs from app
  if (appWon2025.length > 0) {
    console.log('📋 App Estimate IDs:');
    appWon2025.slice(0, 10).forEach((est, idx) => {
      const estId = est.lmn_estimate_id || est.id || 'N/A';
      const price = parseFloat(est.total_price_with_tax || est.total_price || 0);
      const date = est.contract_start || est.estimate_date || 'N/A';
      console.log(`   ${idx + 1}. ID: ${estId}, Price: $${price.toLocaleString()}, Date: ${date}`);
    });
    if (appWon2025.length > 10) {
      console.log(`   ... and ${appWon2025.length - 10} more`);
    }
    console.log('');
  }
  
  // Check for the large estimate EST2941302 specifically
  const largeEstimateId = 'EST2941302';
  const largeExcelEst = excelWon2025.find(e => String(e['Estimate ID'] || '').trim() === largeEstimateId);
  if (largeExcelEst) {
    console.log(`🔍 Checking large estimate ${largeEstimateId} ($${parseFloat(largeExcelEst['Total Price With Tax'] || largeExcelEst['Total Price'] || 0).toLocaleString()}):`);
    const appEst = appEstimates.find(e => {
      const id = String(e.lmn_estimate_id || e.id || '').trim();
      return id.replace(/^lmn-estimate-/, '').replace(/^EST/, 'EST') === largeEstimateId;
    });
    if (appEst) {
      const appPrice = parseFloat(appEst.total_price_with_tax || appEst.total_price || 0);
      const appStatus = appEst.status || 'N/A';
      const appDate = appEst.contract_start || appEst.estimate_date || 'N/A';
      const isWon = appStatus.toLowerCase() === 'won';
      const is2025 = appDate && new Date(appDate).getFullYear() === CURRENT_YEAR;
      console.log(`   ✅ Found in app: Status="${appStatus}" (${isWon ? 'WON' : 'NOT WON'}), Price: $${appPrice.toLocaleString()}, Date: ${appDate} (${is2025 ? '2025' : 'NOT 2025'})`);
      if (!isWon || !is2025) {
        console.log(`   ⚠️  This estimate is ${!isWon ? 'not marked as WON' : ''}${!isWon && !is2025 ? ' and ' : ''}${!is2025 ? 'not in 2025' : ''}, so it's excluded from revenue calculation`);
      }
    } else {
      console.log(`   ❌ NOT FOUND in app database`);
    }
    console.log('');
  }

  // Find missing estimates - normalize IDs
  const excelEstimateIds = new Set(excelWon2025.map(e => {
    const id = String(e['Estimate ID'] || e['Estimate ID'] || '').trim();
    return id.replace(/^EST/, 'EST'); // Normalize EST prefix
  }).filter(id => id));
  
  const appEstimateIds = new Set(appWon2025.map(e => {
    const id = String(e.lmn_estimate_id || e.id || '').trim();
    return id.replace(/^lmn-estimate-/, '').replace(/^EST/, 'EST'); // Remove prefix if present
  }).filter(id => id));
  
  // Also get ALL estimates (not just won 2025) to check if missing ones exist with different status
  const allAppEstimateIds = new Set(appEstimates.map(e => {
    const id = String(e.lmn_estimate_id || e.id || '').trim();
    return id.replace(/^lmn-estimate-/, '').replace(/^EST/, 'EST');
  }).filter(id => id));

  const missingInApp = [...excelEstimateIds].filter(id => !appEstimateIds.has(id));
  const extraInApp = [...appEstimateIds].filter(id => !excelEstimateIds.has(id));

  if (missingInApp.length > 0) {
    console.log('⚠️  Estimates in Excel (won 2025) but NOT in app (won 2025):');
    const missingDetails = [];
    missingInApp.forEach(excelId => {
      const excelEst = excelWon2025.find(e => {
        const id = String(e['Estimate ID'] || '').trim();
        return id.replace(/^EST/, 'EST') === excelId;
      });
      if (excelEst) {
        const price = parseFloat(excelEst['Total Price With Tax'] || excelEst['Total Price'] || 0);
        const status = excelEst['Status'] || 'N/A';
        const date = excelEst['Estimate Close Date'] || excelEst['Estimate Date'] || 'N/A';
        const existsInApp = allAppEstimateIds.has(excelId);
        missingDetails.push({
          id: excelId,
          price,
          status,
          date,
          existsInApp: existsInApp ? 'YES (different status/date)' : 'NO'
        });
      }
    });
    
    missingDetails.slice(0, 20).forEach(detail => {
      console.log(`   - ${detail.id}: $${detail.price.toLocaleString()}, Status: ${detail.status}, Date: ${detail.date}, In App: ${detail.existsInApp}`);
    });
    if (missingDetails.length > 20) {
      console.log(`   ... and ${missingDetails.length - 20} more`);
    }
    console.log('');
    
    // Check if any of these exist in app with different status
    const missingButExists = missingDetails.filter(d => d.existsInApp === 'YES (different status/date)');
    if (missingButExists.length > 0) {
      console.log(`🔍 Found ${missingButExists.length} estimates that exist in app but with different status/date:`);
      for (const detail of missingButExists.slice(0, 10)) {
        const appEst = appEstimates.find(e => {
          const id = String(e.lmn_estimate_id || e.id || '').trim();
          return id.replace(/^lmn-estimate-/, '').replace(/^EST/, 'EST') === detail.id;
        });
        if (appEst) {
          const appPrice = parseFloat(appEst.total_price_with_tax || appEst.total_price || 0);
          const appStatus = appEst.status || 'N/A';
          const appDate = appEst.contract_start || appEst.estimate_date || 'N/A';
          console.log(`   - ${detail.id}: Status="${appStatus}" (Excel: "${detail.status}"), Price: $${appPrice.toLocaleString()}, Date: ${appDate}`);
        }
      }
      if (missingButExists.length > 10) {
        console.log(`   ... and ${missingButExists.length - 10} more`);
      }
      console.log('');
    }
  }

  if (extraInApp.length > 0) {
    console.log('⚠️  Estimates in app but NOT in Excel:');
    extraInApp.slice(0, 10).forEach(id => console.log(`   - ${id}`));
    if (extraInApp.length > 10) {
      console.log(`   ... and ${extraInApp.length - 10} more`);
    }
    console.log('');
  }
}

investigateBentallGreenOak().catch(console.error);

