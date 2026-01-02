#!/usr/bin/env node

/**
 * Calculate B segment clients for 2025 based on data from downloaded sheets
 * B segment = 5-15% of total revenue (current year)
 */

import XLSX from 'xlsx';
import { join } from 'path';
import { existsSync } from 'fs';

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
  if (!startDate || !endDate) return 12; // Default to 1 year
  
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

async function calculateBSegment2025() {
  console.log('🔍 Calculating B Segment Clients for 2025\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Try to find the Estimates List file
  const possibleFiles = [
    'Estimates List.xlsx',
    'End_of_Year_Report_2025.xlsx',
    'End_of_Year_Report_2025 (1).xlsx'
  ];

  let estimatesData = [];
  let accountsData = [];

  // Read Estimates List
  for (const filename of possibleFiles) {
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', filename);
    if (existsSync(excelPath)) {
      console.log(`📂 Reading: ${filename}\n`);
      const workbook = XLSX.readFile(excelPath);
      
      // Try to find Estimates sheet
      for (const sheetName of workbook.SheetNames) {
        if (sheetName.toLowerCase().includes('estimate') || sheetName.toLowerCase().includes('data')) {
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet);
          estimatesData = data;
          console.log(`   Found ${data.length} rows in sheet: ${sheetName}\n`);
          break;
        }
      }
      
      // If no estimates sheet found, use first sheet
      if (estimatesData.length === 0 && workbook.SheetNames.length > 0) {
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        estimatesData = XLSX.utils.sheet_to_json(worksheet);
        console.log(`   Using first sheet: ${workbook.SheetNames[0]} (${estimatesData.length} rows)\n`);
      }
      break;
    }
  }

  if (estimatesData.length === 0) {
    console.error('❌ Could not find Estimates List file. Please ensure one of these files exists in Downloads:');
    possibleFiles.forEach(f => console.error(`   - ${f}`));
    return;
  }

  // Filter for 2025 won estimates
  const year2025 = 2025;
  const won2025 = estimatesData.filter(row => {
    // Check if estimate is won
    const status = row['Status'] || row['status'] || '';
    if (!isWonStatus(status)) return false;

    // Check if exclude_stats is false
    const exclude = row['Exclude Stats'] || row['exclude_stats'] || row['Exclude Stats'] || false;
    if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;

    // Check if archived is false
    const archived = row['Archived'] || row['archived'] || false;
    if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;

    // Check date - try multiple date columns
    const dateValue = row['Estimate Close Date'] || row['Estimate Date'] || row['Close Date'] || 
                      row['estimate_close_date'] || row['estimate_date'] || row['close_date'];
    if (!dateValue) return false;

    const year = getYearFromDate(dateValue);
    if (year !== year2025) return false;

    // Check price > 0
    const price = parseFloat(row['Total Price With Tax'] || row['Total Price'] || 
                            row['total_price_with_tax'] || row['total_price'] || 0);
    if (price <= 0) return false;

    return true;
  });

  console.log(`✅ Found ${won2025.length} won estimates for 2025\n`);

  // Group estimates by account (Contact ID in estimates = Account ID)
  const accountRevenue = {};
  const accountEstimates = {};

  won2025.forEach(est => {
    const accountId = est['Contact ID'] || est['Account ID'] || est['contact_id'] || est['account_id'];
    if (!accountId) return;

    const accountIdStr = String(accountId).trim();
    
    // Get revenue
    const price = parseFloat(est['Total Price With Tax'] || est['Total Price'] || 
                            est['total_price_with_tax'] || est['total_price'] || 0);
    
    // Annualize for multi-year contracts
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

    if (!accountRevenue[accountIdStr]) {
      accountRevenue[accountIdStr] = 0;
      accountEstimates[accountIdStr] = [];
    }
    
    accountRevenue[accountIdStr] += annualRevenue;
    accountEstimates[accountIdStr].push(est);
  });

  // Calculate total revenue
  const totalRevenue = Object.values(accountRevenue).reduce((sum, rev) => sum + rev, 0);
  console.log(`💰 Total Revenue (2025): $${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`);

  // Calculate segments
  const segments = {
    A: [],
    B: [],
    C: [],
    D: []
  };

  Object.entries(accountRevenue).forEach(([accountId, revenue]) => {
    if (totalRevenue <= 0) {
      segments.C.push({ accountId, revenue, percentage: 0 });
      return;
    }

    const percentage = (revenue / totalRevenue) * 100;

    // Check if project only (has Standard but no Service estimates)
    const estimates = accountEstimates[accountId] || [];
    const hasStandard = estimates.some(e => {
      const type = (e['Estimate Type'] || e['estimate_type'] || '').toString().toLowerCase().trim();
      return type === 'standard';
    });
    const hasService = estimates.some(e => {
      const type = (e['Estimate Type'] || e['estimate_type'] || '').toString().toLowerCase().trim();
      return type === 'service';
    });

    if (hasStandard && !hasService) {
      segments.D.push({ accountId, revenue, percentage });
    } else if (percentage >= 15) {
      segments.A.push({ accountId, revenue, percentage });
    } else if (percentage >= 5) {
      segments.B.push({ accountId, revenue, percentage });
    } else {
      segments.C.push({ accountId, revenue, percentage });
    }
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 Revenue Segment Breakdown for 2025:\n');
  console.log(`Segment A (≥15%): ${segments.A.length} clients`);
  console.log(`Segment B (5-15%): ${segments.B.length} clients ⭐`);
  console.log(`Segment C (0-5%): ${segments.C.length} clients`);
  console.log(`Segment D (Project Only): ${segments.D.length} clients\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`✅ ANSWER: You should have ${segments.B.length} B segment clients for 2025\n`);

  // Show B segment details
  if (segments.B.length > 0) {
    console.log('📋 B Segment Clients Details:\n');
    segments.B
      .sort((a, b) => b.revenue - a.revenue)
      .forEach((client, idx) => {
        console.log(`${idx + 1}. Account ID: ${client.accountId}`);
        console.log(`   Revenue: $${client.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        console.log(`   Percentage: ${client.percentage.toFixed(2)}%`);
        console.log(`   Estimates: ${accountEstimates[client.accountId]?.length || 0}`);
        console.log('');
      });
  }

  // Summary statistics
  const bSegmentRevenue = segments.B.reduce((sum, c) => sum + c.revenue, 0);
  const bSegmentPercentage = totalRevenue > 0 ? (bSegmentRevenue / totalRevenue) * 100 : 0;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📈 B Segment Summary:\n');
  console.log(`Total B Segment Revenue: $${bSegmentRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`B Segment % of Total: ${bSegmentPercentage.toFixed(2)}%`);
  console.log(`Average Revenue per B Client: $${segments.B.length > 0 ? (bSegmentRevenue / segments.B.length).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}\n`);
}

calculateBSegment2025().catch(console.error);

