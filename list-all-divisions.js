/**
 * List all unique division values from estimates
 * Run this in Node.js: node list-all-divisions.js
 */

// For Node.js environment - fetch estimates from API
async function listAllDivisions() {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  
  try {
    console.log('Fetching estimates from API...\n');
    const response = await fetch(`${baseUrl}/api/data/estimates`);
    
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
    console.log(`\nTotal unique divisions: ${sortedDivisions.length + (emptyCount > 0 ? 1 : 0)}`);
    console.log(`Total estimates: ${estimates.length}`);
    
    return sortedDivisions;
  } catch (error) {
    console.error('Error listing divisions:', error);
    throw error;
  }
}

// Run if in Node.js
if (typeof require !== 'undefined' && require.main === module) {
  // Use node-fetch if available, otherwise use global fetch
  if (typeof fetch === 'undefined') {
    console.error('Please run this in an environment with fetch support, or use the browser console version');
    process.exit(1);
  }
  
  listAllDivisions().catch(console.error);
}

module.exports = { listAllDivisions };

