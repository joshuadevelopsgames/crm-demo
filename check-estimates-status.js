/**
 * Check the actual status of the 6 estimates for Public Storage
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { startOfDay, differenceInDays } from 'date-fns';

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

function isWonStatus(est) {
  if (est.pipeline_status) {
    const pipelineLower = est.pipeline_status.toString().toLowerCase().trim();
    if (pipelineLower === 'sold' || pipelineLower.includes('sold')) {
      return true;
    }
  }
  if (!est.status) return false;
  const statusLower = est.status.toString().toLowerCase().trim();
  const wonStatuses = ['contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'sold', 'won'];
  return wonStatuses.includes(statusLower);
}

async function check() {
  const supabase = getSupabase();
  const accountId = 'lmn-account-3661753';
  const today = startOfDay(new Date());
  const DAYS_THRESHOLD = 180;
  
  // Get estimates exactly as cron job does
  const { data: estimates } = await supabase
    .from('estimates')
    .select('*')
    .eq('archived', false)
    .eq('account_id', accountId);
  
  console.log(`Total non-archived estimates: ${estimates?.length || 0}\n`);
  
  const estIds = ['EST3351938', 'EST3259705', 'EST3259698', 'EST3259613', 'EST3259701', 'EST3259710'];
  
  estIds.forEach(estId => {
    const est = estimates?.find(e => {
      const eId = (e.estimate_number || e.lmn_estimate_id || '').toString().toUpperCase();
      return eId === estId;
    });
    
    if (!est) {
      console.log(`❌ ${estId}: NOT FOUND`);
      return;
    }
    
    console.log(`\n📋 ${estId}:`);
    console.log(`   Status: ${est.status || 'N/A'}`);
    console.log(`   Pipeline Status: ${est.pipeline_status || 'N/A'}`);
    console.log(`   Is Won: ${isWonStatus(est) ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Contract End: ${est.contract_end || 'N/A'}`);
    console.log(`   Archived: ${est.archived ? 'YES' : 'NO'}`);
    
    if (est.contract_end) {
      try {
        const renewalDate = startOfDay(new Date(est.contract_end));
        if (isNaN(renewalDate.getTime())) {
          console.log(`   Days Until: INVALID DATE ❌`);
        } else {
          const daysUntil = differenceInDays(renewalDate, today);
          console.log(`   Days Until: ${daysUntil}`);
          console.log(`   In Window (0-180): ${daysUntil >= 0 && daysUntil <= DAYS_THRESHOLD ? 'YES ✅' : 'NO ❌'}`);
        }
      } catch (e) {
        console.log(`   Days Until: ERROR - ${e.message}`);
      }
    }
  });
}

check().catch(console.error);


