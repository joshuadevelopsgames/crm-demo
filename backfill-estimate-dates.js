#!/usr/bin/env node

/**
 * Backfill estimate_date for estimates that are missing it
 * Uses estimate_close_date for won estimates, otherwise leaves null
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

async function backfillEstimateDates() {
  console.log('🔧 Backfilling estimate_date for estimates missing it...\n');

  try {
    // Find all estimates without estimate_date
    const { data: estimatesWithoutDate, error: fetchError } = await supabase
      .from('estimates')
      .select('id, lmn_estimate_id, status, estimate_date, estimate_close_date, created_at')
      .is('estimate_date', null);

    if (fetchError) {
      console.error('❌ Error fetching estimates:', fetchError);
      return;
    }

    if (!estimatesWithoutDate || estimatesWithoutDate.length === 0) {
      console.log('✅ All estimates already have estimate_date set.');
      return;
    }

    console.log(`📊 Found ${estimatesWithoutDate.length} estimates without estimate_date`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each estimate
    for (const estimate of estimatesWithoutDate) {
      try {
        let newEstimateDate = null;

        // For won estimates, use estimate_close_date if available
        if (estimate.status === 'won' && estimate.estimate_close_date) {
          newEstimateDate = estimate.estimate_close_date;
        }
        // Otherwise, leave it null (don't use created_at as that's when we imported, not when estimate was created)

        if (newEstimateDate) {
          const { error: updateError } = await supabase
            .from('estimates')
            .update({ estimate_date: newEstimateDate })
            .eq('id', estimate.id);

          if (updateError) {
            console.error(`❌ Error updating estimate ${estimate.lmn_estimate_id || estimate.id}:`, updateError.message);
            errorCount++;
          } else {
            updatedCount++;
            if (updatedCount % 100 === 0) {
              console.log(`  ✅ Updated ${updatedCount} estimates...`);
            }
          }
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing estimate ${estimate.lmn_estimate_id || estimate.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Backfill Summary:');
    console.log('══════════════════════════════════════════════════');
    console.log(`  ✅ Updated: ${updatedCount} estimates`);
    console.log(`  ⏭️  Skipped: ${skippedCount} estimates (no estimate_close_date or not won)`);
    console.log(`  ❌ Errors: ${errorCount} estimates`);
    console.log('══════════════════════════════════════════════════');

    if (updatedCount > 0) {
      console.log('\n✨ Backfill complete! Estimates now have estimate_date set from estimate_close_date (for won estimates).');
    } else {
      console.log('\n✨ No estimates needed updating (all either have estimate_date or are not won estimates with close_date).');
    }
  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
  }
}

backfillEstimateDates();

