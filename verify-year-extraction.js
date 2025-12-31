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

// Helper function to extract year from date string (more reliable than parsing)
function extractYearFromDateString(dateStr) {
  if (!dateStr) return null;
  // Try to extract YYYY from the string (handles ISO format, etc.)
  const yearMatch = dateStr.match(/\b(20[0-9]{2})\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1]);
  }
  // Fallback to parsing
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
}

async function verifyYearExtraction() {
  console.log('🔍 Verifying year extraction method...\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_number, estimate_date, exclude_stats')
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

    // Remove duplicates
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

    const year2025 = 2025;

    // Method 1: Using getFullYear() (current method - has timezone issues)
    const method1 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      const parsed = new Date(e.estimate_date);
      if (isNaN(parsed.getTime())) return false;
      return parsed.getFullYear() === year2025;
    });

    // Method 2: Extracting year from string (more reliable)
    const method2 = uniqueEstimates.filter(e => {
      if (!e.estimate_date) return false;
      if (e.exclude_stats) return false;
      const year = extractYearFromDateString(e.estimate_date);
      return year === year2025;
    });

    console.log(`📊 Comparison of year extraction methods:`);
    console.log(`   Method 1 (getFullYear()): ${method1.length}`);
    console.log(`   Method 2 (string extraction): ${method2.length}`);
    console.log(`   Expected (LMN): 1,839`);
    console.log(`   Difference (Method 1): ${method1.length - 1839}`);
    console.log(`   Difference (Method 2): ${method2.length - 1839}\n`);

    // Find estimates that are in method1 but not method2 (incorrectly included)
    const method1Ids = new Set(method1.map(e => e.id));
    const method2Ids = new Set(method2.map(e => e.id));
    const incorrectlyIncluded = method1.filter(e => !method2Ids.has(e.id));
    const incorrectlyExcluded = method2.filter(e => !method1Ids.has(e.id));

    console.log(`📊 Estimates incorrectly included by getFullYear(): ${incorrectlyIncluded.length}`);
    if (incorrectlyIncluded.length > 0) {
      console.log('   Sample (first 10):');
      incorrectlyIncluded.slice(0, 10).forEach(e => {
        const parsedYear = new Date(e.estimate_date).getFullYear();
        const stringYear = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     getFullYear()=${parsedYear}, string extraction=${stringYear}`);
      });
    }

    console.log(`\n📊 Estimates incorrectly excluded by getFullYear(): ${incorrectlyExcluded.length}`);
    if (incorrectlyExcluded.length > 0) {
      console.log('   Sample (first 10):');
      incorrectlyExcluded.slice(0, 10).forEach(e => {
        const parsedYear = new Date(e.estimate_date).getFullYear();
        const stringYear = extractYearFromDateString(e.estimate_date);
        console.log(`   - ${e.lmn_estimate_id || e.estimate_number || e.id}: ${e.estimate_date}`);
        console.log(`     getFullYear()=${parsedYear}, string extraction=${stringYear}`);
      });
    }

    // Check what the remaining 9 difference might be
    if (method2.length === 1830) {
      console.log(`\n📊 Method 2 gives us 1,830 (9 off from LMN's 1,839)`);
      console.log(`   This suggests there might be 9 estimates that:`);
      console.log(`   - Have estimate_date that doesn't match 2025 in the string`);
      console.log(`   - But LMN still counts them as 2025`);
      console.log(`   - OR there are 9 estimates we're excluding that LMN includes`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

verifyYearExtraction();

