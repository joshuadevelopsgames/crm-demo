/**
 * List all unique division values from estimates
 */

async function listAllDivisions() {
  try {
    // Fetch estimates from API
    const response = await fetch('/api/data/estimates');
    if (!response.ok) {
      throw new Error(`Failed to fetch estimates: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error('No estimates data found');
    }
    
    const estimates = result.data;
    console.log(`\n📊 Total estimates: ${estimates.length}\n`);
    
    // Get all unique division values
    const divisions = new Set();
    const divisionCounts = {};
    
    estimates.forEach(est => {
      const division = est.division || '';
      const trimmed = division.trim();
      
      if (trimmed) {
        divisions.add(trimmed);
        divisionCounts[trimmed] = (divisionCounts[trimmed] || 0) + 1;
      } else {
        divisions.add('(empty/null)');
        divisionCounts['(empty/null)'] = (divisionCounts['(empty/null)'] || 0) + 1;
      }
    });
    
    // Sort by count (descending)
    const sortedDivisions = Array.from(divisions).sort((a, b) => {
      return divisionCounts[b] - divisionCounts[a];
    });
    
    console.log('📋 All Unique Division Values:\n');
    console.log('='.repeat(80));
    sortedDivisions.forEach(div => {
      const count = divisionCounts[div];
      const percentage = ((count / estimates.length) * 100).toFixed(1);
      console.log(`${div.padEnd(50)} | Count: ${count.toString().padStart(6)} | ${percentage.padStart(5)}%`);
    });
    console.log('='.repeat(80));
    console.log(`\nTotal unique divisions: ${sortedDivisions.length}`);
    
    return sortedDivisions;
  } catch (error) {
    console.error('Error listing divisions:', error);
    throw error;
  }
}

// Run if called directly
if (typeof window !== 'undefined') {
  // Browser environment - expose as global function
  window.listAllDivisions = listAllDivisions;
  console.log('Run listAllDivisions() in the browser console to see all division values');
} else {
  // Node environment
  listAllDivisions().catch(console.error);
}

