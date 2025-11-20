import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import toast, { Toaster } from 'react-hot-toast';
import { createPageUrl } from '../utils';
import { initGoogleSignIn } from '../services/googleAuthService';
import { Capacitor } from '@capacitor/core';

// Browser plugin is optional - import dynamically if available
let Browser = null;
if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
  try {
    Browser = require('@capacitor/browser').Browser;
  } catch (e) {
    console.log('Browser plugin not installed, using window.location for OAuth');
  }
}

export default function Login() {
  console.log('✅ Login component is rendering!');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    console.log('✅ Login component mounted');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // For now, just simulate login - replace with actual auth logic
      // In a real app, you'd call: await base44.auth.login(email, password);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Store auth state (in a real app, this would be handled by base44)
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', email);
      localStorage.setItem('authProvider', 'email');
      
      toast.success('Successfully logged in!');
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      toast.error('Login failed. Please check your credentials.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      if (!initGoogleSignIn) {
        toast.error('Google Sign-In is not available.');
        setIsGoogleLoading(false);
        return;
      }
      
      const authUrl = initGoogleSignIn();
      if (!authUrl) {
        toast.error('Google Sign-In is not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file.');
        setIsGoogleLoading(false);
        return;
      }
      
      // In mobile app, use Capacitor Browser plugin to open OAuth in external browser
      // This is required because Google OAuth needs to happen in a real browser
      // The Browser plugin will open Safari/Chrome, complete OAuth, then redirect back
      if (Capacitor.isNativePlatform() && Browser) {
        try {
          // Open in external browser - after OAuth completes, callback page will redirect to app
          await Browser.open({ 
            url: authUrl,
            windowName: '_self'
          });
        } catch (error) {
          console.log('Browser.open failed, falling back to window.location:', error);
          // Fallback: try to open in webview (may not work for OAuth)
          window.location.href = authUrl;
        }
      } else {
        // Web browser - direct redirect
        window.location.href = authUrl;
      }
    } catch (error) {
      toast.error('Failed to initialize Google Sign-In.');
      console.error('Google Sign-In error:', error);
      setIsGoogleLoading(false);
    }
  };

  const isMobile = Capacitor.isNativePlatform();
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
      <div style={{ 
        width: '100%', 
        maxWidth: '28rem', 
        backgroundColor: 'white', 
        padding: isMobile ? '20px' : '24px', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        margin: 'auto'
      }}>
        <Toaster position="top-center" />
        
        {/* Logo and Title */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
          <Link 
            to={createPageUrl('Dashboard')}
            style={{ display: 'inline-block' }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <img 
                src="/logo.png" 
                alt="LECRM Logo" 
                style={{ height: isMobile ? '56px' : '64px', width: 'auto' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <h1 style={{ fontSize: isMobile ? '26px' : '30px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', cursor: 'pointer' }}>LECRM</h1>
          </Link>
          <p style={{ color: '#475569', fontSize: isMobile ? '14px' : '16px' }}>Sign in to your account</p>
        </div>

        {/* Login Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0' }}>
          <div style={{ padding: '24px 24px 0 24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Welcome back</h2>
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
                    appearance: 'none'
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
                    padding: isMobile ? '12px 14px' : '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: isMobile ? '16px' : '14px',
                    width: '100%',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    appearance: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                style={{
                  width: '100%',
                  padding: isMobile ? '14px 16px' : '10px 16px',
                  backgroundColor: isLoading || isGoogleLoading ? '#94a3b8' : '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  cursor: isLoading || isGoogleLoading ? 'not-allowed' : 'pointer',
                  minHeight: isMobile ? '48px' : 'auto',
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
              disabled={isLoading || isGoogleLoading}
              style={{
                width: '100%',
                padding: isMobile ? '14px 16px' : '10px 16px',
                backgroundColor: isLoading || isGoogleLoading ? '#f1f5f9' : 'white',
                color: isLoading || isGoogleLoading ? '#94a3b8' : '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                cursor: isLoading || isGoogleLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: isMobile ? '48px' : 'auto',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
              }}
            >
              {isGoogleLoading ? (
                'Connecting...'
              ) : (
                <>
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
                </>
              )}
            </button>

            {/* Demo credentials hint */}
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '12px', color: '#475569', textAlign: 'center', margin: 0 }}>
                <strong>Demo Mode:</strong> Any email and password will work for testing
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

