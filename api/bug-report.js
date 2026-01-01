/**
 * API endpoint for sending bug reports via email
 * Supports multiple email services: Resend, SendGrid, or SMTP via Nodemailer
 */

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://lecrm-dev.vercel.app',
    'https://lecrm-stg.vercel.app',
    'https://lecrm.vercel.app'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const bugReport = req.body;

    if (!bugReport || !bugReport.description) {
      return res.status(400).json({ 
        success: false,
        error: 'Bug report description is required' 
      });
    }

    // Get email configuration from environment variables
    const recipientEmail = process.env.BUG_REPORT_EMAIL || 'jrsschroeder@gmail.com';
    const emailService = process.env.EMAIL_SERVICE || 'resend'; // 'resend', 'sendgrid', or 'smtp'

    // Format the bug report email
    const emailSubject = `🐛 Bug Report - ${new Date().toLocaleString()}`;
    
    let emailBody = `
# Bug Report

## Description
${bugReport.description}

## Reporter Information
- Email: ${bugReport.userEmail || 'Not provided'}
- Timestamp: ${bugReport.userInfo?.timestamp || new Date().toISOString()}
- URL: ${bugReport.userInfo?.url || 'Unknown'}
- User Agent: ${bugReport.userInfo?.userAgent || 'Unknown'}
- Viewport: ${bugReport.userInfo?.viewport?.width || 'Unknown'}x${bugReport.userInfo?.viewport?.height || 'Unknown'}

`;

    // Add selected element information
    if (bugReport.selectedElement) {
      emailBody += `
## Selected Element
- Tag: ${bugReport.selectedElement.tagName}
- ID: ${bugReport.selectedElement.id || 'None'}
- Class: ${bugReport.selectedElement.className || 'None'}
- XPath: ${bugReport.selectedElement.xpath || 'N/A'}
- Text Content: ${bugReport.selectedElement.textContent?.substring(0, 200) || 'None'}

### Element Details
\`\`\`json
${JSON.stringify(bugReport.selectedElement, null, 2)}
\`\`\`

`;
    }

    // Add console logs
    if (bugReport.consoleLogs && bugReport.consoleLogs.length > 0) {
      emailBody += `
## Console Logs (${bugReport.consoleLogs.length} entries)

\`\`\`
${bugReport.consoleLogs.map(log => 
  `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`
).join('\n')}
\`\`\`

`;
    }

    // Send email based on configured service
    let emailSent = false;

    if (emailService === 'resend') {
      emailSent = await sendViaResend(recipientEmail, emailSubject, emailBody);
    } else if (emailService === 'sendgrid') {
      emailSent = await sendViaSendGrid(recipientEmail, emailSubject, emailBody);
    } else if (emailService === 'smtp') {
      emailSent = await sendViaSMTP(recipientEmail, emailSubject, emailBody);
    } else {
      // Fallback: Try Resend first, then SMTP
      emailSent = await sendViaResend(recipientEmail, emailSubject, emailBody) ||
                  await sendViaSMTP(recipientEmail, emailSubject, emailBody);
    }

    if (!emailSent) {
      console.error('Failed to send email via any configured service');
      return res.status(500).json({ 
        success: false,
        error: 'Failed to send bug report email. Please check email service configuration.' 
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Bug report sent successfully' 
    });

  } catch (error) {
    console.error('Error processing bug report:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Internal server error' 
    });
  }
}

// Send email via Resend
async function sendViaResend(recipientEmail, subject, body) {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.log('Resend API key not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: recipientEmail,
        subject: subject,
        html: body.replace(/\n/g, '<br>').replace(/```/g, '<pre>').replace(/```/g, '</pre>'),
        text: body,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', error);
      return false;
    }

    console.log('Email sent via Resend');
    return true;
  } catch (error) {
    console.error('Error sending via Resend:', error);
    return false;
  }
}

// Send email via SendGrid
async function sendViaSendGrid(recipientEmail, subject, body) {
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  
  if (!sendGridApiKey) {
    console.log('SendGrid API key not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: recipientEmail }],
        }],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
        },
        subject: subject,
        content: [
          {
            type: 'text/plain',
            value: body,
          },
          {
            type: 'text/html',
            value: body.replace(/\n/g, '<br>').replace(/```/g, '<pre>').replace(/```/g, '</pre>'),
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('SendGrid API error:', error);
      return false;
    }

    console.log('Email sent via SendGrid');
    return true;
  } catch (error) {
    console.error('Error sending via SendGrid:', error);
    return false;
  }
}

// Send email via SMTP (Nodemailer)
async function sendViaSMTP(recipientEmail, subject, body) {
  // Check if nodemailer is available
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (e) {
    console.log('Nodemailer not installed');
    return false;
  }

  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
    console.log('SMTP configuration incomplete');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport(smtpConfig);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpConfig.auth.user,
      to: recipientEmail,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>').replace(/```/g, '<pre>').replace(/```/g, '</pre>'),
    });

    console.log('Email sent via SMTP');
    return true;
  } catch (error) {
    console.error('Error sending via SMTP:', error);
    return false;
  }
}

