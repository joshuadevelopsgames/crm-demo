#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Try to load .env file if it exists (for local development)
try {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^[\"']|[\"']$/g, '');
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.error('Error loading .env file:', e);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables or .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function extractYearFromDateString(dateStr) {
  if (!dateStr) return null;
  const yearMatch = dateStr.match(/\b(20[0-9]{2})\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1]);
  }
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
}

function convertExcelDate(excelSerial) {
  if (typeof excelSerial !== 'number') return null;
  const excelEpoch = new Date(1899, 11, 30);
  const jsDate = new Date(excelEpoch.getTime() + (excelSerial - 1) * 24 * 60 * 60 * 1000);
  return jsDate.toISOString().split('T')[0];
}

async function investigateLMNReportFilters() {
  console.log('🔍 Investigating what filters LMN report applies to get 1,839 from 1,970...\n');

  try {
    // Read LMN export
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List (3).xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const lmnData = XLSX.utils.sheet_to_json(worksheet);

    const dateColumn = 'Estimate Date';
    const estimateIdColumn = 'Estimate ID';
    const excludeStatsColumn = 'Exclude Stats';
    const statusColumn = 'Status';
    const archivedColumn = 'Archived';
    const salesPipelineStatusColumn = 'Sales Pipeline Status';

    // Filter LMN data for 2025
    const year2025 = 2025;
    const lmn2025 = lmnData.filter(row => {
      if (!row[dateColumn] || row[dateColumn] === null || row[dateColumn] === undefined) return false;
      const dateValue = row[dateColumn];
      let year = null;
      if (dateValue instanceof Date) {
        year = dateValue.getFullYear();
      } else if (typeof dateValue === 'string') {
        year = extractYearFromDateString(dateValue);
      } else if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate = new Date(excelEpoch.getTime() + (dateValue - 1) * 24 * 60 * 60 * 1000);
        year = jsDate.getFullYear();
      }
      return year === year2025;
    });

    // Apply exclude_stats filter (what we currently do)
    const lmn2025Filtered = lmn2025.filter(row => {
      const excludeValue = row[excludeStatsColumn];
      if (excludeValue === true || excludeValue === 'True' || excludeValue === 'true') {
        return false;
      }
      return true;
    });

    console.log(`📊 LMN export 2025 estimates (after exclude_stats): ${lmn2025Filtered.length}`);
    console.log(`📊 LMN report shows: 1,839`);
    console.log(`📊 Difference: ${lmn2025Filtered.length - 1839} estimates\n`);

    // Get unique IDs
    const lmn2025Ids = new Set();
    lmn2025Filtered.forEach(row => {
      if (row[estimateIdColumn]) {
        const id = String(row[estimateIdColumn]).trim();
        if (id) {
          lmn2025Ids.add(id);
        }
      }
    });

    console.log(`📊 Unique estimate IDs: ${lmn2025Ids.size}\n`);

    // Test various filter combinations to find what gets us to 1,839
    console.log('🔍 Testing filter combinations:\n');

    // Test 1: Exclude "Lost" pipeline status
    const test1 = lmn2025Filtered.filter(r => {
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      return pipelineStatus !== 'Lost';
    });
    const test1Ids = new Set();
    test1.forEach(r => {
      if (r[estimateIdColumn]) test1Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`1. Excluding "Lost" pipeline status: ${test1Ids.size} (diff: ${test1Ids.size - 1839})`);

    // Test 2: Exclude "Pending" pipeline status
    const test2 = lmn2025Filtered.filter(r => {
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      return pipelineStatus !== 'Pending';
    });
    const test2Ids = new Set();
    test2.forEach(r => {
      if (r[estimateIdColumn]) test2Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`2. Excluding "Pending" pipeline status: ${test2Ids.size} (diff: ${test2Ids.size - 1839})`);

    // Test 3: Exclude both "Lost" and "Pending" pipeline status
    const test3 = lmn2025Filtered.filter(r => {
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      return pipelineStatus !== 'Lost' && pipelineStatus !== 'Pending';
    });
    const test3Ids = new Set();
    test3.forEach(r => {
      if (r[estimateIdColumn]) test3Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`3. Excluding "Lost" + "Pending" pipeline: ${test3Ids.size} (diff: ${test3Ids.size - 1839})`);

    // Test 4: Only "Sold" pipeline status
    const test4 = lmn2025Filtered.filter(r => {
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      return pipelineStatus === 'Sold';
    });
    const test4Ids = new Set();
    test4.forEach(r => {
      if (r[estimateIdColumn]) test4Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`4. Only "Sold" pipeline status: ${test4Ids.size} (diff: ${test4Ids.size - 1839})`);

    // Test 5: Exclude certain statuses
    const test5 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return !status.includes('Lost') && status !== 'Work Complete' && status !== 'Billing Complete';
    });
    const test5Ids = new Set();
    test5.forEach(r => {
      if (r[estimateIdColumn]) test5Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`5. Excluding Lost/Complete statuses: ${test5Ids.size} (diff: ${test5Ids.size - 1839})`);

    // Test 6: Exclude "Estimate In Progress" status
    const test6 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return status !== 'Estimate In Progress';
    });
    const test6Ids = new Set();
    test6.forEach(r => {
      if (r[estimateIdColumn]) test6Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`6. Excluding "Estimate In Progress": ${test6Ids.size} (diff: ${test6Ids.size - 1839})`);

    // Test 7: Exclude "Client Proposal Phase" status
    const test7 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return status !== 'Client Proposal Phase';
    });
    const test7Ids = new Set();
    test7.forEach(r => {
      if (r[estimateIdColumn]) test7Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`7. Excluding "Client Proposal Phase": ${test7Ids.size} (diff: ${test7Ids.size - 1839})`);

    // Test 8: Only include "decided" estimates (Contract Signed, Work Complete, Estimate Lost, etc.)
    const test8 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      const decidedStatuses = [
        'Contract Signed',
        'Work Complete',
        'Billing Complete',
        'Email Contract Award',
        'Verbal Contract Award',
        'Estimate Lost',
        'Estimate Lost - Price too high',
        'Estimate Lost - No Reply'
      ];
      return decidedStatuses.includes(status);
    });
    const test8Ids = new Set();
    test8.forEach(r => {
      if (r[estimateIdColumn]) test8Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`8. Only "decided" statuses: ${test8Ids.size} (diff: ${test8Ids.size - 1839})`);

    // Test 9: Exclude "Estimate In Progress" and "Client Proposal Phase"
    const test9 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return status !== 'Estimate In Progress' && status !== 'Client Proposal Phase';
    });
    const test9Ids = new Set();
    test9.forEach(r => {
      if (r[estimateIdColumn]) test9Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`9. Excluding "Estimate In Progress" + "Client Proposal Phase": ${test9Ids.size} (diff: ${test9Ids.size - 1839})`);

    // Test 10: Exclude "Pending" pipeline + "Estimate In Progress" + "Client Proposal Phase"
    const test10 = lmn2025Filtered.filter(r => {
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      const status = r[statusColumn] || '';
      return pipelineStatus !== 'Pending' && 
             status !== 'Estimate In Progress' && 
             status !== 'Client Proposal Phase';
    });
    const test10Ids = new Set();
    test10.forEach(r => {
      if (r[estimateIdColumn]) test10Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`10. Excluding Pending pipeline + In Progress + Proposal Phase: ${test10Ids.size} (diff: ${test10Ids.size - 1839})`);

    // Test 11: Exclude "Client Proposal Phase" + some "Estimate In Progress" (partial)
    // Maybe LMN excludes some but not all "Estimate In Progress"
    const test11 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return status !== 'Client Proposal Phase';
    });
    const test11Ids = new Set();
    test11.forEach(r => {
      if (r[estimateIdColumn]) test11Ids.add(String(r[estimateIdColumn]).trim());
    });
    // We have 1,752, need 1,839, so we need 87 more
    // Maybe exclude some "Estimate In Progress" but not all?
    const inProgress = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return status === 'Estimate In Progress';
    });
    console.log(`11. Excluding Client Proposal Phase only: ${test11Ids.size} (diff: ${test11Ids.size - 1839})`);
    console.log(`    We need ${1839 - test11Ids.size} more estimates`);
    console.log(`    Estimate In Progress count: ${inProgress.length}`);

    // Test 12: Exclude "Client Proposal Phase" + exclude some "Estimate In Progress" based on pipeline status
    const test12 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      // Exclude Client Proposal Phase
      if (status === 'Client Proposal Phase') return false;
      // Exclude Estimate In Progress that are Lost in pipeline
      if (status === 'Estimate In Progress' && pipelineStatus === 'Lost') return false;
      return true;
    });
    const test12Ids = new Set();
    test12.forEach(r => {
      if (r[estimateIdColumn]) test12Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`12. Excluding Client Proposal Phase + In Progress (Lost pipeline): ${test12Ids.size} (diff: ${test12Ids.size - 1839})`);

    // Test 13: Exclude "Client Proposal Phase" + exclude "Estimate In Progress" with certain conditions
    // Try excluding Estimate In Progress that don't have a close date
    const test13 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      const closeDate = r['Estimate Close Date'];
      // Exclude Client Proposal Phase
      if (status === 'Client Proposal Phase') return false;
      // Exclude Estimate In Progress without close date
      if (status === 'Estimate In Progress' && !closeDate) return false;
      return true;
    });
    const test13Ids = new Set();
    test13.forEach(r => {
      if (r[estimateIdColumn]) test13Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`13. Excluding Client Proposal Phase + In Progress (no close date): ${test13Ids.size} (diff: ${test13Ids.size - 1839})`);

    // Test 14: Try excluding exactly 131 estimates - what are they?
    // We need to find which 131 estimates LMN excludes
    // Let's check if there's a pattern in the ones we'd exclude with test7 (Client Proposal Phase)
    const proposalPhase = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return status === 'Client Proposal Phase';
    });
    console.log(`\n📊 Client Proposal Phase count: ${proposalPhase.length}`);
    console.log(`   If we exclude these, we get: ${test7Ids.size}`);
    console.log(`   We need: ${1839 - test7Ids.size} more to exclude\n`);

    // Test 15: Exclude Client Proposal Phase + exclude some Estimate In Progress
    // We need 87 more, and there are 432 Estimate In Progress
    // Maybe exclude Estimate In Progress that are Pending in pipeline?
    const test15 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      // Exclude Client Proposal Phase
      if (status === 'Client Proposal Phase') return false;
      // Exclude Estimate In Progress that are Pending
      if (status === 'Estimate In Progress' && pipelineStatus === 'Pending') return false;
      return true;
    });
    const test15Ids = new Set();
    test15.forEach(r => {
      if (r[estimateIdColumn]) test15Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`15. Excluding Client Proposal Phase + In Progress (Pending): ${test15Ids.size} (diff: ${test15Ids.size - 1839})`);

    // Test 16: Exclude Client Proposal Phase + exclude some Estimate In Progress based on close date
    // Maybe exclude Estimate In Progress without close date that are older?
    const test16 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      const closeDate = r['Estimate Close Date'];
      const dateValue = r[dateColumn];
      // Exclude Client Proposal Phase
      if (status === 'Client Proposal Phase') return false;
      // Exclude Estimate In Progress without close date
      if (status === 'Estimate In Progress' && !closeDate) {
        // Maybe exclude if date is before a certain point?
        // Let's try excluding all without close date first
        return false;
      }
      return true;
    });
    const test16Ids = new Set();
    test16.forEach(r => {
      if (r[estimateIdColumn]) test16Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`16. Excluding Client Proposal Phase + In Progress (no close date): ${test16Ids.size} (diff: ${test16Ids.size - 1839})`);

    // Test 17: Maybe LMN only counts estimates that have been "decided" (won or lost)
    // But that would be too few (1,302). Let me check what "decided" means in LMN context
    // Maybe it means estimates with a close date OR a final status?
    const test17 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      const closeDate = r['Estimate Close Date'];
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      // Include if it has a close date OR is in a final status
      const hasCloseDate = closeDate && closeDate !== null && closeDate !== '';
      const isFinalStatus = ['Contract Signed', 'Work Complete', 'Billing Complete', 
                            'Email Contract Award', 'Verbal Contract Award',
                            'Estimate Lost', 'Estimate Lost - Price too high', 
                            'Estimate Lost - No Reply'].includes(status);
      const isSold = pipelineStatus === 'Sold';
      return hasCloseDate || isFinalStatus || isSold;
    });
    const test17Ids = new Set();
    test17.forEach(r => {
      if (r[estimateIdColumn]) test17Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`17. Only estimates with close date OR final status OR Sold: ${test17Ids.size} (diff: ${test17Ids.size - 1839})`);

    // Test 18: Maybe LMN excludes estimates based on when they were created vs when they're dated
    // Or maybe it's a combination: Exclude Client Proposal Phase + exclude some Estimate In Progress
    // Let's try excluding exactly 87 Estimate In Progress (the difference)
    // We need to find which 87 to exclude
    const inProgressList = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return status === 'Estimate In Progress';
    });
    // Try excluding Estimate In Progress that are Pending and don't have close date
    const test18 = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      const closeDate = r['Estimate Close Date'];
      // Exclude Client Proposal Phase
      if (status === 'Client Proposal Phase') return false;
      // Exclude Estimate In Progress that are Pending AND don't have close date
      if (status === 'Estimate In Progress' && pipelineStatus === 'Pending' && !closeDate) return false;
      return true;
    });
    const test18Ids = new Set();
    test18.forEach(r => {
      if (r[estimateIdColumn]) test18Ids.add(String(r[estimateIdColumn]).trim());
    });
    console.log(`18. Excluding Client Proposal Phase + In Progress (Pending, no close date): ${test18Ids.size} (diff: ${test18Ids.size - 1839})`);

    // Find the exact match
    const tests = [
      { name: 'Excluding Lost pipeline', count: test1Ids.size },
      { name: 'Excluding Pending pipeline', count: test2Ids.size },
      { name: 'Excluding Lost + Pending pipeline', count: test3Ids.size },
      { name: 'Only Sold pipeline', count: test4Ids.size },
      { name: 'Excluding Lost/Complete statuses', count: test5Ids.size },
      { name: 'Excluding Estimate In Progress', count: test6Ids.size },
      { name: 'Excluding Client Proposal Phase', count: test7Ids.size },
      { name: 'Only decided statuses', count: test8Ids.size },
      { name: 'Excluding In Progress + Proposal Phase', count: test9Ids.size },
      { name: 'Excluding Pending + In Progress + Proposal', count: test10Ids.size },
      { name: 'Excluding Client Proposal Phase + In Progress (Lost)', count: test12Ids.size },
      { name: 'Excluding Client Proposal Phase + In Progress (no close date)', count: test13Ids.size },
      { name: 'Excluding Client Proposal Phase + In Progress (Pending)', count: test15Ids.size },
      { name: 'Only estimates with close date OR final status OR Sold', count: test17Ids.size },
      { name: 'Excluding Client Proposal Phase + In Progress (Pending, no close date)', count: test18Ids.size }
    ];

    const exactMatch = tests.find(t => t.count === 1839);
    const closest = tests.reduce((best, current) => {
      const currentDiff = Math.abs(current.count - 1839);
      const bestDiff = Math.abs(best.count - 1839);
      return currentDiff < bestDiff ? current : best;
    });

    console.log(`\n✅ Closest match: ${closest.name} with ${closest.count} (diff: ${closest.count - 1839})\n`);

    if (exactMatch) {
      console.log(`🎉 EXACT MATCH! LMN report uses: ${exactMatch.name}`);
    } else {
      console.log(`⚠️  No exact match found. The closest is ${closest.name}.`);
      console.log(`\n   This suggests LMN may use a combination of filters or a different logic.`);
    }

    // Show breakdown of what would be excluded
    if (closest.count === test10Ids.size) {
      const pendingCount = lmn2025Filtered.filter(r => {
        const pipelineStatus = r[salesPipelineStatusColumn] || '';
        return pipelineStatus === 'Pending';
      }).length;
      const inProgressCount = lmn2025Filtered.filter(r => {
        const status = r[statusColumn] || '';
        return status === 'Estimate In Progress';
      }).length;
      const proposalCount = lmn2025Filtered.filter(r => {
        const status = r[statusColumn] || '';
        return status === 'Client Proposal Phase';
      }).length;
      console.log(`\n   Breakdown of excluded estimates:`);
      console.log(`   - Pending pipeline: ${pendingCount}`);
      console.log(`   - Estimate In Progress: ${inProgressCount}`);
      console.log(`   - Client Proposal Phase: ${proposalCount}`);
      console.log(`   - Total excluded: ${pendingCount + inProgressCount + proposalCount} (may overlap)`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

investigateLMNReportFilters();

