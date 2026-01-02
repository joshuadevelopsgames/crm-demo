#!/usr/bin/env node

/**
 * Investigate why we have 273 more estimates for 2025 than LMN (1359 vs 1086)
 * What additional filters might LMN be applying?
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

async function investigate2025Difference() {
  console.log('🔍 Investigating 2025 Difference (1359 vs 1086)\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    // Base filter: close_date in 2025, exclude_stats=false, archived=false, price>0
    const base2025 = data.filter(row => {
      if (!row['Estimate Close Date']) return false;
      const closeYear = getYearFromDate(row['Estimate Close Date']);
      if (closeYear !== 2025) return false;
      
      const exclude = row['Exclude Stats'];
      if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;
      const archived = row['Archived'];
      if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;
      const price = parseFloat(row['Total Price'] || row['Total Price With Tax'] || 0);
      if (price <= 0) return false;
      return true;
    });

    console.log(`Base filtered (close_date=2025, exclude_stats=false, archived=false, price>0): ${base2025.length}\n`);

    // Remove duplicates
    const unique2025 = [];
    const seen = new Set();
    base2025.forEach(row => {
      const id = row['Estimate ID'];
      if (id) {
        if (!seen.has(id)) {
          seen.add(id);
          unique2025.push(row);
        }
      } else {
        unique2025.push(row);
      }
    });

    console.log(`After removing duplicates: ${unique2025.length} (removed ${base2025.length - unique2025.length})\n`);

    // Test different filters
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 Testing Different Filters:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Only won statuses
    const wonOnly = unique2025.filter(row => {
      const status = (row['Status'] || '').toString().toLowerCase().trim();
      return isWonStatus(status);
    });
    console.log(`1. Only won statuses: ${wonOnly.length} (need 1086, diff: ${wonOnly.length - 1086})\n`);

    // 2. Pipeline='Sold'
    const pipelineSold = unique2025.filter(row => {
      const pipeline = (row['Sales Pipeline Status'] || '').toString().trim().toLowerCase();
      return pipeline === 'sold';
    });
    console.log(`2. Pipeline='Sold': ${pipelineSold.length} (need 1086, diff: ${pipelineSold.length - 1086})\n`);

    // 3. Pipeline='Sold' OR won statuses
    const soldOrWon = unique2025.filter(row => {
      const pipeline = (row['Sales Pipeline Status'] || '').toString().trim().toLowerCase();
      const status = (row['Status'] || '').toString().toLowerCase().trim();
      return pipeline === 'sold' || isWonStatus(status);
    });
    console.log(`3. Pipeline='Sold' OR won statuses: ${soldOrWon.length} (need 1086, diff: ${soldOrWon.length - 1086})\n`);

    // 4. Exclude "Work In Progress" status
    const excludeWIP = unique2025.filter(row => {
      const status = (row['Status'] || '').toString().toLowerCase().trim();
      return status !== 'work in progress';
    });
    console.log(`4. Exclude "Work In Progress": ${excludeWIP.length} (need 1086, diff: ${excludeWIP.length - 1086})\n`);

    // 5. Exclude "Estimate In Progress"
    const excludeEIP = unique2025.filter(row => {
      const status = (row['Status'] || '').toString().toLowerCase().trim();
      return status !== 'estimate in progress';
    });
    console.log(`5. Exclude "Estimate In Progress": ${excludeEIP.length} (need 1086, diff: ${excludeEIP.length - 1086})\n`);

    // 6. Exclude both WIP and EIP
    const excludeBoth = unique2025.filter(row => {
      const status = (row['Status'] || '').toString().toLowerCase().trim();
      return status !== 'work in progress' && status !== 'estimate in progress';
    });
    console.log(`6. Exclude both WIP and EIP: ${excludeBoth.length} (need 1086, diff: ${excludeBoth.length - 1086})\n`);

    // 7. Pipeline='Sold' OR (won statuses AND not WIP/EIP)
    const soldOrWonExclude = unique2025.filter(row => {
      const pipeline = (row['Sales Pipeline Status'] || '').toString().trim().toLowerCase();
      const status = (row['Status'] || '').toString().toLowerCase().trim();
      if (pipeline === 'sold') return true;
      if (isWonStatus(status) && status !== 'work in progress' && status !== 'estimate in progress') return true;
      return false;
    });
    console.log(`7. Pipeline='Sold' OR (won statuses AND not WIP/EIP): ${soldOrWonExclude.length} (need 1086, diff: ${soldOrWonExclude.length - 1086})\n`);

    // 8. Check status breakdown
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Status Breakdown (2025):\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const statusBreakdown = {};
    unique2025.forEach(row => {
      const status = (row['Status'] || 'unknown').toString().trim();
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    // 9. Check pipeline status breakdown
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Pipeline Status Breakdown (2025):\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const pipelineBreakdown = {};
    unique2025.forEach(row => {
      const pipeline = (row['Sales Pipeline Status'] || 'unknown').toString().trim();
      pipelineBreakdown[pipeline] = (pipelineBreakdown[pipeline] || 0) + 1;
    });

    Object.entries(pipelineBreakdown).sort((a, b) => b[1] - a[1]).forEach(([pipeline, count]) => {
      console.log(`  ${pipeline}: ${count}`);
    });
    console.log('');

    // 10. Find the 273 extra estimates
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 Analyzing the 273 Extra Estimates:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // If LMN shows 1086, what are they excluding from our 1359?
    // Let's see what statuses/pipeline statuses are in the extra 273
    const wonStatusesSet = new Set(['contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'won']);
    
    // Estimates that are NOT won and NOT pipeline='Sold'
    const notWonNotSold = unique2025.filter(row => {
      const pipeline = (row['Sales Pipeline Status'] || '').toString().trim().toLowerCase();
      const status = (row['Status'] || '').toString().toLowerCase().trim();
      return pipeline !== 'sold' && !wonStatusesSet.has(status);
    });

    console.log(`Estimates that are NOT won AND NOT pipeline='Sold': ${notWonNotSold.length}`);
    console.log('Status breakdown of these:');
    const notWonNotSoldStatus = {};
    notWonNotSold.forEach(row => {
      const status = (row['Status'] || 'unknown').toString().trim();
      notWonNotSoldStatus[status] = (notWonNotSoldStatus[status] || 0) + 1;
    });
    Object.entries(notWonNotSoldStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    // If we exclude these, what do we get?
    const excludeNotWonNotSold = unique2025.filter(row => {
      const pipeline = (row['Sales Pipeline Status'] || '').toString().trim().toLowerCase();
      const status = (row['Status'] || '').toString().toLowerCase().trim();
      return pipeline === 'sold' || wonStatusesSet.has(status);
    });
    console.log(`If we exclude NOT won AND NOT pipeline='Sold': ${excludeNotWonNotSold.length} (need 1086, diff: ${excludeNotWonNotSold.length - 1086})\n`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

investigate2025Difference();


