/**
 * Vercel Serverless Function
 * Exchanges Google OAuth authorization code for access token
 */

// Vercel Serverless Function handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, redirect_uri } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!CLIENT_ID) {
      return res.status(500).json({ error: 'Google Client ID not configured' });
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET || '',
        redirect_uri: redirect_uri || '',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange error:', errorData);
      return res.status(tokenResponse.status).json({
        error: 'Failed to exchange code for token',
        details: errorData,
      });
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Google
    let userInfo = null;
    if (tokenData.access_token) {
      try {
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        if (userResponse.ok) {
          userInfo = await userResponse.json();
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
        // Continue even if user info fetch fails
      }
    }

    // Return token data with user info
    return res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      user: userInfo ? {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        id: userInfo.id,
      } : null,
    });
  } catch (error) {
    console.error('Error in token exchange:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

