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

async function investigateLMNFilters() {
  console.log('🔍 Investigating LMN additional filters...\n');

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

    // First apply exclude_stats filter
    const lmn2025Filtered = lmn2025.filter(row => {
      const excludeValue = row[excludeStatsColumn];
      if (excludeValue === true || excludeValue === 'True' || excludeValue === 'true') {
        return false; // Exclude these
      }
      return true; // Include these
    });

    // Get LMN estimate IDs (with duplicate removal)
    const lmn2025Ids = new Set();
    lmn2025.forEach(row => {
      if (row[estimateIdColumn]) {
        const id = String(row[estimateIdColumn]).trim();
        if (id) {
          lmn2025Ids.add(id);
        }
      }
    });

    // Get unique IDs after exclude_stats filter
    const lmn2025FilteredIds = new Set();
    lmn2025Filtered.forEach(row => {
      if (row[estimateIdColumn]) {
        const id = String(row[estimateIdColumn]).trim();
        if (id) {
          lmn2025FilteredIds.add(id);
        }
      }
    });

    console.log(`📊 LMN export has ${lmn2025.length} estimates for 2025`);
    console.log(`📊 After exclude_stats filter: ${lmn2025Filtered.length} estimates`);
    console.log(`📊 Unique IDs after exclude_stats: ${lmn2025FilteredIds.size}`);
    console.log(`📊 LMN report shows: 1,839`);
    console.log(`📊 Difference: ${lmn2025FilteredIds.size - 1839} estimates\n`);

    // Fetch all our estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, exclude_stats, status, archived')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching estimates:', error);
        return;
      }

      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    // Our estimates with duplicate removal
    const ourUnique = [];
    const seenLmnIds = new Set();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seenLmnIds.has(est.lmn_estimate_id)) {
          seenLmnIds.add(est.lmn_estimate_id);
          ourUnique.push(est);
        }
      } else {
        ourUnique.push(est);
      }
    });

    // Our 2025 estimates (excluding exclude_stats)
    const our2025 = ourUnique.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats === true) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    // Find estimates we have that are NOT in LMN's list
    const ourNotInLMN = our2025.filter(e => {
      const estId = e.lmn_estimate_id || e.estimate_number;
      if (!estId) return true;
      return !lmn2025Ids.has(estId);
    });

    console.log(`📊 Our 2025 estimates (excluding exclude_stats): ${our2025.length}`);
    console.log(`📊 Estimates we have that are NOT in LMN's list: ${ourNotInLMN.length}\n`);

    // Analyze the 40 "2025-01-01" estimates (timezone issue)
    const jan1Estimates = ourNotInLMN.filter(e => {
      if (!e.estimate_date) return false;
      return e.estimate_date.includes('2025-01-01');
    });

    console.log(`📊 Estimates with "2025-01-01" date (timezone issue): ${jan1Estimates.length}`);
    console.log(`   (These are actually 2024 dates, LMN correctly excludes them)\n`);

    // The remaining estimates (131 - 40 = 91, but let's check all)
    const otherNotInLMN = ourNotInLMN.filter(e => {
      if (!e.estimate_date) return false;
      return !e.estimate_date.includes('2025-01-01');
    });

    console.log(`📊 Other estimates we have that LMN doesn't include: ${otherNotInLMN.length}\n`);

    // Analyze status distribution
    const statusCounts = {};
    otherNotInLMN.forEach(e => {
      const status = e.status || 'null';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log(`📊 Status distribution of estimates we have but LMN doesn't:`);
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log();

    // Check archived status
    const archivedCount = otherNotInLMN.filter(e => e.archived === true).length;
    console.log(`📊 Archived estimates: ${archivedCount} out of ${otherNotInLMN.length}\n`);

    // Now check what LMN's export shows for status/archived
    // Find estimates in LMN's export that match our "otherNotInLMN" by ID
    const lmnStatusCounts = {};
    const lmnArchivedCount = { true: 0, false: 0 };

    lmn2025.forEach(row => {
      const estId = String(row[estimateIdColumn] || '').trim();
      if (!estId) return;

      // Check if this is one of our "otherNotInLMN" estimates
      const ourEst = otherNotInLMN.find(e => 
        (e.lmn_estimate_id === estId || e.estimate_number === estId)
      );

      if (ourEst) {
        const status = row[statusColumn] || 'null';
        lmnStatusCounts[status] = (lmnStatusCounts[status] || 0) + 1;

        const archived = row[archivedColumn];
        if (archived === true || archived === 'True' || archived === 'true') {
          lmnArchivedCount.true++;
        } else {
          lmnArchivedCount.false++;
        }
      }
    });

    console.log(`📊 Status in LMN export for estimates we have but LMN report excludes:`);
    Object.entries(lmnStatusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log();

    // Check if LMN report excludes certain statuses
    // Compare what's in the export vs what we think should be in the report
    const lmnExportStatusCounts = {};
    lmn2025.forEach(row => {
      const excludeValue = row[excludeStatsColumn];
      if (excludeValue === false || excludeValue === 'False' || excludeValue === 'false' || !excludeValue) {
        const status = row[statusColumn] || 'null';
        lmnExportStatusCounts[status] = (lmnExportStatusCounts[status] || 0) + 1;
      }
    });

    console.log(`📊 Status distribution in LMN export (after exclude_stats filter):`);
    Object.entries(lmnExportStatusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log();

    // Try to find which statuses might be excluded in the report
    // The export has 1,970 unique IDs, but report shows 1,839
    // That's 131 fewer in the report
    console.log(`📊 Difference between export and report: ${lmn2025Ids.size - 1839} estimates\n`);

    // Check if certain statuses are excluded
    const statusesToTest = ['Estimate Lost', 'Estimate Lost - Price too high', 'Estimate In Progress', 'Contract Signed', 'Email Contract Award'];
    
    console.log(`🔍 Testing if certain statuses are excluded in LMN report:\n`);
    
    for (const statusToTest of statusesToTest) {
      const countInExport = lmn2025.filter(r => {
        const excludeValue = r[excludeStatsColumn];
        if (excludeValue === true || excludeValue === 'True' || excludeValue === 'true') return false;
        return (r[statusColumn] || '') === statusToTest;
      }).length;

      console.log(`   ${statusToTest}: ${countInExport} in export`);
    }

    // Check archived in export
    const archivedInExport = lmn2025.filter(r => {
      const excludeValue = r[excludeStatsColumn];
      if (excludeValue === true || excludeValue === 'True' || excludeValue === 'true') return false;
      const archived = r[archivedColumn];
      return archived === true || archived === 'True' || archived === 'true';
    }).length;

    console.log(`   Archived: ${archivedInExport} in export\n`);

    // Try to match the 1,839 count by excluding certain statuses
    console.log(`🔍 Testing combinations to match 1,839:\n`);

    // Test 1: Exclude "Estimate Lost" statuses (on already filtered data)
    const excludingLost = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return !status.includes('Lost');
    });
    const uniqueExcludingLost = new Set();
    excludingLost.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueExcludingLost.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Excluding "Lost" statuses: ${uniqueExcludingLost.size} (diff: ${uniqueExcludingLost.size - 1839})`);

    // Test 2: Exclude archived (on already filtered data)
    const excludingArchived = lmn2025Filtered.filter(r => {
      const archived = r[archivedColumn];
      return !(archived === true || archived === 'True' || archived === 'true');
    });
    const uniqueExcludingArchived = new Set();
    excludingArchived.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueExcludingArchived.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Excluding archived: ${uniqueExcludingArchived.size} (diff: ${uniqueExcludingArchived.size - 1839})`);

    // Test 3: Exclude both Lost and archived (on already filtered data)
    const excludingBoth = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      const archived = r[archivedColumn];
      return !status.includes('Lost') && !(archived === true || archived === 'True' || archived === 'true');
    });
    const uniqueExcludingBoth = new Set();
    excludingBoth.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueExcludingBoth.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Excluding Lost + archived: ${uniqueExcludingBoth.size} (diff: ${uniqueExcludingBoth.size - 1839})`);

    // Test 4: Only include certain statuses (on already filtered data)
    const onlySold = lmn2025Filtered.filter(r => {
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      return pipelineStatus === 'Sold';
    });
    const uniqueOnlySold = new Set();
    onlySold.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueOnlySold.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Only "Sold" pipeline status: ${uniqueOnlySold.size} (diff: ${uniqueOnlySold.size - 1839})`);

    // Test 5: Exclude "Lost" from Sales Pipeline Status (on already filtered data)
    const excludingLostPipeline = lmn2025Filtered.filter(r => {
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      return pipelineStatus !== 'Lost';
    });
    const uniqueExcludingLostPipeline = new Set();
    excludingLostPipeline.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueExcludingLostPipeline.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Excluding "Lost" pipeline status: ${uniqueExcludingLostPipeline.size} (diff: ${uniqueExcludingLostPipeline.size - 1839})`);

    // Test 6: Exclude both Lost status AND Lost pipeline (on already filtered data)
    const excludingLostBoth = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      return !status.includes('Lost') && pipelineStatus !== 'Lost';
    });
    const uniqueExcludingLostBoth = new Set();
    excludingLostBoth.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueExcludingLostBoth.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Excluding Lost (status + pipeline): ${uniqueExcludingLostBoth.size} (diff: ${uniqueExcludingLostBoth.size - 1839})`);

    // Test 7: Check Sales Pipeline Status distribution (on already filtered data)
    const pipelineStatusCounts = {};
    lmn2025Filtered.forEach(r => {
      const pipelineStatus = r[salesPipelineStatusColumn] || 'null';
      pipelineStatusCounts[pipelineStatus] = (pipelineStatusCounts[pipelineStatus] || 0) + 1;
    });
    console.log(`\n📊 Sales Pipeline Status distribution:`);
    Object.entries(pipelineStatusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log();

    // Test 8: Exclude "Lost" and "Pending" pipeline statuses (on already filtered data)
    const excludingLostPending = lmn2025Filtered.filter(r => {
      const pipelineStatus = r[salesPipelineStatusColumn] || '';
      return pipelineStatus !== 'Lost' && pipelineStatus !== 'Pending';
    });
    const uniqueExcludingLostPending = new Set();
    excludingLostPending.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueExcludingLostPending.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Excluding Lost + Pending pipeline: ${uniqueExcludingLostPending.size} (diff: ${uniqueExcludingLostPending.size - 1839})`);

    // Test 9: Exclude "Work Complete" and "Billing Complete" statuses
    const excludingComplete = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return status !== 'Work Complete' && status !== 'Billing Complete';
    });
    const uniqueExcludingComplete = new Set();
    excludingComplete.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueExcludingComplete.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Excluding Work Complete + Billing Complete: ${uniqueExcludingComplete.size} (diff: ${uniqueExcludingComplete.size - 1839})`);

    // Test 10: Exclude Lost + Complete statuses
    const excludingLostAndComplete = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return !status.includes('Lost') && status !== 'Work Complete' && status !== 'Billing Complete';
    });
    const uniqueExcludingLostAndComplete = new Set();
    excludingLostAndComplete.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueExcludingLostAndComplete.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Excluding Lost + Complete statuses: ${uniqueExcludingLostAndComplete.size} (diff: ${uniqueExcludingLostAndComplete.size - 1839})`);

    // Test 11: Only include "active" statuses (not Lost, not Complete)
    const onlyActive = lmn2025Filtered.filter(r => {
      const status = r[statusColumn] || '';
      return !status.includes('Lost') && 
             status !== 'Work Complete' && 
             status !== 'Billing Complete' &&
             status !== 'Work In Progress';
    });
    const uniqueOnlyActive = new Set();
    onlyActive.forEach(r => {
      if (r[estimateIdColumn]) {
        uniqueOnlyActive.add(String(r[estimateIdColumn]).trim());
      }
    });
    console.log(`   Only active statuses (no Lost/Complete/In Progress): ${uniqueOnlyActive.size} (diff: ${uniqueOnlyActive.size - 1839})`);

    // Find the closest match
    const tests = [
      { name: 'Excluding Lost', count: uniqueExcludingLost.size },
      { name: 'Excluding archived', count: uniqueExcludingArchived.size },
      { name: 'Excluding Lost + archived', count: uniqueExcludingBoth.size },
      { name: 'Only Sold', count: uniqueOnlySold.size },
      { name: 'Excluding Lost pipeline', count: uniqueExcludingLostPipeline.size },
      { name: 'Excluding Lost (status + pipeline)', count: uniqueExcludingLostBoth.size },
      { name: 'Excluding Lost + Pending pipeline', count: uniqueExcludingLostPending.size },
      { name: 'Excluding Complete statuses', count: uniqueExcludingComplete.size },
      { name: 'Excluding Lost + Complete', count: uniqueExcludingLostAndComplete.size },
      { name: 'Only active statuses', count: uniqueOnlyActive.size }
    ];

    const closest = tests.reduce((best, current) => {
      const currentDiff = Math.abs(current.count - 1839);
      const bestDiff = Math.abs(best.count - 1839);
      return currentDiff < bestDiff ? current : best;
    });

    console.log(`\n✅ Closest match: ${closest.name} with ${closest.count} (diff: ${closest.count - 1839})\n`);

    if (closest.count === 1839) {
      console.log(`🎉 EXACT MATCH! LMN report likely uses: ${closest.name}`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    console.error(error.stack);
  }
}

investigateLMNFilters();

