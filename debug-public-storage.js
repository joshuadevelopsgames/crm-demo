/**
 * Debug why Public Storage is not showing up
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function debug() {
  const supabase = getSupabase();
  const accountId = 'lmn-account-3661753';
  
  // Get estimates exactly as the cron job does
  const { data: estimates } = await supabase
    .from('estimates')
    .select('*')
    .eq('archived', false)
    .eq('account_id', accountId);
  
  console.log(`Non-archived estimates for Public Storage: ${estimates?.length || 0}\n`);
  
  const estIds = ['EST3351938', 'EST3259705', 'EST3259698', 'EST3259613', 'EST3259701', 'EST3259710'];
  
  estIds.forEach(estId => {
    const est = estimates?.find(e => 
      (e.estimate_number || '').toUpperCase() === estId ||
      (e.lmn_estimate_id || '').toUpperCase() === estId
    );
    
    if (est) {
      console.log(`✅ ${estId}: Found, archived=${est.archived}`);
    } else {
      console.log(`❌ ${estId}: NOT FOUND in non-archived estimates`);
      
      // Check if it exists but is archived
      supabase.from('estimates')
        .select('id, estimate_number, lmn_estimate_id, archived')
        .or(`estimate_number.eq.${estId},lmn_estimate_id.eq.${estId}`)
        .eq('account_id', accountId)
        .then(({data}) => {
          if (data && data.length > 0) {
            console.log(`   But exists as archived: ${data[0].archived}`);
          }
        });
    }
  });
}

debug().catch(console.error);

