/**
 * Diagnostic script to check for Supabase limits
 * Run this to identify what limit might be hit
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function diagnose() {
  console.log('🔍 Diagnosing Supabase limits...\n');

  // Test 1: Check if table exists and is accessible
  console.log('1️⃣ Testing table access...');
  const { data: tableData, error: tableError } = await supabase
    .from('user_notification_states')
    .select('user_id')
    .limit(1);
  
  if (tableError) {
    console.error('   ❌ Table access error:', tableError.message);
    if (tableError.message.includes('permission') || tableError.message.includes('policy')) {
      console.error('   ⚠️  This looks like an RLS policy issue');
    }
  } else {
    console.log('   ✅ Table is accessible');
  }

  // Test 2: Check row count
  console.log('\n2️⃣ Checking row count...');
  const { count, error: countError } = await supabase
    .from('user_notification_states')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('   ❌ Count error:', countError.message);
  } else {
    console.log(`   ✅ Found ${count} user notification state records`);
  }

  // Test 3: Check JSONB size for each user
  console.log('\n3️⃣ Checking JSONB notification array sizes...');
  const { data: allStates, error: statesError } = await supabase
    .from('user_notification_states')
    .select('user_id, notifications');
  
  if (statesError) {
    console.error('   ❌ Error fetching states:', statesError.message);
  } else if (allStates) {
    allStates.forEach(state => {
      const notificationCount = Array.isArray(state.notifications) ? state.notifications.length : 0;
      const jsonbSize = JSON.stringify(state.notifications || []).length;
      const jsonbSizeKB = (jsonbSize / 1024).toFixed(2);
      
      console.log(`   User ${state.user_id}: ${notificationCount} notifications, ${jsonbSizeKB} KB`);
      
      if (jsonbSize > 1 * 1024 * 1024) { // > 1MB
        console.warn(`   ⚠️  WARNING: JSONB size exceeds 1MB for user ${state.user_id}`);
      }
    });
  }

  // Test 4: Test query with specific user_id
  console.log('\n4️⃣ Testing query with specific user_id...');
  if (allStates && allStates.length > 0) {
    const testUserId = allStates[0].user_id;
    console.log(`   Testing with user_id: ${testUserId}`);
    
    const startTime = Date.now();
    const { data: singleState, error: singleError } = await supabase
      .from('user_notification_states')
      .select('*')
      .eq('user_id', testUserId)
      .single();
    const queryTime = Date.now() - startTime;
    
    if (singleError) {
      console.error('   ❌ Single query error:', singleError.message);
      console.error('   Error code:', singleError.code);
    } else {
      const notificationCount = Array.isArray(singleState?.notifications) ? singleState.notifications.length : 0;
      console.log(`   ✅ Query successful: ${notificationCount} notifications in ${queryTime}ms`);
      
      if (queryTime > 5000) {
        console.warn(`   ⚠️  WARNING: Query took ${queryTime}ms (slow query)`);
      }
    }
  }

  // Test 5: Check for RLS policies
  console.log('\n5️⃣ Checking RLS policies...');
  const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'user_notification_states';
    `
  }).catch(() => ({ data: null, error: { message: 'Cannot query pg_policies directly' } }));
  
  if (policiesError) {
    console.log('   ℹ️  Cannot check RLS policies directly (this is normal)');
    console.log('   Note: Service role key should bypass RLS automatically');
  } else if (policies) {
    console.log('   RLS policies:', policies);
  }

  console.log('\n✅ Diagnosis complete');
}

diagnose().catch(console.error);

