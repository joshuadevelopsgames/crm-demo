import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { exchangeGoogleAuthCode, storeGoogleAuthSession } from '../services/googleAuthService';

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

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
        
        // Redirect to dashboard after 1.5 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      })
      .catch((err) => {
        console.error('Error exchanging Google auth code:', err);
        setStatus('error');
        setError(err.message || 'Failed to authenticate with Google. Please try again.');
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
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

