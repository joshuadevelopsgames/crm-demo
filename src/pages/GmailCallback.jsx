import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { exchangeCodeForToken, storeGmailToken } from '../services/gmailService';

export default function GmailCallback() {
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
        ? 'Gmail access was denied. Please try again and grant access.'
        : 'An error occurred during Gmail authorization.'
      );
      return;
    }

    if (!code) {
      setStatus('error');
      setError('No authorization code received from Gmail.');
      return;
    }

    // Exchange code for token
    exchangeCodeForToken(code)
      .then((tokenData) => {
        storeGmailToken(tokenData);
        setStatus('success');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      })
      .catch((err) => {
        console.error('Error exchanging code for token:', err);
        setStatus('error');
        setError(err.message || 'Failed to connect Gmail. Please try again.');
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Connecting Gmail...</h2>
              <p className="text-slate-600">Please wait while we connect your Gmail account.</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Gmail Connected!</h2>
              <p className="text-slate-600 mb-4">
                Your Gmail account has been successfully connected. You can now sync emails with your CRM.
              </p>
              <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Connection Failed</h2>
              <p className="text-slate-600 mb-4">{error}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Return to Dashboard
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


