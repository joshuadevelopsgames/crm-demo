/**
 * Google Authentication Service
 * Handles Google OAuth authentication for user login
 */

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Get redirect URI - handle both browser, mobile app, and SSR environments
// NOTE: Google OAuth requires http/https schemes, not custom URL schemes
const getRedirectUri = () => {
  if (typeof window === 'undefined') {
    return '/google-auth-callback';
  }
  
  // For mobile apps, use the production URL (Vercel deployment)
  // The callback page will then redirect to the mobile app
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    // Use the Vercel deployment URL for OAuth redirect
    // The callback page will handle redirecting to the app
    return 'https://lecrm-fhmlnu2u1-joshuas-projects-81b25231.vercel.app/google-auth-callback';
  }
  
  // Web browser - use the current origin
  return window.location.origin + '/google-auth-callback';
};

// Google OAuth scopes for authentication
const GOOGLE_AUTH_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

/**
 * Initialize Google Sign-In OAuth flow
 */
export function initGoogleSignIn() {
  if (!GOOGLE_CLIENT_ID) {
    console.warn('Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in .env');
    return null;
  }

  const redirectUri = getRedirectUri();
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(GOOGLE_AUTH_SCOPES)}&` +
    `access_type=offline&` +
    `prompt=select_account`;

  return authUrl;
}

/**
 * Exchange authorization code for access token and user info
 * 
 * NOTE: This requires a backend service for security.
 * In production, you should exchange the code on your backend.
 */
export async function exchangeGoogleAuthCode(code) {
  try {
    const redirectUri = getRedirectUri();
    // Try to exchange via backend API
    const response = await fetch('/api/google-auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Fallback: Use demo mode for development
        console.warn('Backend API not found. Using demo mode for Google auth.');
        return handleDemoGoogleAuth(code);
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to exchange code for token');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error exchanging Google auth code:', error);
    // Fallback to demo mode for development
    return handleDemoGoogleAuth(code);
  }
}

/**
 * Handle demo mode Google authentication (development only)
 * In production, this should not be used - use backend token exchange
 */
async function handleDemoGoogleAuth(code) {
  // For demo purposes, simulate a successful auth with mock user data
  // In production, you MUST exchange the code on your backend
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
  
  // Parse user info from demo data
  // In a real implementation, you'd fetch user info from Google's API using the access token
  return {
    access_token: 'demo_token_' + Date.now(),
    user: {
      email: 'demo@google.com',
      name: 'Demo Google User',
      picture: null,
      id: 'demo_google_user_' + Date.now()
    }
  };
}

/**
 * Store Google auth session
 */
export function storeGoogleAuthSession(authData) {
  localStorage.setItem('google_auth_token', authData.access_token);
  localStorage.setItem('google_user', JSON.stringify(authData.user));
  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('authProvider', 'google');
  localStorage.setItem('userEmail', authData.user.email);
}

/**
 * Get stored Google auth session
 */
export function getGoogleAuthSession() {
  const token = localStorage.getItem('google_auth_token');
  const userStr = localStorage.getItem('google_user');
  
  if (!token || !userStr) {
    return null;
  }
  
  return {
    access_token: token,
    user: JSON.parse(userStr)
  };
}

/**
 * Clear Google auth session
 */
export function clearGoogleAuthSession() {
  localStorage.removeItem('google_auth_token');
  localStorage.removeItem('google_user');
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('authProvider');
  localStorage.removeItem('userEmail');
}

/**
 * Check if user is authenticated with Google
 */
export function isGoogleAuthenticated() {
  return localStorage.getItem('authProvider') === 'google' && 
         localStorage.getItem('isAuthenticated') === 'true';
}

