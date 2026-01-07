import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getSupabaseAuth } from '../services/supabaseClient';
import { Capacitor } from '@capacitor/core';

// App plugin is optional - will be loaded dynamically at runtime if needed
async function getAppPlugin() {
  // Only try to load in native app environment
  if (typeof window === 'undefined' || !window.Capacitor?.isNativePlatform()) {
    return null;
  }
  
  try {
    // Use a dynamic string to avoid static analysis
    const pluginName = '@capacitor/app';
    const module = await import(/* @vite-ignore */ pluginName);
    return module.App;
  } catch (e) {
    console.log('App plugin not installed, deep linking may not work');
    return null;
  }
}

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [error, setError] = useState(null);
  const isMobile = Capacitor.isNativePlatform();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GoogleAuthCallback.jsx:35',message:'handleAuthCallback entry',data:{hostname:window.location.hostname,origin:window.location.origin,fullUrl:window.location.href,hash:window.location.hash,search:window.location.search},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      const supabase = getSupabaseAuth();
      if (!supabase) {
        setStatus('error');
        setError('Authentication is not configured. Please set up Supabase.');
        return;
      }

      try {
        // Check for error in URL params (query string or hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorParam = searchParams.get('error') || hashParams.get('error');
        const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GoogleAuthCallback.jsx:47',message:'URL params check',data:{errorParam,errorDescription,hashLength:window.location.hash.length,searchLength:window.location.search.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        if (errorParam) {
          setStatus('error');
          setError(
            errorParam === 'access_denied'
              ? 'Google sign-in was cancelled. Please try again.'
              : errorDescription || 'An error occurred during Google authentication.'
          );
          return;
        }

        // Supabase automatically processes OAuth callbacks from URL hash fragments
        // Wait a moment for Supabase to process the callback, then check for session
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GoogleAuthCallback.jsx:63',message:'getSession result',data:{hasSession:!!session,hasError:!!error,errorMessage:error?.message,hasUser:!!session?.user,userEmail:session?.user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion

        if (error) {
          throw error;
        }

        if (session && session.user) {
          // Validate that the user's email exists in the profiles table
          const userEmail = session.user.email;
          console.log('🔍 Validating user email:', userEmail);
          
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', userEmail)
            .maybeSingle();

          if (profileError) {
            console.error('❌ Error checking profile:', profileError);
            // Sign out the user since we can't validate
            await supabase.auth.signOut();
            setStatus('error');
            setError('Unable to verify your account. Please contact support.');
            return;
          }

          if (!profile) {
            // User doesn't exist in profiles table - deny access
            console.log('❌ User email not found in profiles:', userEmail);
            await supabase.auth.signOut();
            setStatus('error');
            setError('Your email address is not authorized to access this system. Please contact your administrator to create an account.');
            return;
          }

          // User exists - proceed with login
          console.log('✅ User validated, email exists in profiles');
          setStatus('success');
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GoogleAuthCallback.jsx:100',message:'About to redirect after successful login',data:{isMobile,hostname:window.location.hostname,origin:window.location.origin,willNavigateTo:'/dashboard'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          // If in mobile app, redirect to app scheme, otherwise navigate to dashboard
          if (isMobile) {
            setTimeout(() => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GoogleAuthCallback.jsx:105',message:'Mobile redirect executing',data:{targetUrl:'com.lecrm.app://dashboard',currentOrigin:window.location.origin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
              // #endregion
              window.location.href = 'com.lecrm.app://dashboard';
            }, 1000);
          } else {
            setTimeout(() => {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GoogleAuthCallback.jsx:110',message:'Web redirect executing navigate',data:{targetPath:'/dashboard',currentOrigin:window.location.origin,currentPathname:window.location.pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
              // #endregion
              navigate('/dashboard');
            }, 1500);
          }
        } else {
          // No session found - might need to wait a bit for Supabase to process
          setTimeout(async () => {
            const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
            if (retryError) {
              setStatus('error');
              setError(retryError.message || 'Failed to authenticate with Google. Please try again.');
            } else if (retrySession && retrySession.user) {
              // Validate user exists in profiles
              const userEmail = retrySession.user.email;
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('email', userEmail)
                .maybeSingle();

              if (!profile) {
                await supabase.auth.signOut();
                setStatus('error');
                setError('Your email address is not authorized to access this system. Please contact your administrator to create an account.');
                return;
              }

              setStatus('success');
              navigate('/dashboard');
            } else {
              setStatus('error');
              setError('No session found. Please try signing in again.');
            }
          }, 1000);
        }
      } catch (err) {
        console.error('Error in Google auth callback:', err);
        setStatus('error');
        setError(err.message || 'Failed to authenticate with Google. Please try again.');
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate, location, isMobile]);

  // Listen for app URL open events (mobile deep linking)
  useEffect(() => {
    if (!isMobile) return;

    let AppInstance = null;
    let cleanup = null;

    const setupAppListener = async () => {
      AppInstance = await getAppPlugin();
      if (!AppInstance || typeof AppInstance.addListener !== 'function') {
        return;
      }

      const handleAppUrl = async (event) => {
        const supabase = getSupabaseAuth();
        if (!supabase) return;

        try {
          // Supabase handles the OAuth callback automatically
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            setStatus('error');
            setError(error.message || 'Failed to authenticate with Google. Please try again.');
          } else if (session) {
            setStatus('success');
            setTimeout(() => {
              window.location.href = 'com.lecrm.app://dashboard';
            }, 1000);
          }
        } catch (err) {
          console.error('Error in mobile app URL handler:', err);
          setStatus('error');
          setError(err.message || 'Failed to authenticate with Google. Please try again.');
        }
      };
      
      AppInstance.addListener('appUrlOpen', handleAppUrl);
      
      cleanup = () => {
        if (AppInstance && typeof AppInstance.removeListener === 'function') {
          AppInstance.removeListener('appUrlOpen', handleAppUrl);
        }
      };
    };

    setupAppListener();

    return () => {
      if (cleanup) cleanup();
    };
  }, [isMobile, navigate]);

  const safeAreaTop = isMobile ? 'env(safe-area-inset-top, 0px)' : '0px';
  const safeAreaBottom = isMobile ? 'env(safe-area-inset-bottom, 0px)' : '0px';
  
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1f5f9',
      padding: '20px',
      paddingTop: `calc(20px + ${safeAreaTop})`,
      paddingBottom: `calc(20px + ${safeAreaBottom})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      WebkitOverflowScrolling: 'touch'
    }}>
      <Card className="w-full max-w-md" style={{ backgroundColor: 'white' }}>
        <CardContent className="p-8 text-center" style={{ padding: isMobile ? '24px' : '32px' }}>
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Signing in with Google</h2>
              <p className="text-slate-600">Please wait while we authenticate your account...</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Successfully signed in!</h2>
              <p className="text-slate-600">Redirecting to your dashboard...</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Authentication failed</h2>
              <p className="text-slate-600 mb-6">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                style={isMobile ? {
                  minHeight: '48px',
                  fontSize: '16px',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation'
                } : {}}
              >
                Back to Login
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

