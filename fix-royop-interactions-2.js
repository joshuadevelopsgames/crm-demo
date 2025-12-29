#!/usr/bin/env node

/**
 * Fix Royop interactions - move from Royop Construction to Royop Development
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixRoyopInteractions() {
  console.log('🔧 Fixing Royop interactions...\n');
  
  try {
    // Find Royop Development Ltd account
    const { data: royopDev, error: devError } = await supabase
      .from('accounts')
      .select('id, name')
      .ilike('name', '%royop development%')
      .limit(1);
    
    if (devError) {
      console.error('❌ Error finding Royop Development:', devError);
      return;
    }
    
    if (!royopDev || royopDev.length === 0) {
      console.error('❌ Royop Development Ltd account not found');
      return;
    }
    
    const royopDevId = royopDev[0].id;
    console.log(`✅ Found Royop Development Ltd: ${royopDev[0].name} (${royopDevId})\n`);
    
    // Find Royop Construction Corporation account
    const { data: royopConst, error: constError } = await supabase
      .from('accounts')
      .select('id, name')
      .ilike('name', '%royop construction%')
      .limit(1);
    
    if (constError) {
      console.error('❌ Error finding Royop Construction:', constError);
      return;
    }
    
    if (!royopConst || royopConst.length === 0) {
      console.error('❌ Royop Construction Corporation account not found');
      return;
    }
    
    const royopConstId = royopConst[0].id;
    console.log(`📍 Found Royop Construction Corporation: ${royopConst[0].name} (${royopConstId})\n`);
    
    // Find all interactions linked to Royop Construction
    const { data: interactions, error: interactionsError } = await supabase
      .from('interactions')
      .select('id, subject, account_id, metadata')
      .eq('account_id', royopConstId);
    
    if (interactionsError) {
      console.error('❌ Error fetching interactions:', interactionsError);
      return;
    }
    
    console.log(`📋 Found ${interactions.length} interactions linked to Royop Construction\n`);
    
    if (interactions.length === 0) {
      console.log('✅ No interactions to fix');
      return;
    }
    
    // Update each interaction to link to Royop Development
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const interaction of interactions) {
      try {
        const { error: updateError } = await supabase
          .from('interactions')
          .update({ account_id: royopDevId })
          .eq('id', interaction.id);
        
        if (updateError) {
          console.error(`❌ Error updating interaction ${interaction.id}:`, updateError);
          errorCount++;
        } else {
          updatedCount++;
          console.log(`✅ Updated: ${interaction.subject?.substring(0, 50) || interaction.id}`);
        }
      } catch (error) {
        console.error(`❌ Error updating interaction ${interaction.id}:`, error);
        errorCount++;
      }
    }
    
    // Update account's last_interaction_date if needed
    if (updatedCount > 0) {
      // Get the most recent interaction date for Royop Development
      const { data: recentInteraction } = await supabase
        .from('interactions')
        .select('interaction_date')
        .eq('account_id', royopDevId)
        .order('interaction_date', { ascending: false })
        .limit(1);
      
      if (recentInteraction && recentInteraction.length > 0) {
        const latestDate = recentInteraction[0].interaction_date;
        const { error: accountUpdateError } = await supabase
          .from('accounts')
          .update({ last_interaction_date: latestDate })
          .eq('id', royopDevId);
        
        if (accountUpdateError) {
          console.error('⚠️  Warning: Could not update account last_interaction_date:', accountUpdateError);
        } else {
          console.log(`\n✅ Updated Royop Development Ltd's last_interaction_date to ${latestDate}`);
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`  ✅ Updated: ${updatedCount} interactions`);
    console.log(`  ❌ Errors: ${errorCount} interactions`);
    console.log(`\n✨ All Royop interactions are now linked to Royop Development Ltd`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixRoyopInteractions();

