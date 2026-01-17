/**
 * Debug script to investigate segment calculation issues
 * Checks if segments match revenue percentages for 2025
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSegmentCalculation() {
  console.log('🔍 Debugging segment calculation for 2025...\n');
  
  // Fetch all accounts (including archived)
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*');
  
  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    return;
  }
  
  console.log(`Total accounts: ${accounts.length}`);
  
  // Calculate total revenue for 2025 (including archived)
  const totalRevenue2025 = accounts.reduce((total, acc) => {
    if (acc.revenue_by_year && acc.revenue_by_year['2025']) {
      const revenue = typeof acc.revenue_by_year['2025'] === 'number'
        ? acc.revenue_by_year['2025']
        : parseFloat(acc.revenue_by_year['2025']) || 0;
      return total + revenue;
    }
    return total;
  }, 0);
  
  console.log(`Total revenue for 2025 (all accounts): $${totalRevenue2025.toLocaleString()}\n`);
  
  // Get active accounts only (non-archived)
  const activeAccounts = accounts.filter(acc => 
    !(acc.archived === true || acc.status === 'archived')
  );
  
  console.log(`Active accounts: ${activeAccounts.length}`);
  
  // Calculate total revenue for active accounts only
  const activeTotalRevenue2025 = activeAccounts.reduce((total, acc) => {
    if (acc.revenue_by_year && acc.revenue_by_year['2025']) {
      const revenue = typeof acc.revenue_by_year['2025'] === 'number'
        ? acc.revenue_by_year['2025']
        : parseFloat(acc.revenue_by_year['2025']) || 0;
      return total + revenue;
    }
    return total;
  }, 0);
  
  console.log(`Total revenue for 2025 (active only): $${activeTotalRevenue2025.toLocaleString()}\n`);
  
  // Sort active accounts by revenue (descending)
  const sortedAccounts = activeAccounts
    .map(acc => {
      const revenue = acc.revenue_by_year?.['2025'] || 0;
      const segment = acc.segment_by_year?.['2025'] || acc.revenue_segment || 'C';
      const percentage = activeTotalRevenue2025 > 0 
        ? (revenue / activeTotalRevenue2025) * 100 
        : 0;
      
      // Calculate expected segment based on percentage
      let expectedSegment = 'C';
      if (percentage > 15) {
        expectedSegment = 'A';
      } else if (percentage >= 5) {
        expectedSegment = 'B';
      }
      
      return {
        name: acc.name,
        revenue,
        segment,
        expectedSegment,
        percentage,
        matches: segment === expectedSegment,
        archived: acc.archived || acc.status === 'archived'
      };
    })
    .filter(acc => acc.revenue > 0) // Only accounts with revenue
    .sort((a, b) => b.revenue - a.revenue);
  
  console.log('Top 20 accounts by revenue (2025):\n');
  console.log('Account Name'.padEnd(40), 'Revenue'.padEnd(15), 'Segment'.padEnd(10), 'Expected'.padEnd(10), 'Percentage'.padEnd(12), 'Match');
  console.log('-'.repeat(100));
  
  let mismatchCount = 0;
  sortedAccounts.slice(0, 20).forEach((acc, index) => {
    const match = acc.matches ? '✅' : '❌';
    if (!acc.matches) mismatchCount++;
    
    console.log(
      acc.name.substring(0, 40).padEnd(40),
      `$${acc.revenue.toLocaleString()}`.padEnd(15),
      acc.segment.padEnd(10),
      acc.expectedSegment.padEnd(10),
      `${acc.percentage.toFixed(2)}%`.padEnd(12),
      match
    );
    
    if (!acc.matches && index < 10) {
      console.log(`  ⚠️  Mismatch: ${acc.name} has segment ${acc.segment} but should be ${acc.expectedSegment} (${acc.percentage.toFixed(2)}% of total)`);
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total accounts checked: ${sortedAccounts.length}`);
  console.log(`   Mismatches found: ${mismatchCount}`);
  console.log(`   Match rate: ${((sortedAccounts.length - mismatchCount) / sortedAccounts.length * 100).toFixed(1)}%`);
  
  // Check if archived accounts are affecting the calculation
  const archivedAccounts = accounts.filter(acc => 
    acc.archived === true || acc.status === 'archived'
  );
  
  const archivedRevenue2025 = archivedAccounts.reduce((total, acc) => {
    if (acc.revenue_by_year && acc.revenue_by_year['2025']) {
      const revenue = typeof acc.revenue_by_year['2025'] === 'number'
        ? acc.revenue_by_year['2025']
        : parseFloat(acc.revenue_by_year['2025']) || 0;
      return total + revenue;
    }
    return total;
  }, 0);
  
  console.log(`\n📦 Archived accounts:`);
  console.log(`   Count: ${archivedAccounts.length}`);
  console.log(`   Revenue (2025): $${archivedRevenue2025.toLocaleString()}`);
  console.log(`   Percentage of total: ${((archivedRevenue2025 / totalRevenue2025) * 100).toFixed(2)}%`);
  
  if (Math.abs(totalRevenue2025 - activeTotalRevenue2025) > 0.01) {
    console.log(`\n⚠️  WARNING: Total revenue differs between all accounts and active accounts!`);
    console.log(`   This suggests archived accounts have revenue and may be affecting segment calculations.`);
  }
}

debugSegmentCalculation().catch(console.error);
