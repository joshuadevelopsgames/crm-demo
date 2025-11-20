import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { exchangeGoogleAuthCode, storeGoogleAuthSession } from '../services/googleAuthService';
import { Capacitor } from '@capacitor/core';

// App plugin is optional - import dynamically if available
let App = null;
if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
  try {
    App = require('@capacitor/app').App;
  } catch (e) {
    console.log('App plugin not installed, deep linking may not work');
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
    // Handle deep links from mobile app (custom URL scheme)
    let code = searchParams.get('code');
    let errorParam = searchParams.get('error');
    
    // If no code in search params, try to extract from URL hash or full path (mobile app handling)
    if (!code && !errorParam && isMobile) {
      const url = new URL(window.location.href);
      code = url.searchParams.get('code') || url.hash.split('code=')[1]?.split('&')[0];
      errorParam = url.searchParams.get('error') || url.hash.split('error=')[1]?.split('&')[0];
    }

    if (errorParam) {
      setStatus('error');
      setError(errorParam === 'access_denied' 
        ? 'Google sign-in was cancelled. Please try again.'
        : 'An error occurred during Google authentication.'
      );
      return;
    }

    if (!code) {
      setStatus('error');
      setError('No authorization code received from Google.');
      return;
    }

    // Exchange code for token and user info
    exchangeGoogleAuthCode(code)
      .then((authData) => {
        storeGoogleAuthSession(authData);
        setStatus('success');
        
        // If in mobile app, redirect to app scheme, otherwise navigate to dashboard
        if (isMobile) {
          // Redirect to mobile app using custom scheme
          setTimeout(() => {
            window.location.href = 'com.lecrm.app://dashboard';
          }, 1000);
        } else {
          // Redirect to dashboard after 1.5 seconds
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
        }
      })
      .catch((err) => {
        console.error('Error exchanging Google auth code:', err);
        setStatus('error');
        setError(err.message || 'Failed to authenticate with Google. Please try again.');
      });
  }, [searchParams, navigate, location, isMobile]);

  // Listen for app URL open events (mobile deep linking)
  useEffect(() => {
    if (isMobile && App && typeof App.addListener === 'function') {
      const handleAppUrl = async (event) => {
        const url = new URL(event.url);
        const code = url.searchParams.get('code');
        const errorParam = url.searchParams.get('error');
        
        if (code || errorParam) {
          // Handle the OAuth callback
          if (errorParam) {
            setStatus('error');
            setError(errorParam === 'access_denied' 
              ? 'Google sign-in was cancelled. Please try again.'
              : 'An error occurred during Google authentication.'
            );
          } else if (code) {
            try {
              const authData = await exchangeGoogleAuthCode(code);
              storeGoogleAuthSession(authData);
              setStatus('success');
              // Redirect to app dashboard
              setTimeout(() => {
                window.location.href = 'com.lecrm.app://dashboard';
              }, 1000);
            } catch (err) {
              console.error('Error exchanging Google auth code:', err);
              setStatus('error');
              setError(err.message || 'Failed to authenticate with Google. Please try again.');
            }
          }
        }
      };
      
      App.addListener('appUrlOpen', handleAppUrl);
      
      return () => {
        App.removeListener('appUrlOpen', handleAppUrl);
      };
    }
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

