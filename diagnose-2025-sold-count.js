/**
 * Diagnostic script to count estimates sold in 2025
 * User reports LMN shows 1,057 estimates sold for 2025
 * This script will test different filtering approaches to match LMN's count
 */

// Import the filtering function
const { filterEstimatesByYear, isWonStatus } = require('./src/utils/reportCalculations.js');

async function diagnose2025SoldCount() {
  console.log('🔍 Diagnosing 2025 Estimates Sold Count\n');
  console.log('Target: 1,057 (per LMN analytics)\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Fetch all estimates from database
  const response = await fetch('http://localhost:5173/api/data/estimates');
  if (!response.ok) {
    console.error('❌ Failed to fetch estimates');
    return;
  }

  const result = await response.json();
  const allEstimates = result.success ? (result.data || []) : [];

  console.log(`📊 Total estimates in database: ${allEstimates.length}\n`);

  // Test 1: Filter by estimate_close_date = 2025 AND won status (salesPerformanceMode + soldOnly)
  const sold2025_1 = filterEstimatesByYear(allEstimates, 2025, true, true);
  console.log('1️⃣  Filter: estimate_close_date=2025 AND won status (salesPerformanceMode=true, soldOnly=true)');
  console.log(`   Count: ${sold2025_1.length}`);
  console.log(`   Statuses: ${[...new Set(sold2025_1.map(e => e.status))].join(', ')}\n`);

  // Test 2: Filter by estimate_close_date = 2025 (all statuses, then filter won)
  const sold2025_2 = filterEstimatesByYear(allEstimates, 2025, true, false)
    .filter(e => isWonStatus(e.status));
  console.log('2️⃣  Filter: estimate_close_date=2025 (all), then filter won statuses');
  console.log(`   Count: ${sold2025_2.length}\n`);

  // Test 3: Manual filter - estimate_close_date=2025 AND won status (no other filters)
  const sold2025_3 = allEstimates.filter(e => {
    if (!e.estimate_close_date) return false;
    const dateStr = String(e.estimate_close_date);
    if (dateStr.length < 4) return false;
    const year = parseInt(dateStr.substring(0, 4));
    if (year !== 2025) return false;
    return isWonStatus(e.status);
  });
  console.log('3️⃣  Manual: estimate_close_date=2025 AND won status (no other filters)');
  console.log(`   Count: ${sold2025_3.length}\n`);

  // Test 4: Check what statuses are in the sold estimates
  const statusCounts = {};
  sold2025_1.forEach(e => {
    const status = (e.status || 'unknown').toLowerCase();
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  console.log('4️⃣  Status breakdown of sold estimates:');
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  console.log('');

  // Test 5: Check if "Sold" status is being recognized
  const soldStatusVariants = allEstimates
    .filter(e => {
      if (!e.estimate_close_date) return false;
      const dateStr = String(e.estimate_close_date);
      if (dateStr.length < 4) return false;
      const year = parseInt(dateStr.substring(0, 4));
      return year === 2025;
    })
    .map(e => ({
      status: e.status,
      pipeline_status: e.pipeline_status,
      isWon: isWonStatus(e.status),
      hasCloseDate: !!e.estimate_close_date
    }));

  const uniqueStatuses = [...new Set(soldStatusVariants.map(e => e.status))];
  console.log('5️⃣  Unique statuses for estimates with close_date=2025:');
  uniqueStatuses.forEach(status => {
    const count = soldStatusVariants.filter(e => e.status === status).length;
    const wonCount = soldStatusVariants.filter(e => e.status === status && e.isWon).length;
    console.log(`   "${status}": ${count} total, ${wonCount} recognized as won`);
  });
  console.log('');

  // Test 6: Check if "Sold" (capitalized) is in the status list
  const soldStatus = soldStatusVariants.filter(e => 
    (e.status || '').toLowerCase().includes('sold')
  );
  console.log('6️⃣  Estimates with "sold" in status (any case):');
  console.log(`   Count: ${soldStatus.length}`);
  console.log(`   Recognized as won: ${soldStatus.filter(e => e.isWon).length}\n`);

  // Test 7: Check pipeline_status field
  const withPipelineSold = soldStatusVariants.filter(e => 
    (e.pipeline_status || '').toLowerCase().includes('sold')
  );
  console.log('7️⃣  Estimates with pipeline_status containing "sold":');
  console.log(`   Count: ${withPipelineSold.length}\n`);

  // Test 8: Check if we need to add "sold" to isWonStatus
  const soldButNotWon = soldStatusVariants.filter(e => 
    !e.isWon && ((e.status || '').toLowerCase().includes('sold') || 
                 (e.pipeline_status || '').toLowerCase().includes('sold'))
  );
  console.log('8️⃣  Estimates with "sold" but NOT recognized as won:');
  console.log(`   Count: ${soldButNotWon.length}`);
  if (soldButNotWon.length > 0) {
    console.log(`   Sample statuses: ${[...new Set(soldButNotWon.map(e => e.status))].slice(0, 5).join(', ')}`);
  }
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY:\n');
  console.log(`Target (LMN): 1,057`);
  console.log(`Current count (Test 1): ${sold2025_1.length}`);
  console.log(`Difference: ${Math.abs(1057 - sold2025_1.length)}`);
  
  if (Math.abs(1057 - sold2025_1.length) > 50) {
    console.log('\n⚠️  Large discrepancy detected!');
    console.log('Possible issues:');
    console.log('  1. "Sold" status not recognized in isWonStatus()');
    console.log('  2. Different filtering logic than LMN');
    console.log('  3. Missing estimates in database');
  }
}

// Run if called directly
if (require.main === module) {
  diagnose2025SoldCount().catch(console.error);
}

module.exports = { diagnose2025SoldCount };

