/**
 * Vercel Serverless Function
 * Proxies write requests to Google Apps Script Web App
 * Keeps the secret token secure on the server side
 */

export default async function handler(req, res) {
  // Set CORS headers - restrict to your domains
  const allowedOrigins = [
    'https://lecrm.vercel.app',
    'https://lecrm-stg.vercel.app',
    'https://lecrm-dev.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
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
    const { entityType, records } = req.body;

    // Validate request
    if (!entityType || !records || !Array.isArray(records)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid request format. entityType and records array required.' 
      });
    }

    // Get configuration from server-side environment variables
    // These are NOT exposed to the browser!
    const WEB_APP_URL = process.env.GOOGLE_SHEETS_WEB_APP_URL;
    const SECRET_TOKEN = process.env.GOOGLE_SHEETS_SECRET_TOKEN;

    if (!WEB_APP_URL) {
      console.error('GOOGLE_SHEETS_WEB_APP_URL not configured');
      return res.status(500).json({ 
        success: false,
        error: 'Google Sheets Web App URL not configured on server' 
      });
    }

    if (!SECRET_TOKEN) {
      console.error('GOOGLE_SHEETS_SECRET_TOKEN not configured');
      return res.status(500).json({ 
        success: false,
        error: 'Google Sheets secret token not configured on server' 
      });
    }

    // Prepare payload with secret token (never exposed to browser)
    const payload = {
      action: 'upsert',
      entityType: entityType,
      records: records,
      token: SECRET_TOKEN // Added server-side, never sent from browser
    };

    console.log(`📤 Proxying ${records.length} ${entityType} records to Google Sheets...`);

    // Forward request to Google Apps Script
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      redirect: 'follow',
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Google Apps Script error:`, errorText);
      
      // Check for authentication errors
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && errorData.error.includes('Unauthorized')) {
          return res.status(401).json({
            success: false,
            error: 'Authentication failed: Invalid secret token configured on server'
          });
        }
      } catch (e) {
        // Not JSON, use original error
      }
      
      return res.status(response.status).json({
        success: false,
        error: `Google Apps Script error: ${errorText.substring(0, 200)}`
      });
    }

    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Successfully wrote ${result.result.total} ${entityType} to Google Sheet`);
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Request timeout');
      return res.status(504).json({
        success: false,
        error: 'Request timeout - Google Apps Script may be processing a large batch. Try importing in smaller chunks.'
      });
    }
    
    console.error('❌ Error proxying to Google Sheets:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}


