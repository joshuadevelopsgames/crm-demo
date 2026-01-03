/**
 * Test script to verify 2025 sold estimates count matches LMN's 1,057
 * 
 * This script tests the updated filtering logic:
 * - Filter by estimate_close_date = 2025 (when sold)
 * - Filter by won status (checking both pipeline_status and status fields)
 * - Apply all LMN-compatible filters
 */

import { createClient } from '@supabase/supabase-js';
import { filterEstimatesByYear, isWonStatus } from './src/utils/reportCalculations.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.PROD_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function test2025SoldCount() {
  console.log('🧪 Testing 2025 Sold Estimates Count\n');
  console.log('Target (LMN): 1,057\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Fetch all estimates from database
    console.log('📥 Fetching estimates from Supabase...');
    const supabase = getSupabase();
    
    // Fetch all estimates (with pagination)
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('id', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch estimates: ${error.message}`);
      }

      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Fetched ${allEstimates.length} estimates\n`);

    // Test 1: Use filterEstimatesByYear with salesPerformanceMode=true and soldOnly=true
    console.log('Test 1: Using filterEstimatesByYear (salesPerformanceMode=true, soldOnly=true)');
    console.log('─────────────────────────────────────────────────────────────');
    const sold2025_method1 = filterEstimatesByYear(allEstimates, 2025, true, true);
    console.log(`Count: ${sold2025_method1.length}`);
    console.log(`Difference from target: ${Math.abs(1057 - sold2025_method1.length)}`);
    console.log(`Match: ${sold2025_method1.length === 1057 ? '✅ EXACT MATCH!' : sold2025_method1.length === 1057 ? '✅' : '❌'}\n`);

    // Test 2: Manual filter to verify logic
    console.log('Test 2: Manual filter (step-by-step)');
    console.log('─────────────────────────────────────────────────────────────');
    
    // Step 1: Remove duplicates by lmn_estimate_id
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
    console.log(`After deduplication: ${uniqueEstimates.length} estimates`);

    // Step 2: Filter by estimate_close_date = 2025
    const withCloseDate2025 = uniqueEstimates.filter(e => {
      if (!e.estimate_close_date) return false;
      const dateStr = String(e.estimate_close_date);
      if (dateStr.length < 4) return false;
      const year = parseInt(dateStr.substring(0, 4));
      return year === 2025;
    });
    console.log(`With estimate_close_date = 2025: ${withCloseDate2025.length} estimates`);

    // Step 3: Exclude exclude_stats
    const notExcluded = withCloseDate2025.filter(e => !e.exclude_stats);
    console.log(`After excluding exclude_stats=true: ${notExcluded.length} estimates`);

    // Step 4: Exclude archived
    const notArchived = notExcluded.filter(e => !e.archived);
    console.log(`After excluding archived: ${notArchived.length} estimates`);

    // Step 5: Exclude zero/negative prices
    const withPrice = notArchived.filter(e => {
      const price = parseFloat(e.total_price || e.total_price_with_tax || 0);
      return price > 0;
    });
    console.log(`After excluding zero/negative prices: ${withPrice.length} estimates`);

    // Step 6: Exclude Lost statuses
    const notLost = withPrice.filter(e => {
      const status = (e.status || '').toString().toLowerCase().trim();
      return !status.includes('lost');
    });
    console.log(`After excluding Lost statuses: ${notLost.length} estimates`);

    // Step 7: Filter by won status (using updated isWonStatus)
    const sold2025_manual = notLost.filter(e => isWonStatus(e));
    console.log(`After filtering by won status: ${sold2025_manual.length} estimates`);
    console.log(`Difference from target: ${Math.abs(1057 - sold2025_manual.length)}`);
    console.log(`Match: ${sold2025_manual.length === 1057 ? '✅ EXACT MATCH!' : '❌'}\n`);

    // Test 3: Check status breakdown
    console.log('Test 3: Status breakdown of sold estimates');
    console.log('─────────────────────────────────────────────────────────────');
    const statusCounts = {};
    const pipelineStatusCounts = {};
    sold2025_manual.forEach(e => {
      const status = (e.status || 'unknown').toLowerCase();
      const pipeline = (e.pipeline_status || 'none').toLowerCase();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      pipelineStatusCounts[pipeline] = (pipelineStatusCounts[pipeline] || 0) + 1;
    });
    
    console.log('By status field:');
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`  "${status}": ${count}`);
    });
    console.log('\nBy pipeline_status field:');
    Object.entries(pipelineStatusCounts).sort((a, b) => b[1] - a[1]).forEach(([pipeline, count]) => {
      console.log(`  "${pipeline}": ${count}`);
    });
    console.log('');

    // Test 4: Check if "Sold" in pipeline_status is being recognized
    console.log('Test 4: Checking "Sold" recognition');
    console.log('─────────────────────────────────────────────────────────────');
    const withSoldPipeline = notLost.filter(e => {
      const pipeline = (e.pipeline_status || '').toLowerCase();
      return pipeline.includes('sold');
    });
    console.log(`Estimates with "sold" in pipeline_status: ${withSoldPipeline.length}`);
    
    const withSoldStatus = notLost.filter(e => {
      const status = (e.status || '').toLowerCase();
      return status.includes('sold');
    });
    console.log(`Estimates with "sold" in status: ${withSoldStatus.length}`);
    
    const recognizedAsWon = notLost.filter(e => isWonStatus(e));
    console.log(`Recognized as won by isWonStatus(): ${recognizedAsWon.length}`);
    console.log('');

    // Test 5: Find estimates with close_date=2025 that are NOT being counted
    console.log('Test 5: Finding missing estimates');
    console.log('─────────────────────────────────────────────────────────────');
    
    // Check what's being excluded at each step
    const excludedByExcludeStats = withCloseDate2025.filter(e => e.exclude_stats);
    const excludedByArchived = notExcluded.filter(e => e.archived);
    const excludedByPrice = notArchived.filter(e => {
      const price = parseFloat(e.total_price || e.total_price_with_tax || 0);
      return price <= 0;
    });
    const excludedByLost = withPrice.filter(e => {
      const status = (e.status || '').toString().toLowerCase().trim();
      return status.includes('lost');
    });
    const excludedByNotWon = notLost.filter(e => !isWonStatus(e));
    
    console.log(`Excluded by exclude_stats: ${excludedByExcludeStats.length}`);
    console.log(`Excluded by archived: ${excludedByArchived.length}`);
    console.log(`Excluded by zero/negative price: ${excludedByPrice.length}`);
    console.log(`Excluded by Lost status: ${excludedByLost.length}`);
    console.log(`Excluded by not won status: ${excludedByNotWon.length}`);
    console.log(`Total excluded: ${excludedByExcludeStats.length + excludedByArchived.length + excludedByPrice.length + excludedByLost.length + excludedByNotWon.length}`);
    console.log(`Total with close_date=2025: ${withCloseDate2025.length}`);
    console.log(`Total counted as sold: ${sold2025_manual.length}`);
    console.log(`Missing to reach 1,057: ${1057 - sold2025_manual.length}`);
    
    const withCloseDate2025_notSold = notLost.filter(e => !isWonStatus(e));
    console.log(`\nEstimates with close_date=2025 but NOT recognized as sold: ${withCloseDate2025_notSold.length}`);
    
    if (withCloseDate2025_notSold.length > 0) {
      console.log('\nSample of estimates NOT counted as sold:');
      const sample = withCloseDate2025_notSold.slice(0, 10);
      sample.forEach(e => {
        console.log(`  - ID: ${e.id || e.lmn_estimate_id}`);
        console.log(`    Status: "${e.status}"`);
        console.log(`    Pipeline Status: "${e.pipeline_status || 'null'}"`);
        console.log(`    Exclude Stats: ${e.exclude_stats}`);
        console.log(`    Archived: ${e.archived}`);
        console.log(`    Price: ${e.total_price || e.total_price_with_tax || 0}`);
        console.log('');
      });
      
      // Check status breakdown
      const statusBreakdown = {};
      withCloseDate2025_notSold.forEach(e => {
        const status = (e.status || 'unknown').toLowerCase();
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });
      console.log('Status breakdown of non-sold estimates:');
      Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
        console.log(`  "${status}": ${count}`);
      });
    }
    console.log('');

    // Test 6: Try including exclude_stats estimates
    console.log('Test 6: Testing if LMN includes exclude_stats estimates');
    console.log('─────────────────────────────────────────────────────────────');
    const withExcludeStats = notArchived.filter(e => {
      const price = parseFloat(e.total_price || e.total_price_with_tax || 0);
      if (price <= 0) return false;
      const status = (e.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      return isWonStatus(e);
    });
    console.log(`Including exclude_stats=true: ${withExcludeStats.length}`);
    console.log(`Difference from target: ${Math.abs(1057 - withExcludeStats.length)}`);
    if (withExcludeStats.length === 1057) {
      console.log('✅ EXACT MATCH! LMN includes exclude_stats estimates.');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Test 6b: Try including BOTH exclude_stats AND zero price
    console.log('Test 6b: Testing if LMN includes exclude_stats AND zero price');
    console.log('─────────────────────────────────────────────────────────────');
    const withBoth = notArchived.filter(e => {
      const status = (e.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      return isWonStatus(e);
    });
    console.log(`Including exclude_stats AND zero price: ${withBoth.length}`);
    console.log(`Difference from target: ${Math.abs(1057 - withBoth.length)}`);
    if (withBoth.length === 1057) {
      console.log('✅ EXACT MATCH! LMN includes exclude_stats AND zero price estimates.');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Test 7: Try including zero price estimates
    console.log('Test 7: Testing if LMN includes zero price estimates');
    console.log('─────────────────────────────────────────────────────────────');
    const withZeroPrice = notArchived.filter(e => {
      const status = (e.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      return isWonStatus(e);
    });
    console.log(`Including zero price: ${withZeroPrice.length}`);
    console.log(`Difference from target: ${Math.abs(1057 - withZeroPrice.length)}`);
    if (withZeroPrice.length === 1057) {
      console.log('✅ EXACT MATCH! LMN includes zero price estimates.');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Test 8: Check if maybe LMN doesn't exclude Lost statuses
    console.log('Test 8: Testing if LMN includes Lost status estimates');
    console.log('─────────────────────────────────────────────────────────────');
    const withLost = withPrice.filter(e => isWonStatus(e));
    console.log(`Including Lost statuses: ${withLost.length}`);
    console.log(`Difference from target: ${Math.abs(1057 - withLost.length)}`);
    if (withLost.length === 1057) {
      console.log('✅ EXACT MATCH! LMN includes Lost status estimates.');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Test 9: Try all combinations
    console.log('Test 9: Testing combinations');
    console.log('─────────────────────────────────────────────────────────────');
    const allCombinations = notArchived.filter(e => isWonStatus(e));
    console.log(`Including everything (except archived): ${allCombinations.length}`);
    console.log(`Difference from target: ${Math.abs(1057 - allCombinations.length)}`);
    if (allCombinations.length === 1057) {
      console.log('✅ EXACT MATCH! LMN uses different exclusion rules.');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Test 10: Check for date format issues - find estimates with close_date that might not be recognized as 2025
    console.log('Test 10: Checking for date format issues');
    console.log('─────────────────────────────────────────────────────────────');
    const withCloseDate = uniqueEstimates.filter(e => {
      return e.estimate_close_date && String(e.estimate_close_date).trim() !== '';
    });
    
    // Check different date formats
    const dateFormats = {
      startsWith2025: 0,
      contains2025: 0,
      parseableAs2025: 0,
      otherFormats: []
    };
    
    withCloseDate.forEach(e => {
      const dateStr = String(e.estimate_close_date);
      if (dateStr.startsWith('2025')) {
        dateFormats.startsWith2025++;
      } else if (dateStr.includes('2025')) {
        dateFormats.contains2025++;
      } else {
        // Try to parse and check year
        try {
          const date = new Date(dateStr);
          if (date.getFullYear() === 2025) {
            dateFormats.parseableAs2025++;
          } else {
            dateFormats.otherFormats.push({
              id: e.lmn_estimate_id || e.id,
              dateStr: dateStr,
              parsedYear: date.getFullYear()
            });
          }
        } catch (err) {
          dateFormats.otherFormats.push({
            id: e.lmn_estimate_id || e.id,
            dateStr: dateStr,
            error: 'Could not parse'
          });
        }
      }
    });
    
    console.log(`Estimates with close_date starting with "2025": ${dateFormats.startsWith2025}`);
    console.log(`Estimates with close_date containing "2025": ${dateFormats.contains2025}`);
    console.log(`Estimates with close_date parseable as 2025: ${dateFormats.parseableAs2025}`);
    console.log(`Other date formats: ${dateFormats.otherFormats.length}`);
    
    if (dateFormats.otherFormats.length > 0 && dateFormats.otherFormats.length <= 30) {
      console.log('\nSample of other date formats (might be the missing 30):');
      dateFormats.otherFormats.slice(0, 10).forEach(({ id, dateStr, parsedYear, error }) => {
        console.log(`  - ID: ${id}, Date: "${dateStr}", ${parsedYear ? `Parsed Year: ${parsedYear}` : error}`);
      });
    }
    console.log('');

    // Test 11: Maybe LMN counts ALL estimates with close_date=2025 (not just won)?
    console.log('Test 11: Testing if LMN counts ALL estimates with close_date=2025');
    console.log('─────────────────────────────────────────────────────────────');
    const allWithCloseDate2025 = withPrice.filter(e => {
      const status = (e.status || '').toString().toLowerCase().trim();
      // Only exclude Lost, but include everything else
      return !status.includes('lost');
    });
    console.log(`All estimates with close_date=2025 (excluding Lost only): ${allWithCloseDate2025.length}`);
    console.log(`Difference from target: ${Math.abs(1057 - allWithCloseDate2025.length)}`);
    if (allWithCloseDate2025.length === 1057) {
      console.log('✅ EXACT MATCH! LMN counts ALL estimates with close_date=2025 (not just won).');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Test 12: Check if maybe some "Lost" estimates should be included
    console.log('Test 12: Testing if some Lost estimates should be included');
    console.log('─────────────────────────────────────────────────────────────');
    const lostWithCloseDate2025 = withPrice.filter(e => {
      const status = (e.status || '').toString().toLowerCase().trim();
      return status.includes('lost');
    });
    console.log(`Lost estimates with close_date=2025: ${lostWithCloseDate2025.length}`);
    
    // Try including Lost estimates that have pipeline_status = "Sold"
    const lostButSold = lostWithCloseDate2025.filter(e => {
      const pipeline = (e.pipeline_status || '').toLowerCase();
      return pipeline.includes('sold');
    });
    console.log(`Lost estimates with pipeline_status="Sold": ${lostButSold.length}`);
    
    // Try including all Lost estimates
    const withLostIncluded = withPrice.filter(e => isWonStatus(e));
    const testWithSomeLost = withLostIncluded.length + lostButSold.length;
    console.log(`Won estimates + Lost with pipeline="Sold": ${testWithSomeLost}`);
    console.log(`Difference from target: ${Math.abs(1057 - testWithSomeLost)}`);
    if (testWithSomeLost === 1057) {
      console.log('✅ EXACT MATCH! LMN includes Lost estimates with pipeline_status="Sold".');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Test 13: Maybe LMN uses estimate_date instead of estimate_close_date for some estimates?
    console.log('Test 13: Testing if LMN uses estimate_date for estimates without close_date');
    console.log('─────────────────────────────────────────────────────────────');
    // Estimates with estimate_date=2025 but no close_date, and won status
    const withEstDate2025_noCloseDate = uniqueEstimates.filter(e => {
      if (e.exclude_stats || e.archived) return false;
      const price = parseFloat(e.total_price || e.total_price_with_tax || 0);
      if (price <= 0) return false;
      const status = (e.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      if (!isWonStatus(e)) return false;
      
      // Has estimate_date in 2025 but NO close_date
      if (e.estimate_close_date) return false;
      if (!e.estimate_date) return false;
      
      const dateStr = String(e.estimate_date);
      if (dateStr.length < 4) return false;
      const year = parseInt(dateStr.substring(0, 4));
      return year === 2025;
    });
    console.log(`Estimates with estimate_date=2025 (no close_date), won status: ${withEstDate2025_noCloseDate.length}`);
    
    // Try adding these to our count
    const testWithEstDate = sold2025_manual.length + withEstDate2025_noCloseDate.length;
    console.log(`Won with close_date=2025 + Won with estimate_date=2025 (no close_date): ${testWithEstDate}`);
    console.log(`Difference from target: ${Math.abs(1057 - testWithEstDate)}`);
    if (testWithEstDate === 1057) {
      console.log('✅ EXACT MATCH! LMN uses estimate_date for estimates without close_date.');
    } else {
      console.log('❌ Not a match - need 5 more estimates');
    }
    console.log('');

    // Test 14: Try including zero price estimates with estimate_date=2025
    console.log('Test 14: Testing if we need zero price estimates with estimate_date=2025');
    console.log('─────────────────────────────────────────────────────────────');
    const withEstDate2025_zeroPrice = uniqueEstimates.filter(e => {
      if (e.exclude_stats || e.archived) return false;
      const status = (e.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      if (!isWonStatus(e)) return false;
      
      // Has estimate_date in 2025 but NO close_date
      if (e.estimate_close_date) return false;
      if (!e.estimate_date) return false;
      
      const dateStr = String(e.estimate_date);
      if (dateStr.length < 4) return false;
      const year = parseInt(dateStr.substring(0, 4));
      return year === 2025;
    });
    console.log(`Estimates with estimate_date=2025 (no close_date), won status, including zero price: ${withEstDate2025_zeroPrice.length}`);
    
    const testWithEstDateZeroPrice = sold2025_manual.length + withEstDate2025_zeroPrice.length;
    console.log(`Won with close_date=2025 + Won with estimate_date=2025 (including zero price): ${testWithEstDateZeroPrice}`);
    console.log(`Difference from target: ${Math.abs(1057 - testWithEstDateZeroPrice)}`);
    if (testWithEstDateZeroPrice === 1057) {
      console.log('✅ EXACT MATCH! LMN includes zero price estimates with estimate_date=2025.');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Test 15: Try the combination - close_date=2025 (including zero price) + estimate_date=2025 (including zero price)
    console.log('Test 15: Testing combination - both date fields, including zero price');
    console.log('─────────────────────────────────────────────────────────────');
    const soldWithCloseDate2025_inclZeroPrice = notArchived.filter(e => {
      const status = (e.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      if (!isWonStatus(e)) return false;
      
      if (!e.estimate_close_date) return false;
      const dateStr = String(e.estimate_close_date);
      if (dateStr.length < 4) return false;
      const year = parseInt(dateStr.substring(0, 4));
      return year === 2025;
    });
    
    const testCombination = soldWithCloseDate2025_inclZeroPrice.length + withEstDate2025_zeroPrice.length;
    console.log(`Close_date=2025 (incl zero price) + estimate_date=2025 (incl zero price): ${testCombination}`);
    console.log(`Difference from target: ${Math.abs(1057 - testCombination)}`);
    if (testCombination === 1057) {
      console.log('✅ EXACT MATCH! LMN uses both date fields and includes zero price.');
    } else {
      console.log('❌ Not a match - need 3 more estimates');
    }
    console.log('');

    // Test 16: Try including exclude_stats estimates
    console.log('Test 16: Testing if we need exclude_stats estimates');
    console.log('─────────────────────────────────────────────────────────────');
    // Estimates with close_date=2025, including exclude_stats
    const soldWithCloseDate2025_inclExcludeStats = uniqueEstimates.filter(e => {
      if (e.archived) return false;
      const status = (e.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      if (!isWonStatus(e)) return false;
      
      if (!e.estimate_close_date) return false;
      const dateStr = String(e.estimate_close_date);
      if (dateStr.length < 4) return false;
      const year = parseInt(dateStr.substring(0, 4));
      return year === 2025;
    });
    
    // Estimates with estimate_date=2025 (no close_date), including exclude_stats
    const withEstDate2025_inclExcludeStats = uniqueEstimates.filter(e => {
      if (e.archived) return false;
      const status = (e.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      if (!isWonStatus(e)) return false;
      
      if (e.estimate_close_date) return false;
      if (!e.estimate_date) return false;
      
      const dateStr = String(e.estimate_date);
      if (dateStr.length < 4) return false;
      const year = parseInt(dateStr.substring(0, 4));
      return year === 2025;
    });
    
    const testWithExcludeStats = soldWithCloseDate2025_inclExcludeStats.length + withEstDate2025_inclExcludeStats.length;
    console.log(`Both date fields, including exclude_stats: ${testWithExcludeStats}`);
    console.log(`Difference from target: ${Math.abs(1057 - testWithExcludeStats)}`);
    if (testWithExcludeStats === 1057) {
      console.log('✅ EXACT MATCH! LMN includes exclude_stats estimates.');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Test 17: Final combination - everything except archived and Lost
    console.log('Test 17: Final test - everything except archived and Lost');
    console.log('─────────────────────────────────────────────────────────────');
    const finalTest = uniqueEstimates.filter(e => {
      if (e.archived) return false;
      const status = (e.status || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      if (!isWonStatus(e)) return false;
      
      // Check close_date first
      if (e.estimate_close_date) {
        const dateStr = String(e.estimate_close_date);
        if (dateStr.length >= 4) {
          const year = parseInt(dateStr.substring(0, 4));
          if (year === 2025) return true;
        }
      }
      
      // If no close_date, check estimate_date
      if (e.estimate_date) {
        const dateStr = String(e.estimate_date);
        if (dateStr.length >= 4) {
          const year = parseInt(dateStr.substring(0, 4));
          if (year === 2025) return true;
        }
      }
      
      return false;
    });
    
    console.log(`Final count (everything except archived and Lost): ${finalTest.length}`);
    console.log(`Difference from target: ${Math.abs(1057 - finalTest.length)}`);
    if (finalTest.length === 1057) {
      console.log('✅ EXACT MATCH! This is the correct logic.');
    } else {
      console.log('❌ Not a match');
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY:\n');
    console.log(`Target (LMN): 1,057`);
    console.log(`Current count (won only, exclude Lost): ${sold2025_manual.length}`);
    console.log(`Including exclude_stats: ${withExcludeStats.length}`);
    console.log(`Including zero price: ${withZeroPrice.length}`);
    console.log(`All with close_date=2025 (exclude Lost only): ${allWithCloseDate2025.length}`);
    console.log(`Won + Lost with pipeline="Sold": ${testWithSomeLost}`);
    console.log(`Difference: ${Math.abs(1057 - sold2025_manual.length)}`);
    console.log(`Missing: ${1057 - sold2025_manual.length} estimates`);
    
    if (sold2025_manual.length === 1057) {
      console.log('\n✅ EXACT MATCH! The filtering logic matches LMN\'s count.');
    } else if (withExcludeStats.length === 1057) {
      console.log('\n✅ EXACT MATCH! LMN includes exclude_stats estimates.');
    } else if (withZeroPrice.length === 1057) {
      console.log('\n✅ EXACT MATCH! LMN includes zero price estimates.');
    } else if (allWithCloseDate2025.length === 1057) {
      console.log('\n✅ EXACT MATCH! LMN counts ALL estimates with close_date=2025 (not just won).');
    } else if (testWithSomeLost === 1057) {
      console.log('\n✅ EXACT MATCH! LMN includes Lost estimates with pipeline_status="Sold".');
    } else if (Math.abs(1057 - sold2025_manual.length) <= 22) {
      console.log('\n✅ CLOSE MATCH! Within expected 2% drift range.');
    } else {
      console.log('\n❌ MISMATCH! Need to investigate further.');
      console.log(`\nWe're missing ${1057 - sold2025_manual.length} estimates.`);
      console.log('\nPossible issues:');
      console.log('  1. LMN includes exclude_stats estimates');
      console.log('  2. LMN includes zero price estimates');
      console.log('  3. LMN counts ALL estimates with close_date (not just won)');
      console.log('  4. LMN includes some Lost estimates');
      console.log('  5. Missing estimates in database');
    }
    
  } catch (error) {
    console.error('❌ Error running test:', error);
    console.log('\n💡 Make sure:');
    console.log('  1. Dev server is running on http://localhost:5173');
    console.log('  2. You\'re running this from the project root');
    console.log('  3. All dependencies are installed');
  }
}

// Run if called directly
test2025SoldCount().catch(console.error);

export { test2025SoldCount };

