/**
 * Utility to force refresh user profile from database
 * Use this when you need to ensure profile data is up-to-date
 */
export async function forceProfileRefresh() {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    
    if (!supabase) {
      console.error('Supabase not configured');
      return null;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.error('No active session');
      return null;
    }

    // Force fetch fresh profile from database (bypass cache)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    console.log('✅ Profile refreshed from database:', profile);
    
    // Trigger a custom event to notify contexts to refresh
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('profileRefreshed', { detail: { profile } }));
    }

    return profile;
  } catch (error) {
    console.error('Error in forceProfileRefresh:', error);
    return null;
  }
}

/**
 * Add this to browser console to force refresh:
 * import('./utils/forceProfileRefresh').then(m => m.forceProfileRefresh())
 */

