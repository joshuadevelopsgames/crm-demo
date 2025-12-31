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

async function diagnoseEstimateCount() {
  console.log('🔍 Diagnosing estimate count discrepancy for 2025...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, estimate_close_date, status, created_at')
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

    console.log(`📊 Total estimates in database: ${allEstimates.length}\n`);

    // Check for duplicates by lmn_estimate_id
    const lmnIdMap = new Map();
    const duplicates = [];
    allEstimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (lmnIdMap.has(est.lmn_estimate_id)) {
          duplicates.push({
            lmn_estimate_id: est.lmn_estimate_id,
            id1: lmnIdMap.get(est.lmn_estimate_id),
            id2: est.id
          });
        } else {
          lmnIdMap.set(est.lmn_estimate_id, est.id);
        }
      }
    });

    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate estimates (same lmn_estimate_id):`);
      duplicates.slice(0, 10).forEach(dup => {
        console.log(`   - lmn_estimate_id: ${dup.lmn_estimate_id} (appears in records: ${dup.id1}, ${dup.id2})`);
      });
      if (duplicates.length > 10) {
        console.log(`   ... and ${duplicates.length - 10} more`);
      }
      console.log();
    } else {
      console.log('✅ No duplicates found by lmn_estimate_id\n');
    }

    // Filter for 2025 using the same logic as Reports page
    const year2025 = 2025;
    const filtered2025 = allEstimates.filter(estimate => {
      const estimateDate = estimate.estimate_close_date || estimate.estimate_date;
      if (!estimateDate) return false;
      const estimateYear = new Date(estimateDate).getFullYear();
      return estimateYear === year2025;
    });

    console.log(`📅 Estimates for 2025 (using estimate_close_date || estimate_date): ${filtered2025.length}`);
    console.log(`   Expected (from LMN): 1,839`);
    console.log(`   Difference: ${filtered2025.length - 1839} estimates\n`);

    // Analyze date fields
    const withCloseDate = filtered2025.filter(e => e.estimate_close_date).length;
    const withEstimateDate = filtered2025.filter(e => e.estimate_date && !e.estimate_close_date).length;
    const withBoth = filtered2025.filter(e => e.estimate_close_date && e.estimate_date).length;
    const withNeither = filtered2025.filter(e => !e.estimate_close_date && !e.estimate_date).length;

    console.log(`📊 Date field analysis for 2025 estimates:`);
    console.log(`   - With estimate_close_date: ${withCloseDate}`);
    console.log(`   - With estimate_date only: ${withEstimateDate}`);
    console.log(`   - With both dates: ${withBoth}`);
    console.log(`   - With neither date: ${withNeither}\n`);

    // Check for estimates that might be in wrong year due to date parsing
    const dateIssues = [];
    filtered2025.forEach(est => {
      const closeDate = est.estimate_close_date ? new Date(est.estimate_close_date) : null;
      const estDate = est.estimate_date ? new Date(est.estimate_date) : null;
      
      if (closeDate && isNaN(closeDate.getTime())) {
        dateIssues.push({ id: est.id, lmn_id: est.lmn_estimate_id, issue: 'Invalid estimate_close_date', date: est.estimate_close_date });
      }
      if (estDate && isNaN(estDate.getTime())) {
        dateIssues.push({ id: est.id, lmn_id: est.lmn_estimate_id, issue: 'Invalid estimate_date', date: est.estimate_date });
      }
    });

    if (dateIssues.length > 0) {
      console.log(`⚠️  Found ${dateIssues.length} estimates with invalid dates:`);
      dateIssues.slice(0, 10).forEach(issue => {
        console.log(`   - ${issue.lmn_id || issue.id}: ${issue.issue} = "${issue.date}"`);
      });
      if (dateIssues.length > 10) {
        console.log(`   ... and ${dateIssues.length - 10} more`);
      }
      console.log();
    }

    // Check for estimates that might be counted in 2025 but shouldn't be
    // (e.g., dates in 2024 or 2026 that are being parsed incorrectly)
    const wrongYear = [];
    allEstimates.forEach(est => {
      const closeDate = est.estimate_close_date ? new Date(est.estimate_close_date) : null;
      const estDate = est.estimate_date ? new Date(est.estimate_date) : null;
      const dateUsed = closeDate || estDate;
      
      if (dateUsed && !isNaN(dateUsed.getTime())) {
        const year = dateUsed.getFullYear();
        if (year !== 2025) {
          // Check if it would be incorrectly included
          const dateStr = est.estimate_close_date || est.estimate_date;
          // Check for date strings that might parse to 2025 incorrectly
          if (dateStr && (dateStr.includes('2025') || dateStr.includes('2024') || dateStr.includes('2026'))) {
            if (year === 2025 && (dateStr.includes('2024') || dateStr.includes('2026'))) {
              wrongYear.push({ id: est.id, lmn_id: est.lmn_estimate_id, dateStr, parsedYear: year });
            }
          }
        }
      }
    });

    // Check estimates by estimate_date vs estimate_close_date
    const byCloseDate = allEstimates.filter(e => {
      if (!e.estimate_close_date) return false;
      const year = new Date(e.estimate_close_date).getFullYear();
      return year === 2025;
    }).length;

    const byEstimateDate = allEstimates.filter(e => {
      if (!e.estimate_date) return false;
      const year = new Date(e.estimate_date).getFullYear();
      return year === 2025;
    }).length;

    console.log(`📊 Count by date field:`);
    console.log(`   - By estimate_close_date only: ${byCloseDate}`);
    console.log(`   - By estimate_date only: ${byEstimateDate}`);
    console.log(`   - Using logic: estimate_close_date || estimate_date: ${filtered2025.length}\n`);

    // Check for estimates with null/empty dates that might be getting included
    const estimatesWithoutDates = allEstimates.filter(e => !e.estimate_close_date && !e.estimate_date);
    console.log(`📊 Estimates without any date: ${estimatesWithoutDates.length}`);

    // Sample some estimates to see what's being counted
    console.log(`\n📋 Sample of 2025 estimates (first 10):`);
    filtered2025.slice(0, 10).forEach(est => {
      const dateUsed = est.estimate_close_date || est.estimate_date;
      const year = new Date(dateUsed).getFullYear();
      console.log(`   - ${est.lmn_estimate_id || est.estimate_number || est.id}: ${dateUsed} (year: ${year}, status: ${est.status})`);
    });

    // Check if there are estimates that should be excluded
    const excludedByStatus = filtered2025.filter(e => !e.status || e.status === '').length;
    console.log(`\n📊 Estimates without status: ${excludedByStatus}`);

    // Summary
    console.log(`\n📊 Summary:`);
    console.log(`   Total in DB: ${allEstimates.length}`);
    console.log(`   Filtered for 2025: ${filtered2025.length}`);
    console.log(`   Expected (LMN): 1,839`);
    console.log(`   Difference: ${filtered2025.length - 1839} extra estimates`);
    console.log(`   Duplicates by lmn_estimate_id: ${duplicates.length}`);

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

diagnoseEstimateCount();

