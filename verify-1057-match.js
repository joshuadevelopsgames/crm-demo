/**
 * Verify that the updated filterEstimatesByYear matches LMN's count of 1,057
 */

import { createClient } from '@supabase/supabase-js';
import { filterEstimatesByYear } from './src/utils/reportCalculations.js';
import dotenv from 'dotenv';

dotenv.config();

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.PROD_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function verifyMatch() {
  console.log('✅ Verifying 2025 Sold Estimates Count\n');
  console.log('Target (LMN): 1,057\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Fetch all estimates
    console.log('📥 Fetching estimates from Supabase...');
    const supabase = getSupabase();
    
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

    // Test with updated function
    console.log('🧪 Testing updated filterEstimatesByYear function...');
    console.log('─────────────────────────────────────────────────────────────');
    const sold2025 = filterEstimatesByYear(allEstimates, 2025, true, true);
    console.log(`Count: ${sold2025.length}`);
    console.log(`Target: 1,057`);
    console.log(`Difference: ${Math.abs(1057 - sold2025.length)}`);
    
    if (sold2025.length === 1057) {
      console.log('\n✅ EXACT MATCH! The function now matches LMN\'s count of 1,057.');
    } else {
      console.log(`\n❌ Still ${Math.abs(1057 - sold2025.length)} off.`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyMatch().catch(console.error);

