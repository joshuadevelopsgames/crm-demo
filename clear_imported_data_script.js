/**
 * Script to clear all imported data from the database
 * Run this with: node clear_imported_data_script.js
 * 
 * This will delete all accounts, contacts, estimates, and jobsites
 * It preserves system data like users, tasks, interactions, scorecards
 * 
 * Usage:
 *   SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node clear_imported_data_script.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function clearImportedData() {
  console.log('🗑️  Starting data deletion...\n');

  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete estimates first
    console.log('Deleting estimates...');
    const { data: estimatesData, error: estimatesError } = await supabase
      .from('estimates')
      .select('id')
      .limit(10000); // Get all estimates
    
    if (estimatesError) {
      console.error('❌ Error fetching estimates:', estimatesError);
      throw estimatesError;
    }
    
    if (estimatesData && estimatesData.length > 0) {
      const { error: deleteError } = await supabase
        .from('estimates')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (deleteError) {
        console.error('❌ Error deleting estimates:', deleteError);
        throw deleteError;
      }
      console.log(`✅ Deleted ${estimatesData.length} estimates\n`);
    } else {
      console.log('✅ No estimates to delete\n');
    }
    
    if (estimatesError) {
      console.error('❌ Error deleting estimates:', estimatesError);
      throw estimatesError;
    }
    console.log(`✅ Deleted estimates (count: ${estimatesCount || 'unknown'})\n`);

    // 2. Delete jobsites
    console.log('Deleting jobsites...');
    const { data: jobsitesData, error: jobsitesFetchError } = await supabase
      .from('jobsites')
      .select('id')
      .limit(10000);
    
    if (jobsitesFetchError) {
      console.error('❌ Error fetching jobsites:', jobsitesFetchError);
      throw jobsitesFetchError;
    }
    
    if (jobsitesData && jobsitesData.length > 0) {
      const { error: deleteError } = await supabase
        .from('jobsites')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (deleteError) {
        console.error('❌ Error deleting jobsites:', deleteError);
        throw deleteError;
      }
      console.log(`✅ Deleted ${jobsitesData.length} jobsites\n`);
    } else {
      console.log('✅ No jobsites to delete\n');
    }

    // 3. Delete contacts
    console.log('Deleting contacts...');
    const { data: contactsData, error: contactsFetchError } = await supabase
      .from('contacts')
      .select('id')
      .limit(10000);
    
    if (contactsFetchError) {
      console.error('❌ Error fetching contacts:', contactsFetchError);
      throw contactsFetchError;
    }
    
    if (contactsData && contactsData.length > 0) {
      const { error: deleteError } = await supabase
        .from('contacts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (deleteError) {
        console.error('❌ Error deleting contacts:', deleteError);
        throw deleteError;
      }
      console.log(`✅ Deleted ${contactsData.length} contacts\n`);
    } else {
      console.log('✅ No contacts to delete\n');
    }

    // 4. Delete accounts
    console.log('Deleting accounts...');
    const { data: accountsData, error: accountsFetchError } = await supabase
      .from('accounts')
      .select('id')
      .limit(10000);
    
    if (accountsFetchError) {
      console.error('❌ Error fetching accounts:', accountsFetchError);
      throw accountsFetchError;
    }
    
    if (accountsData && accountsData.length > 0) {
      const { error: deleteError } = await supabase
        .from('accounts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (deleteError) {
        console.error('❌ Error deleting accounts:', deleteError);
        throw deleteError;
      }
      console.log(`✅ Deleted ${accountsData.length} accounts\n`);
    } else {
      console.log('✅ No accounts to delete\n');
    }

    // Verify deletion
    console.log('🔍 Verifying deletion...\n');
    
    const { count: finalAccounts } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalContacts } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalEstimates } = await supabase
      .from('estimates')
      .select('*', { count: 'exact', head: true });
    
    const { count: finalJobsites } = await supabase
      .from('jobsites')
      .select('*', { count: 'exact', head: true });

    console.log('📊 Final counts:');
    console.log(`   Accounts: ${finalAccounts || 0}`);
    console.log(`   Contacts: ${finalContacts || 0}`);
    console.log(`   Estimates: ${finalEstimates || 0}`);
    console.log(`   Jobsites: ${finalJobsites || 0}\n`);

    if (finalAccounts === 0 && finalContacts === 0 && finalEstimates === 0 && finalJobsites === 0) {
      console.log('✅ All imported data has been successfully deleted!');
      console.log('📥 You can now perform a fresh import.\n');
    } else {
      console.log('⚠️  Some data may still remain. Please check manually.');
    }

  } catch (error) {
    console.error('❌ Error during deletion:', error);
    process.exit(1);
  }
}

// Check for EST5574448 before deletion
async function checkForEstimate() {
  console.log('🔍 Checking for EST5574448 before deletion...\n');
  
  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('*')
    .or(`lmn_estimate_id.eq.EST5574448,estimate_number.eq.EST5574448`)
    .limit(1);
  
  if (error) {
    console.error('Error checking for estimate:', error);
    return;
  }
  
  if (estimate && estimate.length > 0) {
    console.log('✅ Found EST5574448 in database:');
    console.log(JSON.stringify(estimate[0], null, 2));
    console.log('');
  } else {
    console.log('❌ EST5574448 NOT found in database before deletion\n');
  }
}

// Run the script
(async () => {
  await checkForEstimate();
  
  console.log('⚠️  WARNING: This will delete ALL imported data!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await clearImportedData();
})();

