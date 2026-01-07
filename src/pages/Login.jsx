import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import toast from 'react-hot-toast';
import { createPageUrl } from '../utils';
import { getSupabaseAuth } from '../services/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { useTheme } from '@/contexts/ThemeContext';

export default function Login() {
  console.log('✅ Login component is rendering!');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  
  useEffect(() => {
    console.log('✅ Login component mounted');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('🔐 Login form submitted with email:', email);
      const supabase = getSupabaseAuth();
      console.log('🔐 Supabase client:', supabase ? '✅ Found' : '❌ Not found');
      console.log('🔐 Environment check:', {
        hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
        hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        url: import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing',
        key: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
      });
      
      if (!supabase) {
        console.warn('⚠️ Supabase not configured');
        toast.error('Authentication is not configured. Please contact support.');
        setIsLoading(false);
        return;
      }

      // Sign in with email and password using Supabase
      console.log('🔐 Attempting Supabase login with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          code: error.code,
          fullError: JSON.stringify(error, null, 2)
        });
        
        // Check if it's an API key error
        if (error.message && error.message.includes('API key')) {
          console.error('❌ API KEY ERROR DETECTED');
          console.error('Current URL:', import.meta.env.VITE_SUPABASE_URL);
          console.error('Current Key (first 30 chars):', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 30));
        }
        
        // Provide more helpful error messages
        let errorMessage = error.message || 'Login failed. Please check your credentials.';
        
        if (error.message?.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check:\n' +
            '1. Email is correct: ' + email + '\n' +
            '2. Password matches what you set in Supabase\n' +
            '3. User exists in Supabase Dashboard → Authentication → Users\n' +
            '4. Email is confirmed (check "Auto Confirm Email" was checked when creating user)';
          console.error('🔍 Troubleshooting tips:', {
            emailUsed: email,
            suggestion: 'Check Supabase Dashboard → Authentication → Users to verify user exists and is confirmed'
          });
        } else if (error.message?.includes('Email not confirmed')) {
          errorMessage = 'Please confirm your email address before logging in. Check your inbox for a confirmation email.';
        }
        
        toast.error(errorMessage);
        setIsLoading(false);
        return;
      }

      console.log('✅ Login successful:', {
        userId: data.user?.id,
        email: data.user?.email,
        session: !!data.session,
        hasSession: !!data.session
      });

      toast.success('Successfully logged in!', { duration: 2000 });
      navigate('/dashboard');
    } catch (error) {
      console.error('❌ Login exception:', error);
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const supabase = getSupabaseAuth();
      
      if (!supabase) {
        toast.error('Authentication is not configured. Please contact support.');
        setIsLoading(false);
        return;
      }

      // Get the redirect URL - always use the current domain (never localhost)
      // If on localhost, use dev domain; otherwise use current origin
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');
      const redirectUrl = isLocalhost
        ? 'https://lecrm-dev.vercel.app/google-auth-callback' // Use dev domain for local development
        : window.location.origin + '/google-auth-callback'; // Use current domain for deployed environments
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Login.jsx:120',message:'handleGoogleSignIn - redirect URL calculation',data:{hostname:window.location.hostname,origin:window.location.origin,isLocalhost,redirectUrl,fullUrl:window.location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      console.log('🔐 Initiating Google OAuth sign-in with redirect:', redirectUrl);
      
      // Sign in with Google OAuth
      // Request Gmail readonly scope during initial login so users can grant Gmail access upfront
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          scopes: 'https://www.googleapis.com/auth/gmail.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // Force consent screen to ensure Gmail scope is requested
          },
        },
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Login.jsx:133',message:'signInWithOAuth response',data:{hasError:!!error,errorMessage:error?.message,hasData:!!data,dataUrl:data?.url,redirectTo:redirectUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (error) {
        console.error('❌ Google OAuth error:', error);
        toast.error(error.message || 'Failed to initiate Google sign-in. Please try again.');
        setIsLoading(false);
        return;
      }

      // If successful, Supabase will redirect to Google, then back to our callback
      console.log('✅ Google OAuth initiated, redirecting to:', data.url);
    } catch (error) {
      console.error('❌ Google sign-in exception:', error);
      toast.error(error.message || 'Failed to initiate Google sign-in. Please try again.');
      setIsLoading(false);
    }
  };

  const { isPWA, isMobile, isDesktop, isNativeApp } = useDeviceDetection();
  
  // Calculate safe area padding for PWA and native app
  const needsSafeArea = isPWA || isNativeApp;
  const safeAreaTop = needsSafeArea ? 'env(safe-area-inset-top, 0px)' : '0px';
  const safeAreaBottom = needsSafeArea ? 'env(safe-area-inset-bottom, 0px)' : '0px';
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f1f5f9', 
      padding: isPWA ? '20px' : isDesktop ? '40px' : '20px',
      paddingTop: `calc(${isPWA ? '20px' : isDesktop ? '40px' : '20px'} + ${safeAreaTop})`,
      paddingBottom: `calc(${isPWA ? '20px' : isDesktop ? '40px' : '20px'} + ${safeAreaBottom})`,
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      WebkitOverflowScrolling: 'touch'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '28rem', 
        backgroundColor: 'white', 
        padding: (isPWA || isMobile) ? '20px' : isDesktop ? '32px' : '24px',
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        margin: 'auto'
      }}>
        
        {/* Logo and Title */}
        <div style={{ textAlign: 'center', marginBottom: (isPWA || isMobile) ? '24px' : '32px' }}>
          <Link 
            to={createPageUrl('Dashboard')}
            style={{ display: 'inline-block' }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <img 
                src="/logo.png" 
                alt="LECRM Logo" 
                style={{ height: (isPWA || isMobile) ? '56px' : isDesktop ? '72px' : '64px', width: 'auto' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <h1 style={{ fontSize: (isPWA || isMobile) ? '26px' : isDesktop ? '34px' : '30px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', cursor: 'pointer' }}>LECRM</h1>
          </Link>
          <p style={{ color: '#475569', fontSize: (isPWA || isMobile) ? '14px' : '16px' }}>Sign in to your account</p>
        </div>

        {/* Login Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0' }}>
          <div style={{ padding: '24px 24px 0 24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>Welcome back</h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              Enter your email and password to access your account
            </p>
          </div>
          <div style={{ padding: '0 24px 24px 24px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="email" style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>Email</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  inputMode="email"
                  style={{
                    padding: isMobile ? '12px 14px' : '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: isMobile ? '16px' : '14px',
                    width: '100%',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    color: '#0f172a',
                    backgroundColor: 'white'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="password" style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  style={{
                    padding: (isPWA || isMobile) ? '12px 14px' : '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: (isPWA || isMobile) ? '16px' : '14px', // 16px prevents iOS zoom
                    width: '100%',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    color: '#0f172a',
                    backgroundColor: 'white'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: (isPWA || isMobile) ? '14px 16px' : '10px 16px',
                  backgroundColor: isLoading ? '#94a3b8' : '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: (isPWA || isMobile) ? '16px' : '14px',
                  fontWeight: '500',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  minHeight: (isPWA || isMobile) ? '48px' : 'auto', // Better touch targets on mobile/PWA
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation'
                }}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            {/* Divider */}
            <div style={{ position: 'relative', margin: '24px 0', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
              <span style={{ padding: '0 12px', fontSize: '12px', textTransform: 'uppercase', color: '#64748b', backgroundColor: 'white' }}>Or continue with</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: (isPWA || isMobile) ? '14px 16px' : '10px 16px',
                backgroundColor: isLoading ? '#f1f5f9' : 'white',
                color: isLoading ? '#94a3b8' : '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: (isPWA || isMobile) ? '16px' : '14px',
                fontWeight: '500',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: (isPWA || isMobile) ? '48px' : 'auto', // Better touch targets
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

