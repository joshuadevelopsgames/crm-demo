/**
 * Check if interactions were created and linked to accounts
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
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
} catch (error) {
  // Silently fail
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkInteractions() {
  console.log('🔍 Checking interactions...\n');
  
  // Get all interactions
  const { data: interactions, error: interactionsError } = await supabase
    .from('interactions')
    .select('id, account_id, contact_id, subject, interaction_date, logged_by, metadata')
    .order('interaction_date', { ascending: false })
    .limit(200);
  
  if (interactionsError) {
    console.error('Error fetching interactions:', interactionsError);
    return;
  }
  
  console.log(`Found ${interactions?.length || 0} interactions\n`);
  
  // Check for Royop
  const { data: royopAccount } = await supabase
    .from('accounts')
    .select('id, name')
    .ilike('name', '%royop%')
    .maybeSingle();
  
  if (royopAccount) {
    console.log(`Found account: ${royopAccount.name} (${royopAccount.id})\n`);
    
    // Check interactions for this account
    const { data: royopInteractions } = await supabase
      .from('interactions')
      .select('id, subject, interaction_date, account_id')
      .eq('account_id', royopAccount.id)
      .order('interaction_date', { ascending: false });
    
    console.log(`Interactions linked to ${royopAccount.name}: ${royopInteractions?.length || 0}`);
    if (royopInteractions && royopInteractions.length > 0) {
      royopInteractions.slice(0, 5).forEach(int => {
        console.log(`  - ${int.subject?.substring(0, 50)} (${int.interaction_date})`);
      });
    } else {
      console.log('  ⚠️  No interactions found for this account');
    }
  } else {
    console.log('⚠️  Could not find Royop account');
  }
  
  // Show recent interactions with account_id
  console.log('\n📋 Recent interactions with account_id:');
  const withAccount = interactions?.filter(i => i.account_id) || [];
  console.log(`  ${withAccount.length} interactions have account_id`);
  withAccount.slice(0, 10).forEach(int => {
    console.log(`  - ${int.subject?.substring(0, 50)} (account_id: ${int.account_id})`);
  });
  
  // Show interactions without account_id
  const withoutAccount = interactions?.filter(i => !i.account_id) || [];
  console.log(`\n⚠️  ${withoutAccount.length} interactions without account_id`);
  withoutAccount.slice(0, 10).forEach(int => {
    console.log(`  - ${int.subject?.substring(0, 50)}`);
  });
  
  // Check for interactions imported from Monday
  const mondayInteractions = interactions?.filter(i => 
    i.metadata?.imported_from === 'monday_activities'
  ) || [];
  console.log(`\n📊 Interactions imported from Monday: ${mondayInteractions.length}`);
  mondayInteractions.slice(0, 10).forEach(int => {
    console.log(`  - ${int.subject?.substring(0, 50)} (account_id: ${int.account_id || 'NONE'})`);
  });
}

checkInteractions()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

