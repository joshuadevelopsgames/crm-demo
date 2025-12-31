#!/usr/bin/env node

/**
 * Investigate what additional filters LMN applies in their report vs the export
 * The export has 631 for 2024 but report shows 591 (40 fewer)
 * The export has 1359 for 2025 but report shows 1086 (273 fewer)
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

async function investigateReportFilters() {
  console.log('🔍 Investigating LMN Report Filters\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const lmnData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`✅ Loaded ${lmnData.length} rows from LMN export\n`);

    const columns = Object.keys(lmnData[0]);
    const estimateIdCol = 'Estimate ID';
    const closeDateCol = 'Estimate Close Date';
    const statusCol = 'Status';
    const pipelineStatusCol = 'Sales Pipeline Status';
    const excludeStatsCol = 'Exclude Stats';
    const archivedCol = 'Archived';
    const totalPriceCol = 'Total Price';
    const totalPriceWithTaxCol = 'Total Price With Tax';

    // Filter 2024 and 2025 by close_date
    const lmn2024 = lmnData.filter(row => {
      if (!row[closeDateCol]) return false;
      const closeYear = getYearFromDate(row[closeDateCol]);
      return closeYear === 2024;
    });

    const lmn2025 = lmnData.filter(row => {
      if (!row[closeDateCol]) return false;
      const closeYear = getYearFromDate(row[closeDateCol]);
      return closeYear === 2025;
    });

    // Apply base filters
    const base2024 = lmn2024.filter(row => {
      const exclude = row[excludeStatsCol];
      if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;
      const archived = row[archivedCol];
      if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;
      const price = parseFloat(row[totalPriceCol] || row[totalPriceWithTaxCol] || 0);
      if (price <= 0) return false;
      return true;
    });

    const base2025 = lmn2025.filter(row => {
      const exclude = row[excludeStatsCol];
      if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;
      const archived = row[archivedCol];
      if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;
      const price = parseFloat(row[totalPriceCol] || row[totalPriceWithTaxCol] || 0);
      if (price <= 0) return false;
      return true;
    });

    console.log('📊 Base Filtered Data:');
    console.log(`  2024: ${base2024.length} (LMN Report: 591, need to remove ${base2024.length - 591})`);
    console.log(`  2025: ${base2025.length} (LMN Report: 1086, need to remove ${base2025.length - 1086})\n`);

    // ============================================
    // TEST 1: Filter by Status
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('1️⃣  TESTING STATUS FILTERS:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Status breakdown
    const statusBreakdown2024 = {};
    base2024.forEach(row => {
      const status = (row[statusCol] || 'unknown').toString().trim();
      statusBreakdown2024[status] = (statusBreakdown2024[status] || 0) + 1;
    });

    const statusBreakdown2025 = {};
    base2025.forEach(row => {
      const status = (row[statusCol] || 'unknown').toString().trim();
      statusBreakdown2025[status] = (statusBreakdown2025[status] || 0) + 1;
    });

    console.log('2024 Status Breakdown:');
    Object.entries(statusBreakdown2024).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    console.log('2025 Status Breakdown:');
    Object.entries(statusBreakdown2025).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    // Test: Only include "won" statuses (contract signed, work complete, billing complete, etc.)
    const wonStatuses = [
      'contract signed',
      'work complete',
      'billing complete',
      'email contract award',
      'verbal contract award'
    ];

    const won2024 = base2024.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return wonStatuses.includes(status);
    });

    const won2025 = base2025.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return wonStatuses.includes(status);
    });

    console.log(`If we only include "won" statuses (${wonStatuses.join(', ')}):`);
    console.log(`  2024: ${won2024.length} (need ${591}, diff: ${won2024.length - 591})`);
    console.log(`  2025: ${won2025.length} (need ${1086}, diff: ${won2025.length - 1086})\n`);

    // Test: Exclude "in progress" or "on hold" statuses
    const excludeStatuses = [
      'work in progress',
      'estimate in progress',
      'estimate on hold',
      'client proposal phase'
    ];

    const withoutInProgress2024 = base2024.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return !excludeStatuses.includes(status);
    });

    const withoutInProgress2025 = base2025.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return !excludeStatuses.includes(status);
    });

    console.log(`If we exclude "in progress" statuses (${excludeStatuses.join(', ')}):`);
    console.log(`  2024: ${withoutInProgress2024.length} (need ${591}, diff: ${withoutInProgress2024.length - 591})`);
    console.log(`  2025: ${withoutInProgress2025.length} (need ${1086}, diff: ${withoutInProgress2025.length - 1086})\n`);

    // ============================================
    // TEST 2: Filter by Pipeline Status
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('2️⃣  TESTING PIPELINE STATUS FILTERS:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const pipelineBreakdown2024 = {};
    base2024.forEach(row => {
      const pipeline = (row[pipelineStatusCol] || 'unknown').toString().trim();
      pipelineBreakdown2024[pipeline] = (pipelineBreakdown2024[pipeline] || 0) + 1;
    });

    const pipelineBreakdown2025 = {};
    base2025.forEach(row => {
      const pipeline = (row[pipelineStatusCol] || 'unknown').toString().trim();
      pipelineBreakdown2025[pipeline] = (pipelineBreakdown2025[pipeline] || 0) + 1;
    });

    console.log('2024 Pipeline Status Breakdown:');
    Object.entries(pipelineBreakdown2024).sort((a, b) => b[1] - a[1]).forEach(([pipeline, count]) => {
      console.log(`  ${pipeline}: ${count}`);
    });
    console.log('');

    console.log('2025 Pipeline Status Breakdown:');
    Object.entries(pipelineBreakdown2025).sort((a, b) => b[1] - a[1]).forEach(([pipeline, count]) => {
      console.log(`  ${pipeline}: ${count}`);
    });
    console.log('');

    // Test: Only include "Sold" pipeline status
    const sold2024 = base2024.filter(row => {
      const pipeline = (row[pipelineStatusCol] || '').toString().trim().toLowerCase();
      return pipeline === 'sold';
    });

    const sold2025 = base2025.filter(row => {
      const pipeline = (row[pipelineStatusCol] || '').toString().trim().toLowerCase();
      return pipeline === 'sold';
    });

    console.log(`If we only include pipeline_status='Sold':`);
    console.log(`  2024: ${sold2024.length} (need ${591}, diff: ${sold2024.length - 591})`);
    console.log(`  2025: ${sold2025.length} (need ${1086}, diff: ${sold2025.length - 1086})\n`);

    // ============================================
    // TEST 3: Combination Filters
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('3️⃣  TESTING COMBINATION FILTERS:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Test: Pipeline Status = 'Sold' AND exclude in-progress statuses
    const soldAndExcludeInProgress2024 = base2024.filter(row => {
      const pipeline = (row[pipelineStatusCol] || '').toString().trim().toLowerCase();
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return pipeline === 'sold' && !excludeStatuses.includes(status);
    });

    const soldAndExcludeInProgress2025 = base2025.filter(row => {
      const pipeline = (row[pipelineStatusCol] || '').toString().trim().toLowerCase();
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return pipeline === 'sold' && !excludeStatuses.includes(status);
    });

    console.log(`Pipeline='Sold' AND exclude in-progress statuses:`);
    console.log(`  2024: ${soldAndExcludeInProgress2024.length} (need ${591}, diff: ${soldAndExcludeInProgress2024.length - 591})`);
    console.log(`  2025: ${soldAndExcludeInProgress2025.length} (need ${1086}, diff: ${soldAndExcludeInProgress2025.length - 1086})\n`);

    // Test: Only won statuses AND exclude in-progress
    const wonAndExcludeInProgress2024 = base2024.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return wonStatuses.includes(status) && !excludeStatuses.includes(status);
    });

    const wonAndExcludeInProgress2025 = base2025.filter(row => {
      const status = (row[statusCol] || '').toString().toLowerCase().trim();
      return wonStatuses.includes(status) && !excludeStatuses.includes(status);
    });

    console.log(`Won statuses AND exclude in-progress:`);
    console.log(`  2024: ${wonAndExcludeInProgress2024.length} (need ${591}, diff: ${wonAndExcludeInProgress2024.length - 591})`);
    console.log(`  2025: ${wonAndExcludeInProgress2025.length} (need ${1086}, diff: ${wonAndExcludeInProgress2025.length - 1086})\n`);

    // ============================================
    // SUMMARY
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY - Closest Matches:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const tests = [
      { name: 'Base (exclude_stats, archived, price>0)', 2024: base2024.length, 2025: base2025.length },
      { name: 'Only won statuses', 2024: won2024.length, 2025: won2025.length },
      { name: 'Exclude in-progress statuses', 2024: withoutInProgress2024.length, 2025: withoutInProgress2025.length },
      { name: 'Pipeline=Sold only', 2024: sold2024.length, 2025: sold2025.length },
      { name: 'Pipeline=Sold AND exclude in-progress', 2024: soldAndExcludeInProgress2024.length, 2025: soldAndExcludeInProgress2025.length },
      { name: 'Won statuses AND exclude in-progress', 2024: wonAndExcludeInProgress2024.length, 2025: wonAndExcludeInProgress2025.length }
    ];

    tests.forEach(test => {
      const diff2024 = Math.abs(test[2024] - 591);
      const diff2025 = Math.abs(test[2025] - 1086);
      const totalDiff = diff2024 + diff2025;
      console.log(`${test.name}:`);
      console.log(`  2024: ${test[2024]} (diff: ${diff2024})`);
      console.log(`  2025: ${test[2025]} (diff: ${diff2025})`);
      console.log(`  Total difference: ${totalDiff}\n`);
    });

    // Find closest match
    const closest = tests.reduce((best, current) => {
      const currentScore = Math.abs(current[2024] - 591) + Math.abs(current[2025] - 1086);
      const bestScore = Math.abs(best[2024] - 591) + Math.abs(best[2025] - 1086);
      return currentScore < bestScore ? current : best;
    });

    console.log(`✅ Closest match: ${closest.name}`);
    console.log(`  This is ${Math.abs(closest[2024] - 591) + Math.abs(closest[2025] - 1086)} estimates different from LMN's report\n`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

investigateReportFilters();
