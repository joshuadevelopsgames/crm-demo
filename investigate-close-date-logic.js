#!/usr/bin/env node

/**
 * Investigate: Why would LMN filter by estimate_close_date?
 * Wouldn't that only include won estimates?
 * Let's check if lost estimates also have close dates
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Try to load .env file if it exists
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
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function getYearFromDate(dateValue) {
  if (!dateValue) return null;
  const dateStr = String(dateValue);
  if (dateStr.length >= 4) {
    return parseInt(dateStr.substring(0, 4));
  }
  return null;
}

const currentYear = new Date().getFullYear();

async function investigateCloseDateLogic() {
  console.log('🔍 Investigating: Why filter by estimate_close_date?\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Fetch all estimates
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching estimates:', error);
        process.exit(1);
      }

      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Loaded ${allEstimates.length} total estimates\n`);

    // ============================================
    // KEY QUESTION: Do lost estimates have close_date?
    // ============================================

    console.log('📊 QUESTION: Do lost estimates have estimate_close_date?\n');

    const wonWithCloseDate = allEstimates.filter(e => e.status === 'won' && e.estimate_close_date).length;
    const wonWithoutCloseDate = allEstimates.filter(e => e.status === 'won' && !e.estimate_close_date).length;
    const lostWithCloseDate = allEstimates.filter(e => e.status === 'lost' && e.estimate_close_date).length;
    const lostWithoutCloseDate = allEstimates.filter(e => e.status === 'lost' && !e.estimate_close_date).length;
    const pendingWithCloseDate = allEstimates.filter(e => e.status !== 'won' && e.status !== 'lost' && e.estimate_close_date).length;
    const pendingWithoutCloseDate = allEstimates.filter(e => e.status !== 'won' && e.status !== 'lost' && !e.estimate_close_date).length;

    console.log('Status vs Close Date Distribution:\n');
    console.log(`Won estimates:`);
    console.log(`  With close_date: ${wonWithCloseDate}`);
    console.log(`  Without close_date: ${wonWithoutCloseDate}\n`);

    console.log(`Lost estimates:`);
    console.log(`  With close_date: ${lostWithCloseDate}`);
    console.log(`  Without close_date: ${lostWithoutCloseDate}\n`);

    console.log(`Pending/Other estimates:`);
    console.log(`  With close_date: ${pendingWithCloseDate}`);
    console.log(`  Without close_date: ${pendingWithoutCloseDate}\n`);

    // ============================================
    // TEST: What if LMN filters by close_date?
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 TEST: If LMN filters by estimate_close_date for 2025:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const estimatesWithCloseDate2025 = allEstimates.filter(e => {
      const closeYear = getYearFromDate(e.estimate_close_date);
      return closeYear === currentYear;
    });

    const wonWithCloseDate2025 = estimatesWithCloseDate2025.filter(e => e.status === 'won').length;
    const lostWithCloseDate2025 = estimatesWithCloseDate2025.filter(e => e.status === 'lost').length;
    const otherWithCloseDate2025 = estimatesWithCloseDate2025.filter(e => e.status !== 'won' && e.status !== 'lost').length;

    console.log(`Total estimates with close_date in ${currentYear}: ${estimatesWithCloseDate2025.length}`);
    console.log(`  Won: ${wonWithCloseDate2025}`);
    console.log(`  Lost: ${lostWithCloseDate2025}`);
    console.log(`  Other: ${otherWithCloseDate2025}\n`);

    console.log(`LMN shows:`);
    console.log(`  Total Estimates: 1,086`);
    console.log(`  Estimates Sold: 927`);
    console.log(`  Difference (likely lost/pending): ${1086 - 927} = 159\n`);

    console.log(`Our data with close_date filter:`);
    console.log(`  Total: ${estimatesWithCloseDate2025.length}`);
    console.log(`  Won: ${wonWithCloseDate2025}`);
    console.log(`  Lost: ${lostWithCloseDate2025}`);
    console.log(`  Difference: ${estimatesWithCloseDate2025.length - wonWithCloseDate2025} = ${estimatesWithCloseDate2025.length - wonWithCloseDate2025}\n`);

    // ============================================
    // ALTERNATIVE: Maybe LMN uses estimate_date for lost estimates?
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💡 ALTERNATIVE HYPOTHESIS:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Maybe LMN uses DIFFERENT date fields based on status:\n');
    console.log('  - Won estimates: Use estimate_close_date (when sold)');
    console.log('  - Lost estimates: Use estimate_date (when created/lost)');
    console.log('  - Pending estimates: Use estimate_date (when created)\n');

    // Test this hypothesis
    const estimates2025Mixed = allEstimates.filter(e => {
      let dateToUse = null;
      if (e.status === 'won' && e.estimate_close_date) {
        // Won: use close_date
        dateToUse = e.estimate_close_date;
      } else if (e.estimate_date) {
        // Lost/Pending: use estimate_date
        dateToUse = e.estimate_date;
      }
      if (!dateToUse) return false;
      const year = getYearFromDate(dateToUse);
      return year === currentYear;
    });

    const wonMixed = estimates2025Mixed.filter(e => e.status === 'won').length;
    const lostMixed = estimates2025Mixed.filter(e => e.status === 'lost').length;
    const otherMixed = estimates2025Mixed.filter(e => e.status !== 'won' && e.status !== 'lost').length;

    console.log(`Testing mixed approach (won=close_date, lost/pending=estimate_date):`);
    console.log(`  Total: ${estimates2025Mixed.length}`);
    console.log(`  Won: ${wonMixed}`);
    console.log(`  Lost: ${lostMixed}`);
    console.log(`  Other: ${otherMixed}\n`);

    // ============================================
    // ANOTHER HYPOTHESIS: Maybe "closed" means both won AND lost?
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💡 ANOTHER HYPOTHESIS:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Maybe "estimate_close_date" means "when estimate was closed" (won OR lost)?\n');
    console.log('In business terms:');
    console.log('  - "Closed" = Deal is done (won or lost)');
    console.log('  - "Open" = Deal is still active (pending)\n');

    console.log('So filtering by close_date would include:');
    console.log('  - Won estimates (closed as won)');
    console.log('  - Lost estimates (closed as lost)');
    console.log('  - Exclude pending estimates (not closed yet)\n');

    // Check if lost estimates typically have close_date
    const lostSample = allEstimates.filter(e => e.status === 'lost' && e.estimate_close_date).slice(0, 5);
    const wonSample = allEstimates.filter(e => e.status === 'won' && e.estimate_close_date).slice(0, 5);

    console.log('Sample lost estimates with close_date:');
    lostSample.forEach((e, idx) => {
      console.log(`  ${idx + 1}. ${e.lmn_estimate_id || e.id}: status=${e.status}, close_date=${e.estimate_close_date}, estimate_date=${e.estimate_date}`);
    });
    console.log('');

    console.log('Sample won estimates with close_date:');
    wonSample.forEach((e, idx) => {
      console.log(`  ${idx + 1}. ${e.lmn_estimate_id || e.id}: status=${e.status}, close_date=${e.estimate_close_date}, estimate_date=${e.estimate_date}`);
    });
    console.log('');

    // ============================================
    // FINAL ANALYSIS: What makes most sense?
    // ============================================

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎯 FINAL ANALYSIS:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('LMN shows "Total Estimates: 1,086" and "Estimates Sold: 927"');
    console.log('This means 159 estimates are NOT sold (likely lost or pending)\n');

    console.log('If LMN filters by estimate_close_date only:');
    console.log(`  We get: ${estimatesWithCloseDate2025.length} estimates`);
    console.log(`  Won: ${wonWithCloseDate2025}, Lost: ${lostWithCloseDate2025}`);
    console.log(`  This would include both won AND lost (if lost have close_date)\n`);

    console.log('If lost estimates DON\'T have close_date, then:');
    console.log('  Filtering by close_date would ONLY get won estimates');
    console.log('  But LMN shows 1,086 total (more than just won)\n');

    console.log('CONCLUSION:');
    if (lostWithCloseDate > 0) {
      console.log(`  ✅ Lost estimates DO have close_date (${lostWithCloseDate} of them)`);
      console.log('  → So filtering by close_date includes both won AND lost');
      console.log('  → This makes sense: "closed" means deal is done (won or lost)');
      console.log('  → Pending estimates don\'t have close_date (deal not closed yet)');
    } else {
      console.log(`  ❌ Lost estimates DON'T have close_date (${lostWithCloseDate} of them)`);
      console.log('  → So filtering by close_date would only get won estimates');
      console.log('  → But LMN shows 1,086 total, which is more than just won');
      console.log('  → This suggests LMN uses a DIFFERENT filtering strategy');
      console.log('  → Maybe: estimate_date for all estimates? Or mixed approach?');
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

investigateCloseDateLogic();

