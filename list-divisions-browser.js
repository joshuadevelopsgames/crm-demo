/**
 * Browser Console Script to List All Unique Division Values
 * 
 * Copy and paste this entire script into your browser console on the LECRM app
 * Or run: await listAllDivisions()
 */

async function listAllDivisions() {
  try {
    console.log('📊 Fetching all estimates...\n');
    
    // Fetch all estimates from API
    const response = await fetch('/api/data/estimates');
    if (!response.ok) {
      throw new Error(`Failed to fetch estimates: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error('No estimates data found');
    }
    
    const estimates = result.data;
    console.log(`📊 Total estimates: ${estimates.length}\n`);
    
    // Get all unique division values with counts
    const divisionCounts = {};
    let emptyCount = 0;
    
    estimates.forEach(est => {
      const division = est.division ? est.division.trim() : '';
      
      if (!division || division === '') {
        emptyCount++;
      } else {
        divisionCounts[division] = (divisionCounts[division] || 0) + 1;
      }
    });
    
    // Sort by count (descending)
    const sortedDivisions = Object.entries(divisionCounts)
      .sort((a, b) => b[1] - a[1]);
    
    console.log('📋 All Unique Division Values:\n');
    console.log('='.repeat(80));
    
    if (emptyCount > 0) {
      const percentage = ((emptyCount / estimates.length) * 100).toFixed(1);
      console.log(`(empty/null)`.padEnd(50) + ` | Count: ${emptyCount.toString().padStart(6)} | ${percentage.padStart(5)}%`);
    }
    
    sortedDivisions.forEach(([div, count]) => {
      const percentage = ((count / estimates.length) * 100).toFixed(1);
      console.log(`${div.padEnd(50)} | Count: ${count.toString().padStart(6)} | ${percentage.padStart(5)}%`);
    });
    
    console.log('='.repeat(80));
    console.log(`\n✅ Total unique divisions: ${sortedDivisions.length + (emptyCount > 0 ? 1 : 0)}`);
    console.log(`✅ Total estimates: ${estimates.length}\n`);
    
    // Also return as an array for programmatic use
    return {
      empty: emptyCount,
      divisions: sortedDivisions.map(([div, count]) => ({ division: div, count })),
      total: estimates.length
    };
  } catch (error) {
    console.error('❌ Error listing divisions:', error);
    throw error;
  }
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  console.log('✅ Division listing function loaded!');
  console.log('Run: await listAllDivisions()');
  
  // Make it available globally
  window.listAllDivisions = listAllDivisions;
}

