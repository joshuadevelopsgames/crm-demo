#!/usr/bin/env node

/**
 * Find the specific estimates that are causing the remaining differences
 * 2024: We have 599, LMN shows 591 (8 extra)
 * 2025: We have 1013, LMN shows 1086 (73 fewer - this is interesting!)
 */

import XLSX from 'xlsx';
import { join } from 'path';

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

async function findRemainingDifferences() {
  console.log('🔍 Finding Remaining Differences\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const lmnData = XLSX.utils.sheet_to_json(worksheet);

    const closeDateCol = 'Estimate Close Date';
    const statusCol = 'Status';
    const pipelineStatusCol = 'Sales Pipeline Status';
    const excludeStatsCol = 'Exclude Stats';
    const archivedCol = 'Archived';
    const totalPriceCol = 'Total Price';
    const totalPriceWithTaxCol = 'Total Price With Tax';
    const estimateIdCol = 'Estimate ID';
    const projectNameCol = 'Project Name';

    const wonStatuses = [
      'contract signed',
      'work complete',
      'billing complete',
      'email contract award',
      'verbal contract award'
    ];

    // Filter 2024
    const base2024 = lmnData.filter(row => {
      if (!row[closeDateCol]) return false;
      const closeYear = getYearFromDate(row[closeDateCol]);
      if (closeYear !== 2024) return false;
      
      const exclude = row[excludeStatsCol];
      if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;
      const archived = row[archivedCol];
      if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;
      const price = parseFloat(row[totalPriceCol] || row[totalPriceWithTaxCol] || 0);
      if (price <= 0) return false;
      
      return true;
    });

    const won2024 = base2024.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return wonStatuses.includes(status);
    });

    console.log(`2024: Base filtered: ${base2024.length}, Won statuses: ${won2024.length}, LMN Report: 591`);
    console.log(`  We have ${won2024.length - 591} extra estimates\n`);

    // Find which won statuses are in the 8 extra
    const statusCounts = {};
    won2024.forEach(row => {
      const status = (row[statusCol] || 'unknown').toString().trim();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('2024 Won Status Breakdown:');
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    // Filter 2025
    const base2025 = lmnData.filter(row => {
      if (!row[closeDateCol]) return false;
      const closeYear = getYearFromDate(row[closeDateCol]);
      if (closeYear !== 2025) return false;
      
      const exclude = row[excludeStatsCol];
      if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;
      const archived = row[archivedCol];
      if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;
      const price = parseFloat(row[totalPriceCol] || row[totalPriceWithTaxCol] || 0);
      if (price <= 0) return false;
      
      return true;
    });

    const won2025 = base2025.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return wonStatuses.includes(status);
    });

    console.log(`2025: Base filtered: ${base2025.length}, Won statuses: ${won2025.length}, LMN Report: 1086`);
    console.log(`  We have ${won2025.length - 1086} FEWER estimates (LMN has more!)\n`);

    // This is interesting - LMN has MORE in their report than we're getting with won statuses
    // Maybe they're including some "lost" estimates? Or maybe they're using a different date?
    
    // Check what statuses are in base2025 but not in won2025
    const lost2025 = base2025.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return !wonStatuses.includes(status);
    });

    console.log('2025 Status Breakdown (all):');
    const allStatuses2025 = {};
    base2025.forEach(row => {
      const status = (row[statusCol] || 'unknown').toString().trim();
      allStatuses2025[status] = (allStatuses2025[status] || 0) + 1;
    });
    Object.entries(allStatuses2025).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    // Maybe LMN includes estimates with pipeline_status='Sold' even if status is lost?
    const soldPipeline2025 = base2025.filter(row => {
      const pipeline = (row[pipelineStatusCol] || '').toString().trim().toLowerCase();
      return pipeline === 'sold';
    });

    console.log(`2025: Pipeline='Sold': ${soldPipeline2025.length} (LMN Report: 1086, diff: ${soldPipeline2025.length - 1086})`);
    console.log(`  This is ${Math.abs(soldPipeline2025.length - 1086)} different\n`);

    // Check if pipeline='Sold' includes lost estimates
    const soldButLost2025 = base2025.filter(row => {
      const pipeline = (row[pipelineStatusCol] || '').toString().trim().toLowerCase();
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return pipeline === 'sold' && !wonStatuses.includes(status);
    });

    console.log(`2025: Pipeline='Sold' but status is NOT won: ${soldButLost2025.length}`);
    if (soldButLost2025.length > 0) {
      console.log('  Sample:');
      soldButLost2025.slice(0, 5).forEach(row => {
        console.log(`    ${row[estimateIdCol]}: ${row[projectNameCol] || 'No name'}, status=${row[statusCol]}, pipeline=${row[pipelineStatusCol]}`);
      });
    }
    console.log('');

    // Maybe LMN's report includes ALL estimates with close_date, not just won?
    // But that doesn't match "All sales figures based on estimates sold"
    
    // Let's check if maybe they're using estimate_date for some estimates instead of close_date
    const estimateDateCol = 'Estimate Date';
    const byEstimateDate2025 = lmnData.filter(row => {
      if (!row[estimateDateCol]) return false;
      const estYear = getYearFromDate(row[estimateDateCol]);
      return estYear === 2025;
    });

    const byEstimateDate2025Filtered = byEstimateDate2025.filter(row => {
      const exclude = row[excludeStatsCol];
      if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;
      const archived = row[archivedCol];
      if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;
      const price = parseFloat(row[totalPriceCol] || row[totalPriceWithTaxCol] || 0);
      if (price <= 0) return false;
      return true;
    });

    console.log(`2025: By estimate_date (instead of close_date): ${byEstimateDate2025Filtered.length}`);
    console.log(`  This is ${Math.abs(byEstimateDate2025Filtered.length - 1086)} different from LMN's 1086\n`);

    // Maybe they use close_date OR estimate_date for estimates without close_date?
    const byCloseOrEstimate2025 = lmnData.filter(row => {
      let dateToUse = row[closeDateCol] || row[estimateDateCol];
      if (!dateToUse) return false;
      const year = getYearFromDate(dateToUse);
      if (year !== 2025) return false;
      
      const exclude = row[excludeStatsCol];
      if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;
      const archived = row[archivedCol];
      if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;
      const price = parseFloat(row[totalPriceCol] || row[totalPriceWithTaxCol] || 0);
      if (price <= 0) return false;
      
      return true;
    });

    const byCloseOrEstimateWon2025 = byCloseOrEstimate2025.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return wonStatuses.includes(status);
    });

    console.log(`2025: By close_date OR estimate_date, won statuses: ${byCloseOrEstimateWon2025.length}`);
    console.log(`  This is ${Math.abs(byCloseOrEstimateWon2025.length - 1086)} different from LMN's 1086\n`);

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('For 2024 (need 591):');
    console.log(`  Won statuses only: ${won2024.length} (diff: ${won2024.length - 591})`);
    console.log(`  → Very close! Only ${won2024.length - 591} estimates off\n`);
    
    console.log('For 2025 (need 1086):');
    console.log(`  Won statuses only: ${won2025.length} (diff: ${won2025.length - 1086})`);
    console.log(`  Pipeline='Sold' only: ${soldPipeline2025.length} (diff: ${soldPipeline2025.length - 1086})`);
    console.log(`  By estimate_date: ${byEstimateDate2025Filtered.length} (diff: ${byEstimateDate2025Filtered.length - 1086})`);
    console.log(`  By close_date OR estimate_date, won: ${byCloseOrEstimateWon2025.length} (diff: ${byCloseOrEstimateWon2025.length - 1086})\n`);
    
    console.log('💡 HYPOTHESIS:');
    console.log('  For 2024: LMN might be excluding some specific won statuses (maybe "email contract award" or "verbal contract award"?)');
    console.log('  For 2025: LMN might be using pipeline_status="Sold" OR including some estimates with estimate_date (not just close_date)');
    console.log('  OR: They might be including estimates that were created in 2025 but closed later (using estimate_date for some)\n');

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

findRemainingDifferences();

