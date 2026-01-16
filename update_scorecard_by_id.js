/**
 * Script to manually update a specific scorecard by ID or account ID
 * 
 * Usage: node update_scorecard_by_id.js [scorecard_id] [account_id]
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

async function updateScorecard(scorecardId = null, accountId = null) {
  console.log('🚀 Updating scorecard...\n');

  try {
    // Get current template
    const { data: templates } = await supabase
      .from('scorecard_templates')
      .select('*')
      .eq('is_default', true)
      .eq('is_current_version', true)
      .limit(1);

    if (!templates || templates.length === 0) {
      throw new Error('No ICP template found');
    }

    const template = templates[0];
    const newTotalPossibleScore = template.total_possible_score || 504;
    const passThreshold = template.pass_threshold || 70;

    // Find scorecard
    let scorecard;
    if (scorecardId) {
      const { data, error } = await supabase
        .from('scorecard_responses')
        .select('*')
        .eq('id', scorecardId)
        .single();
      
      if (error) throw new Error(`Failed to find scorecard: ${error.message}`);
      scorecard = data;
    } else if (accountId) {
      const { data, error } = await supabase
        .from('scorecard_responses')
        .select('*')
        .eq('account_id', accountId)
        .order('completed_date', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw new Error(`Failed to find scorecard for account: ${error.message}`);
      scorecard = data;
    } else {
      throw new Error('Please provide either scorecard_id or account_id');
    }

    console.log(`✅ Found scorecard: ${scorecard.id}`);
    console.log(`   Account ID: ${scorecard.account_id}`);
    console.log(`   Current total: ${scorecard.total_score}`);
    console.log(`   Current normalized: ${scorecard.normalized_score}\n`);

    const responses = scorecard.responses || [];
    const sectionScores = scorecard.section_scores || {};

    // Find test field
    const testFieldResponse = responses.find(r => {
      const questionText = (r.question_text || '').toLowerCase();
      return questionText === 'test' || questionText.includes('test');
    });

    if (!testFieldResponse) {
      console.log('⚠️  This scorecard does not have a test field. Nothing to update.');
      return;
    }

    const testFieldContribution = testFieldResponse.weighted_score || 0;
    const testFieldSection = testFieldResponse.section || 'Other';

    console.log(`📝 Test field found:`);
    console.log(`   Question: "${testFieldResponse.question_text}"`);
    console.log(`   Contribution: ${testFieldContribution} points`);
    console.log(`   Section: ${testFieldSection}\n`);

    // Remove test field
    const newResponses = responses.filter(r => r !== testFieldResponse);
    const newSectionScores = { ...sectionScores };
    
    if (newSectionScores[testFieldSection] !== undefined) {
      newSectionScores[testFieldSection] = Math.max(0, 
        (newSectionScores[testFieldSection] || 0) - testFieldContribution
      );
    }

    const newTotalScore = Math.max(0, (scorecard.total_score || 0) - testFieldContribution);
    const newNormalizedScore = newTotalPossibleScore > 0
      ? Math.round((newTotalScore / newTotalPossibleScore) * 100)
      : 0;
    const newIsPass = newNormalizedScore >= passThreshold;

    console.log(`📊 Recalculated scores:`);
    console.log(`   Total: ${scorecard.total_score} → ${newTotalScore}`);
    console.log(`   Normalized: ${scorecard.normalized_score} → ${newNormalizedScore}`);
    console.log(`   Pass: ${scorecard.is_pass} → ${newIsPass}\n`);

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
      throw new Error(`Failed to update: ${updateError.message}`);
    }

    // Update account score
    if (scorecard.account_id) {
      const { error: accountError } = await supabase
        .from('accounts')
        .update({ organization_score: newNormalizedScore })
        .eq('id', scorecard.account_id);

      if (accountError) {
        console.warn(`⚠️  Failed to update account score: ${accountError.message}`);
      } else {
        console.log(`✅ Updated account organization_score to ${newNormalizedScore}`);
      }
    }

    console.log(`\n✅ Scorecard updated successfully!`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Get command line arguments
const scorecardId = process.argv[2];
const accountId = process.argv[3];

updateScorecard(scorecardId, accountId).then(() => {
  process.exit(0);
});

