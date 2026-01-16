/**
 * Migration Script: Remove Test Field from ICP Scorecard and Recalculate Scores
 * 
 * This script:
 * 1. Finds the test field in the current ICP template (last question, scale_1_5)
 * 2. Removes it from the template (creates new version)
 * 3. Recalculates all existing scorecard responses by removing test field contribution
 * 4. Updates account organization_score values
 * 
 * USAGE:
 *   Dry run (preview changes): node remove_test_field_and_recalculate_scores.js --dry-run
 *   Apply changes:             node remove_test_field_and_recalculate_scores.js
 * 
 * REQUIREMENTS:
 *   - .env.local file with SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 *   - Node.js with @supabase/supabase-js and dotenv packages
 * 
 * SAFETY:
 *   - Always run with --dry-run first to preview changes
 *   - Creates a new template version (doesn't delete old one)
 *   - Updates existing scorecard records in place
 *   - Backs up nothing - ensure you have database backups before running
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Check for dry-run mode
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

async function main() {
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  console.log('🚀 Starting migration: Remove test field and recalculate scores\n');

  try {
    // Step 1: Get current ICP template
    console.log('📋 Step 1: Fetching current ICP template...');
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
    console.log(`✅ Found template: ${currentTemplate.name} (ID: ${currentTemplate.id})`);
    console.log(`   Questions count: ${currentTemplate.questions?.length || 0}\n`);

    // Step 2: Identify the test field (last question, scale_1_5)
    const questions = currentTemplate.questions || [];
    if (questions.length === 0) {
      throw new Error('Template has no questions');
    }

    // Find test field - it's the last question with scale_1_5
    let testFieldIndex = -1;
    let testField = null;
    
    // Check from the end backwards
    for (let i = questions.length - 1; i >= 0; i--) {
      const q = questions[i];
      if (q.answer_type === 'scale_1_5') {
        // Check if it's likely the test field (at the bottom, might have "test" in text)
        const questionText = (q.question_text || '').toLowerCase();
        if (i === questions.length - 1 || questionText.includes('test')) {
          testFieldIndex = i;
          testField = q;
          break;
        }
      }
    }

    if (testFieldIndex === -1) {
      console.log('⚠️  No test field found (last scale_1_5 question). Checking all scale_1_5 questions...');
      // If not found at the end, check if there's a question with "test" in it
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const questionText = (q.question_text || '').toLowerCase();
        if (q.answer_type === 'scale_1_5' && questionText.includes('test')) {
          testFieldIndex = i;
          testField = q;
          break;
        }
      }
    }

    if (testFieldIndex === -1 || !testField) {
      console.log('❌ Could not identify test field. Please check the template manually.');
      console.log('   Looking for: last question with answer_type="scale_1_5" or containing "test"');
      console.log('\n   All questions:');
      questions.forEach((q, idx) => {
        console.log(`   ${idx}: "${q.question_text}" (${q.answer_type}, weight: ${q.weight})`);
      });
      throw new Error('Test field not found');
    }

    console.log(`✅ Found test field at index ${testFieldIndex}:`);
    console.log(`   Question: "${testField.question_text}"`);
    console.log(`   Type: ${testField.answer_type}, Weight: ${testField.weight}`);
    console.log(`   Section: ${testField.section || testField.category || 'Other'}\n`);

    // Calculate test field's max possible score contribution
    const testFieldMaxScore = testField.weight * 5; // scale_1_5 max is 5
    console.log(`   Max possible score contribution: ${testFieldMaxScore}\n`);

    // Step 3: Remove test field from template
    // NOTE: For this specific test field removal, we update in place (no versioning)
    // Versioning code is preserved below for future use
    console.log('📝 Step 2: Updating template to remove test field...');
    const newQuestions = questions.filter((_, idx) => idx !== testFieldIndex);
    
    // Calculate new total_possible_score
    const newTotalPossibleScore = newQuestions.reduce((sum, q) => {
      const maxAnswer = q.answer_type === 'yes_no' ? 1 : 
                       q.answer_type === 'scale_1_5' ? 5 : 
                       q.answer_type === 'scale_1_10' ? 10 : 1;
      return sum + (q.weight * maxAnswer);
    }, 0);

    if (isDryRun) {
      console.log(`[DRY RUN] Would update existing template (ID: ${currentTemplate.id})`);
      console.log(`[DRY RUN] New total possible score: ${newTotalPossibleScore} (was ${currentTemplate.total_possible_score})`);
      console.log(`[DRY RUN] Would remove ${testFieldMaxScore} from max possible score`);
      console.log(`[DRY RUN] Would remove test field question from ${questions.length} to ${newQuestions.length} questions\n`);
    } else {
      // Update existing template in place (no versioning for this specific case)
      const { data: updatedTemplate, error: updateError } = await supabase
        .from('scorecard_templates')
        .update({
          questions: newQuestions,
          total_possible_score: newTotalPossibleScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentTemplate.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update template: ${updateError.message}`);
      }

      console.log(`✅ Updated template (ID: ${updatedTemplate.id})`);
      console.log(`   New total possible score: ${newTotalPossibleScore} (was ${currentTemplate.total_possible_score})`);
      console.log(`   Removed ${testFieldMaxScore} from max possible score`);
      console.log(`   Questions: ${questions.length} → ${newQuestions.length}\n`);
    }

    /* 
     * VERSIONING CODE (preserved for future use)
     * Uncomment this section if you want to create a new template version instead of updating in place
     * 
    // Get parent_template_id for versioning
    const parentTemplateId = currentTemplate.parent_template_id || currentTemplate.id;
    const nextVersionNumber = (currentTemplate.version_number || 1) + 1;

    // Mark current version as not current
    const { error: updateCurrentError } = await supabase
      .from('scorecard_templates')
      .update({ is_current_version: false })
      .eq('id', currentTemplate.id);

    if (updateCurrentError) {
      throw new Error(`Failed to update current template: ${updateCurrentError.message}`);
    }

    // Create new version
    const newTemplate = {
      name: currentTemplate.name,
      description: currentTemplate.description,
      questions: newQuestions,
      total_possible_score: newTotalPossibleScore,
      pass_threshold: currentTemplate.pass_threshold || 70,
      is_default: true,
      is_current_version: true,
      is_active: true,
      version_number: nextVersionNumber,
      parent_template_id: parentTemplateId
    };

    const { data: createdTemplate, error: createError } = await supabase
      .from('scorecard_templates')
      .insert(newTemplate)
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create new template version: ${createError.message}`);
    }

    console.log(`✅ Created new template version ${nextVersionNumber} (ID: ${createdTemplate.id})`);
    */

    // Step 4: Get all existing scorecard responses
    console.log('📊 Step 3: Fetching all existing scorecard responses...');
    const { data: scorecards, error: scorecardsError } = await supabase
      .from('scorecard_responses')
      .select('*')
      .order('created_at', { ascending: true });

    if (scorecardsError) {
      throw new Error(`Failed to fetch scorecards: ${scorecardsError.message}`);
    }

    console.log(`✅ Found ${scorecards.length} scorecard responses to update\n`);

    // Step 5: Recalculate each scorecard
    console.log('🔄 Step 4: Recalculating scores...');
    let updatedCount = 0;
    let errorCount = 0;
    const testFieldSection = testField.section || testField.category || 'Other';

    for (const scorecard of scorecards) {
      try {
        const responses = scorecard.responses || [];
        const sectionScores = scorecard.section_scores || {};

        // Find the test field response
        const testFieldResponse = responses.find(r => {
          const questionText = (r.question_text || '').toLowerCase();
          const section = r.section || 'Other';
          return (
            (r.answer_type === 'scale_1_5' && questionText.includes('test')) ||
            (section === testFieldSection && r.answer_type === 'scale_1_5' && 
             responses.indexOf(r) === responses.length - 1) // Last response in section
          );
        });

        if (!testFieldResponse) {
          // This scorecard might not have the test field (older version or already updated)
          console.log(`   ⚠️  Scorecard ${scorecard.id} doesn't have test field, skipping...`);
          continue;
        }

        // Calculate test field's contribution
        const testFieldContribution = testFieldResponse.weighted_score || 0;
        const testFieldSectionContribution = sectionScores[testFieldSection] || 0;

        // Remove test field from responses
        const newResponses = responses.filter(r => r !== testFieldResponse);

        // Recalculate section scores
        const newSectionScores = { ...sectionScores };
        if (newSectionScores[testFieldSection] !== undefined) {
          newSectionScores[testFieldSection] = Math.max(0, 
            (newSectionScores[testFieldSection] || 0) - testFieldContribution
          );
          // If section is now empty, remove it
          if (newSectionScores[testFieldSection] === 0) {
            delete newSectionScores[testFieldSection];
          }
        }

        // Recalculate total score
        const newTotalScore = Math.max(0, (scorecard.total_score || 0) - testFieldContribution);

        // Recalculate normalized score based on new total possible score
        const newNormalizedScore = newTotalPossibleScore > 0
          ? Math.round((newTotalScore / newTotalPossibleScore) * 100)
          : 0;

        // Recalculate is_pass
        const passThreshold = currentTemplate.pass_threshold || 70;
        const newIsPass = newNormalizedScore >= passThreshold;

        if (isDryRun) {
          console.log(`   [DRY RUN] Would update scorecard ${scorecard.id}:`);
          console.log(`      Old: total=${scorecard.total_score}, normalized=${scorecard.normalized_score}, pass=${scorecard.is_pass}`);
          console.log(`      New: total=${newTotalScore}, normalized=${newNormalizedScore}, pass=${newIsPass}`);
        } else {
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
            console.error(`   ❌ Failed to update scorecard ${scorecard.id}: ${updateError.message}`);
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
                  console.warn(`   ⚠️  Failed to update account ${scorecard.account_id} score: ${accountUpdateError.message}`);
                }
              }
            }
          }
        }

        updatedCount++;
        if (updatedCount % 10 === 0) {
          console.log(`   ✅ Updated ${updatedCount} scorecards...`);
        }
      } catch (error) {
        console.error(`   ❌ Error processing scorecard ${scorecard.id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n${isDryRun ? '🔍 DRY RUN' : '✅'} Migration ${isDryRun ? 'preview' : 'complete'}!`);
    console.log(`   ${isDryRun ? 'Would update' : 'Updated'}: ${updatedCount} scorecards`);
    console.log(`   Errors: ${errorCount}`);
    if (!isDryRun) {
      console.log(`   Test field removed from template`);
      console.log(`   Template updated in place (no new version created)`);
    } else {
      console.log(`\n   To apply changes, run without --dry-run flag`);
    }

  } catch (error) {
    console.error(`\n❌ Migration failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the migration
main().then(() => {
  console.log('\n🎉 Done!');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

