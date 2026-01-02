/**
 * Diagnostic tool to check why settings might not be visible
 * Run this in browser console to see what's happening
 */
export async function diagnoseSettingsVisibility() {
  const results = {
    timestamp: new Date().toISOString(),
    issues: [],
    data: {}
  };

  try {
    // Get Supabase client
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    
    if (!supabase) {
      results.issues.push('❌ Supabase not configured');
      return results;
    }

    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      results.issues.push('❌ No active session');
      return results;
    }

    results.data.session = {
      userId: session.user.id,
      email: session.user.email,
      emailNormalized: session.user.email?.toLowerCase()?.trim()
    };

    // Get profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      results.issues.push(`❌ Profile fetch error: ${profileError.message}`);
    } else {
      results.data.profile = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        dark_mode: profile.dark_mode,
        test_mode_enabled: profile.test_mode_enabled,
        notification_preferences: profile.notification_preferences
      };
    }

    // Check test mode eligibility
    const eligibleEmails = [
      'jrsschroeder@gmail.com',
      'jon@lecm.ca',
      'blake@lecm.ca'
    ];
    const userEmail = session.user.email?.toLowerCase()?.trim();
    const isEligibleForTestMode = userEmail && eligibleEmails.some(email => email.toLowerCase() === userEmail);
    
    results.data.testMode = {
      userEmail,
      eligibleEmails,
      isEligible: isEligibleForTestMode,
      profileTestModeEnabled: profile?.test_mode_enabled
    };

    if (!isEligibleForTestMode) {
      results.issues.push(`⚠️ Test Mode: User email "${userEmail}" is not in eligible list`);
    }

    // Check admin status
    const isAdmin = profile?.role === 'system_admin' || 
                    profile?.role === 'admin' || 
                    profile?.email === 'jrsschroeder@gmail.com';
    
    results.data.admin = {
      profileRole: profile?.role,
      profileEmail: profile?.email,
      isAdmin,
      checkMethod: profile?.role ? 'role' : profile?.email === 'jrsschroeder@gmail.com' ? 'email' : 'none'
    };

    if (!isAdmin) {
      results.issues.push(`⚠️ Admin: Profile role is "${profile?.role || 'missing'}", email is "${profile?.email || 'missing'}"`);
    }

    // Check email mismatch
    if (session.user.email !== profile?.email) {
      results.issues.push(`⚠️ Email Mismatch: Session email "${session.user.email}" != Profile email "${profile?.email}"`);
    }

    // Check if profile is missing
    if (!profile) {
      results.issues.push('❌ Profile not found in database');
    }

    // Check localStorage
    const localDarkMode = localStorage.getItem('darkMode');
    const localTestMode = localStorage.getItem('testMode2025');
    
    results.data.localStorage = {
      darkMode: localDarkMode,
      testMode2025: localTestMode,
      matchesProfile: {
        darkMode: localDarkMode === String(profile?.dark_mode),
        testMode: localTestMode === String(profile?.test_mode_enabled)
      }
    };

    if (localDarkMode !== String(profile?.dark_mode)) {
      results.issues.push(`⚠️ Dark Mode Mismatch: localStorage="${localDarkMode}" != Profile="${profile?.dark_mode}"`);
    }

    return results;
  } catch (error) {
    results.issues.push(`❌ Error: ${error.message}`);
    return results;
  }
}

/**
 * Usage in browser console:
 * import('./utils/diagnoseSettingsVisibility').then(m => m.diagnoseSettingsVisibility().then(r => console.log(r)))
 */

