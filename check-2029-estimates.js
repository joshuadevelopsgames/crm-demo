#!/usr/bin/env node

/**
 * Check for Estimates with 2029 Dates
 * 
 * This script queries the database to find all estimates that have dates in 2029.
 * It checks all date fields: contract_end, contract_start, estimate_date, and created_date.
 */

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

/**
 * Extract year from a date value (handles both string and Date objects)
 */
function getYearFromDate(dateValue) {
  if (!dateValue) return null;
  
  // If it's already a string in YYYY-MM-DD format
  if (typeof dateValue === 'string') {
    const match = dateValue.match(/^(\d{4})/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  // Try parsing as Date
  const date = new Date(dateValue);
  if (!isNaN(date.getTime())) {
    return date.getFullYear();
  }
  
  return null;
}

/**
 * Format date for display
 */
function formatDate(dateValue) {
  if (!dateValue) return 'null';
  if (typeof dateValue === 'string') {
    // If it's already in a readable format, return as-is
    if (dateValue.includes('T')) {
      return dateValue.split('T')[0]; // Return date part only
    }
    return dateValue;
  }
  const date = new Date(dateValue);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return String(dateValue);
}

async function check2029Estimates() {
  console.log('🔍 Checking for estimates with 2029 dates...\n');
  
  // Fetch all estimates with date fields
  let allEstimates = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('estimates')
      .select('id, lmn_estimate_id, estimate_number, contract_end, contract_start, estimate_date, created_date, archived, status, project_name, account_id')
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('Error fetching estimates:', error);
      return;
    }
    
    if (data && data.length > 0) {
      allEstimates = allEstimates.concat(data);
      hasMore = data.length === pageSize;
      page++;
      console.log(`📄 Fetched page ${page}: ${data.length} estimates (total: ${allEstimates.length})`);
    } else {
      hasMore = false;
    }
  }
  
  console.log(`\n✅ Total estimates fetched: ${allEstimates.length}\n`);
  
  // Find estimates with 2029 dates
  const estimatesWith2029 = [];
  
  allEstimates.forEach(est => {
    const dateFields = {
      contract_end: est.contract_end,
      contract_start: est.contract_start,
      estimate_date: est.estimate_date,
      created_date: est.created_date
    };
    
    const fieldsWith2029 = [];
    
    // Check each date field
    Object.entries(dateFields).forEach(([fieldName, dateValue]) => {
      const year = getYearFromDate(dateValue);
      if (year === 2029) {
        fieldsWith2029.push({
          field: fieldName,
          value: formatDate(dateValue),
          year: year
        });
      }
    });
    
    if (fieldsWith2029.length > 0) {
      estimatesWith2029.push({
        id: est.id,
        lmn_estimate_id: est.lmn_estimate_id,
        estimate_number: est.estimate_number,
        project_name: est.project_name,
        status: est.status,
        archived: est.archived,
        account_id: est.account_id,
        fieldsWith2029: fieldsWith2029
      });
    }
  });
  
  // Display results
  console.log('══════════════════════════════════════════════════');
  console.log('📊 RESULTS: Estimates with 2029 Dates');
  console.log('══════════════════════════════════════════════════\n');
  
  if (estimatesWith2029.length === 0) {
    console.log('✅ No estimates found with 2029 dates.');
    console.log('\nThis means 2029 should NOT appear in the year dropdown.');
    console.log('If 2029 is still showing, there may be a caching issue or the data needs to be refreshed.\n');
  } else {
    console.log(`⚠️  Found ${estimatesWith2029.length} estimate(s) with 2029 dates:\n`);
    
    // Group by date field
    const byField = {
      contract_end: [],
      contract_start: [],
      estimate_date: [],
      created_date: []
    };
    
    estimatesWith2029.forEach(est => {
      est.fieldsWith2029.forEach(field => {
        byField[field.field].push(est);
      });
    });
    
    // Show summary by field
    console.log('Summary by date field:');
    Object.entries(byField).forEach(([field, ests]) => {
      if (ests.length > 0) {
        console.log(`  - ${field}: ${ests.length} estimate(s)`);
      }
    });
    console.log('');
    
    // Show detailed list
    console.log('Detailed list:');
    estimatesWith2029.forEach((est, index) => {
      console.log(`\n${index + 1}. Estimate ID: ${est.lmn_estimate_id || est.id}`);
      console.log(`   Estimate Number: ${est.estimate_number || 'N/A'}`);
      console.log(`   Project Name: ${est.project_name || 'N/A'}`);
      console.log(`   Status: ${est.status || 'N/A'}`);
      console.log(`   Archived: ${est.archived ? 'Yes' : 'No'}`);
      console.log(`   Account ID: ${est.account_id || 'None'}`);
      console.log(`   Fields with 2029 dates:`);
      est.fieldsWith2029.forEach(field => {
        console.log(`     - ${field.field}: ${field.value} (year: ${field.year})`);
      });
    });
    
    console.log('\n══════════════════════════════════════════════════');
    console.log('💡 Next Steps:');
    console.log('══════════════════════════════════════════════════');
    console.log('1. Review these estimates to verify if 2029 dates are correct');
    console.log('2. If dates are incorrect, check the source Excel file');
    console.log('3. If dates are correct but shouldn\'t appear in dropdown, check:');
    console.log('   - Are these estimates archived? (Archived estimates are excluded)');
    console.log('   - Is the year validation working correctly? (2000-2100 range)');
    console.log('4. Re-import from Excel if dates need to be corrected\n');
  }
  
  // Also check which years are actually in the database
  console.log('══════════════════════════════════════════════════');
  console.log('📅 All Years Found in Estimates (excluding archived)');
  console.log('══════════════════════════════════════════════════\n');
  
  const allYears = new Set();
  const yearToCount = new Map();
  
  allEstimates.forEach(est => {
    if (est.archived) return; // Exclude archived per spec
    
    // Check date priority: contract_end → contract_start → estimate_date → created_date
    let dateToUse = null;
    let dateSource = null;
    
    if (est.contract_end) {
      dateToUse = est.contract_end;
      dateSource = 'contract_end';
    } else if (est.contract_start) {
      dateToUse = est.contract_start;
      dateSource = 'contract_start';
    } else if (est.estimate_date) {
      dateToUse = est.estimate_date;
      dateSource = 'estimate_date';
    } else if (est.created_date) {
      dateToUse = est.created_date;
      dateSource = 'created_date';
    }
    
    if (dateToUse) {
      const year = getYearFromDate(dateToUse);
      if (year && year >= 2000 && year <= 2100) {
        allYears.add(year);
        const count = yearToCount.get(year) || 0;
        yearToCount.set(year, count + 1);
      }
    }
  });
  
  const sortedYears = Array.from(allYears).sort((a, b) => b - a);
  
  console.log(`Found ${sortedYears.length} unique year(s):\n`);
  sortedYears.forEach(year => {
    const count = yearToCount.get(year);
    const is2029 = year === 2029 ? ' ⚠️  (This is why 2029 appears in dropdown)' : '';
    console.log(`  ${year}: ${count} estimate(s)${is2029}`);
  });
  
  if (sortedYears.length === 0) {
    console.log('  (No valid years found - all estimates may be archived or have invalid dates)');
  }
  
  console.log('');
}

// Run the check
check2029Estimates()
  .then(() => {
    console.log('✅ Check complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

