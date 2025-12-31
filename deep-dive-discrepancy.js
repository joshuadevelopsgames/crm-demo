#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
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

async function deepDiveDiscrepancy() {
  console.log('🔍 Deep dive into the 126 estimate discrepancy...\n');

  try {
    // Fetch all estimates with all relevant fields
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, status, archived, exclude_stats, estimate_type, pipeline_status, created_date, created_at')
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

    const year2025 = 2025;

    // Remove duplicates by lmn_estimate_id (keep first occurrence)
    const uniqueEstimates = [];
    const seenLmnIds = new Set();
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seenLmnIds.has(est.lmn_estimate_id)) {
          seenLmnIds.add(est.lmn_estimate_id);
          uniqueEstimates.push(est);
        }
      } else {
        uniqueEstimates.push(est);
      }
    });

    // Our current filter: estimate_date in 2025, exclude exclude_stats
    const ourFiltered = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      return new Date(e.estimate_date).getFullYear() === year2025;
    });

    console.log(`📊 Our filtered count: ${ourFiltered.length}`);
    console.log(`📊 Expected (LMN): 1,839`);
    console.log(`📊 Difference: ${ourFiltered.length - 1839} estimates\n`);

    // Analyze what might be different
    console.log('📊 Analyzing potential differences...\n');

    // 1. Check estimate_type
    const typeCounts = {};
    ourFiltered.forEach(e => {
      const type = e.estimate_type || 'null';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    console.log('1. Estimate Type breakdown:');
    Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
    console.log();

    // 2. Check pipeline_status
    const pipelineCounts = {};
    ourFiltered.forEach(e => {
      const status = e.pipeline_status || 'null';
      pipelineCounts[status] = (pipelineCounts[status] || 0) + 1;
    });
    console.log('2. Pipeline Status breakdown:');
    Object.entries(pipelineCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });
    console.log();

    // 3. Check status field
    const statusCounts = {};
    ourFiltered.forEach(e => {
      const status = e.status || 'null';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('3. Status breakdown:');
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });
    console.log();

    // 4. Check for estimates with estimate_date in 2025 but estimate_close_date in different year
    const dateMismatch = ourFiltered.filter(e => {
      if (!e.estimate_close_date) return false;
      const estYear = new Date(e.estimate_date).getFullYear();
      const closeYear = new Date(e.estimate_close_date).getFullYear();
      return estYear !== closeYear;
    });
    console.log(`4. Estimates with estimate_date in 2025 but estimate_close_date in different year: ${dateMismatch.length}`);
    if (dateMismatch.length > 0) {
      console.log('   Sample (first 10):');
      dateMismatch.slice(0, 10).forEach(e => {
        const estYear = new Date(e.estimate_date).getFullYear();
        const closeYear = e.estimate_close_date ? new Date(e.estimate_close_date).getFullYear() : 'null';
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: est_date=${e.estimate_date} (${estYear}), close_date=${e.estimate_close_date} (${closeYear})`);
      });
    }
    console.log();

    // 5. Check for estimates without lmn_estimate_id
    const withoutLmnId = ourFiltered.filter(e => !e.lmn_estimate_id);
    console.log(`5. Estimates without lmn_estimate_id: ${withoutLmnId.length}`);
    if (withoutLmnId.length > 0) {
      console.log('   Sample (first 10):');
      withoutLmnId.slice(0, 10).forEach(e => {
        console.log(`   - ${e.estimate_number || e.id}: ${e.estimate_date}, status=${e.status}`);
      });
    }
    console.log();

    // 6. Check created_date vs estimate_date
    const createdDateAnalysis = ourFiltered.map(e => {
      const estYear = e.estimate_date ? new Date(e.estimate_date).getFullYear() : null;
      const createdYear = e.created_date ? new Date(e.created_date).getFullYear() : null;
      return { est: e, estYear, createdYear };
    });
    const createdDateMismatch = createdDateAnalysis.filter(a => a.createdYear && a.estYear !== a.createdYear);
    console.log(`6. Estimates where created_date year ≠ estimate_date year: ${createdDateMismatch.length}`);
    if (createdDateMismatch.length > 0) {
      console.log('   Sample (first 10):');
      createdDateMismatch.slice(0, 10).forEach(a => {
        console.log(`   - ${a.est.lmn_estimate_id || a.est.estimate_number || a.est.id}: created=${a.est.created_date} (${a.createdYear}), est_date=${a.est.estimate_date} (${a.estYear})`);
      });
    }
    console.log();

    // 7. Check for estimates with null/empty estimate_number
    const withoutEstNumber = ourFiltered.filter(e => !e.estimate_number || e.estimate_number.trim() === '');
    console.log(`7. Estimates without estimate_number: ${withoutEstNumber.length}`);
    console.log();

    // 8. Check for estimates that might be test/demo data
    const testKeywords = ['test', 'demo', 'sample', 'example'];
    const possibleTest = ourFiltered.filter(e => {
      const estNum = (e.estimate_number || '').toLowerCase();
      const lmnId = (e.lmn_estimate_id || '').toLowerCase();
      return testKeywords.some(keyword => estNum.includes(keyword) || lmnId.includes(keyword));
    });
    console.log(`8. Possible test/demo estimates: ${possibleTest.length}`);
    if (possibleTest.length > 0) {
      console.log('   Sample (first 10):');
      possibleTest.slice(0, 10).forEach(e => {
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}`);
      });
    }
    console.log();

    // 9. Check date parsing - look for dates that might parse incorrectly
    const dateParsingIssues = [];
    ourFiltered.forEach(e => {
      const dateStr = e.estimate_date;
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
          dateParsingIssues.push({ est: e, dateStr });
        } else {
          const year = parsed.getFullYear();
          // Check if date string contains a different year
          if (dateStr.includes('2024') && year === 2025) {
            dateParsingIssues.push({ est: e, dateStr, issue: 'Date string contains 2024 but parses to 2025' });
          } else if (dateStr.includes('2026') && year === 2025) {
            dateParsingIssues.push({ est: e, dateStr, issue: 'Date string contains 2026 but parses to 2025' });
          }
        }
      }
    });
    console.log(`9. Date parsing issues: ${dateParsingIssues.length}`);
    if (dateParsingIssues.length > 0) {
      console.log('   Sample (first 10):');
      dateParsingIssues.slice(0, 10).forEach(issue => {
        console.log(`   - ${issue.est.lmn_estimate_id || issue.est.estimate_number || issue.est.id}: ${issue.dateStr} ${issue.issue || '(invalid date)'}`);
      });
    }
    console.log();

    // 10. Summary of what we need to exclude to get to 1839
    console.log('📊 Summary:');
    console.log(`   Current count: ${ourFiltered.length}`);
    console.log(`   Target (LMN): 1,839`);
    console.log(`   Need to exclude: ${ourFiltered.length - 1839} estimates`);
    console.log(`\n   Potential exclusions:`);
    console.log(`   - Without lmn_estimate_id: ${withoutLmnId.length}`);
    console.log(`   - Date mismatch (est_date ≠ close_date year): ${dateMismatch.length}`);
    console.log(`   - Created date mismatch: ${createdDateMismatch.length}`);
    console.log(`   - Without estimate_number: ${withoutEstNumber.length}`);
    console.log(`   - Possible test/demo: ${possibleTest.length}`);
    console.log(`   - Date parsing issues: ${dateParsingIssues.length}`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

deepDiveDiscrepancy();

