/**
 * Script to recalculate existing scorecards that contain the test field
 * 
 * This script finds all scorecards with the test field and recalculates their scores
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Finding and recalculating scorecards with test field\n');

  try {
    // Get current template to know the new total_possible_score
    const { data: templates, error: templateError } = await supabase
      .from('scorecard_templates')
      .select('*')
      .eq('is_default', true)
      .eq('is_current_version', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (templateError) {
      throw new Error(`Failed to fetch template: ${templateError.message}`);
    }

    if (!templates || templates.length === 0) {
      throw new Error('No ICP template found');
    }

    const currentTemplate = templates[0];
    const newTotalPossibleScore = currentTemplate.total_possible_score || 504;
    const passThreshold = currentTemplate.pass_threshold || 70;
    
    console.log(`✅ Using template: ${currentTemplate.name}`);
    console.log(`   New total possible score: ${newTotalPossibleScore}\n`);

    // Get all scorecard responses - try different approaches
    console.log('📊 Fetching all scorecard responses...');
    let scorecards = [];
    
    // Try standard query
    const { data: allScorecards, error: scorecardsError } = await supabase
      .from('scorecard_responses')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (scorecardsError) {
      console.warn(`⚠️  Standard query failed: ${scorecardsError.message}`);
    } else {
      scorecards = allScorecards || [];
    }
    
    // Also try to find by account name (Costco)
    if (scorecards.length === 0) {
      console.log('🔍 Trying to find Costco account and scorecard...');
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name')
        .ilike('name', '%costco%')
        .limit(1);
      
      if (accounts && accounts.length > 0) {
        const costcoId = accounts[0].id;
        console.log(`   Found Costco account: ${costcoId}`);
        
        const { data: costcoScorecards } = await supabase
          .from('scorecard_responses')
          .select('*')
          .eq('account_id', costcoId);
        
        if (costcoScorecards && costcoScorecards.length > 0) {
          scorecards = costcoScorecards;
          console.log(`   ✅ Found ${scorecards.length} scorecard(s) for Costco`);
        }
      }
    }

    if (scorecardsError) {
      throw new Error(`Failed to fetch scorecards: ${scorecardsError.message}`);
    }

    console.log(`✅ Found ${scorecards.length} scorecard responses\n`);

    if (scorecards.length === 0) {
      console.log('⚠️  No scorecards found. They may be in a different database or table.');
      console.log('   If you see scorecards in the UI, they may be cached or in a different environment.\n');
      return;
    }

    // Find scorecards with test field
    console.log('🔍 Searching for scorecards with test field...');
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const scorecard of scorecards) {
      try {
        const responses = scorecard.responses || [];
        const sectionScores = scorecard.section_scores || {};

        // Find the test field response
        const testFieldResponse = responses.find(r => {
          const questionText = (r.question_text || '').toLowerCase();
          return questionText === 'test' || questionText.includes('test');
        });

        if (!testFieldResponse) {
          // This scorecard doesn't have the test field
          skippedCount++;
          continue;
        }

        console.log(`\n📝 Found scorecard ${scorecard.id} with test field:`);
        console.log(`   Account ID: ${scorecard.account_id}`);
        console.log(`   Current total: ${scorecard.total_score}`);
        console.log(`   Current normalized: ${scorecard.normalized_score}`);
        console.log(`   Test field contribution: ${testFieldResponse.weighted_score || 0}`);

        // Calculate test field's contribution
        const testFieldContribution = testFieldResponse.weighted_score || 0;
        const testFieldSection = testFieldResponse.section || 'Other';

        // Remove test field from responses
        const newResponses = responses.filter(r => r !== testFieldResponse);

        // Recalculate section scores
        const newSectionScores = { ...sectionScores };
        if (newSectionScores[testFieldSection] !== undefined) {
          newSectionScores[testFieldSection] = Math.max(0, 
            (newSectionScores[testFieldSection] || 0) - testFieldContribution
          );
          // If section is now empty or zero, we can keep it or remove it
          // Let's keep it for now to preserve structure
        }

        // Recalculate total score
        const newTotalScore = Math.max(0, (scorecard.total_score || 0) - testFieldContribution);

        // Recalculate normalized score based on new total possible score
        const newNormalizedScore = newTotalPossibleScore > 0
          ? Math.round((newTotalScore / newTotalPossibleScore) * 100)
          : 0;

        // Recalculate is_pass
        const newIsPass = newNormalizedScore >= passThreshold;

        console.log(`   New total: ${newTotalScore}`);
        console.log(`   New normalized: ${newNormalizedScore}`);
        console.log(`   New pass status: ${newIsPass ? 'PASS' : 'FAIL'}`);

        // Update scorecard
        const { error: updateError } = await supabase
          .from('scorecard_responses')
          .update({
            responses: newResponses,
            section_scores: newSectionScores,
            total_score: newTotalScore,
            normalized_score: newNormalizedScore,
            is_pass: newIsPass,
            updated_at: new Date().toISOString()
          })
          .eq('id', scorecard.id);

        if (updateError) {
          console.error(`   ❌ Failed to update: ${updateError.message}`);
          errorCount++;
          continue;
        }

        // Update account's organization_score if this is the most recent scorecard for the account
        if (scorecard.account_id) {
          // Get the most recent scorecard for this account
          const { data: accountScorecards } = await supabase
            .from('scorecard_responses')
            .select('normalized_score, completed_date')
            .eq('account_id', scorecard.account_id)
            .order('completed_date', { ascending: false })
            .limit(1);

          if (accountScorecards && accountScorecards.length > 0) {
            const latestScorecard = accountScorecards[0];
            // Only update if this is the latest scorecard
            if (latestScorecard.completed_date === scorecard.completed_date) {
              const { error: accountUpdateError } = await supabase
                .from('accounts')
                .update({ organization_score: newNormalizedScore })
                .eq('id', scorecard.account_id);

              if (accountUpdateError) {
                console.warn(`   ⚠️  Failed to update account score: ${accountUpdateError.message}`);
              } else {
                console.log(`   ✅ Updated account organization_score to ${newNormalizedScore}`);
              }
            }
          }
        }

        updatedCount++;
        console.log(`   ✅ Updated successfully`);

      } catch (error) {
        console.error(`   ❌ Error processing scorecard ${scorecard.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n✅ Recalculation complete!`);
    console.log(`   Updated: ${updatedCount} scorecards`);
    console.log(`   Skipped: ${skippedCount} scorecards (no test field)`);
    console.log(`   Errors: ${errorCount}`);

  } catch (error) {
    console.error(`\n❌ Script failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  console.log('\n🎉 Done!');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

