/**
 * Fix Royop interactions to link to Royop Development Ltd
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Try to load .env file
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
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  }
} catch (error) {}

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

async function fixRoyopInteractions() {
  // Find Royop Development Ltd
  const { data: royopDev } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('name', 'Royop Development Ltd')
    .maybeSingle();
  
  if (!royopDev) {
    console.log('❌ Could not find Royop Development Ltd account');
    return;
  }
  
  console.log(`Found account: ${royopDev.name} (${royopDev.id})\n`);
  
  // Find all interactions with "Royop" in subject that don't have account_id
  const { data: interactions } = await supabase
    .from('interactions')
    .select('id, subject, account_id')
    .or('subject.ilike.%royop%,subject.ilike.%Royop%')
    .is('account_id', null)
    .limit(100);
  
  console.log(`Found ${interactions?.length || 0} Royop interactions without account_id\n`);
  
  if (!interactions || interactions.length === 0) {
    console.log('No interactions to fix');
    return;
  }
  
  // Update them to link to Royop Development Ltd
  let updated = 0;
  for (const interaction of interactions) {
    const { error } = await supabase
      .from('interactions')
      .update({ account_id: royopDev.id })
      .eq('id', interaction.id);
    
    if (error) {
      console.error(`Error updating interaction ${interaction.id}:`, error.message);
    } else {
      updated++;
      if (updated % 10 === 0) {
        process.stdout.write(`  Updated ${updated} interactions...\r`);
      }
    }
  }
  
  // Update account's last_interaction_date
  const { data: latestInteraction } = await supabase
    .from('interactions')
    .select('interaction_date')
    .eq('account_id', royopDev.id)
    .order('interaction_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (latestInteraction?.interaction_date) {
    await supabase
      .from('accounts')
      .update({ 
        last_interaction_date: latestInteraction.interaction_date.split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', royopDev.id);
  }
  
  console.log(`\n✅ Updated ${updated} interactions to link to ${royopDev.name}`);
}

fixRoyopInteractions()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

