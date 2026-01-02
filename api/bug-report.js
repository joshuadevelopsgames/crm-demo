/**
 * API endpoint for sending bug reports via email
 * Supports multiple email services: Resend, SendGrid, or SMTP via Nodemailer
 * Also creates a notification for the admin user
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL environment variable not set');
    return null;
  }
  
  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    return null;
  }
  
  console.log('✅ Supabase client initialized with URL:', supabaseUrl.substring(0, 30) + '...');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

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
    
    let emailBody = `# Bug Report

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

    // Send email based on configured service (non-blocking - notification will still be created)
    let emailSent = false;
    let emailError = null;

    try {
      console.log(`📧 Attempting to send email via ${emailService} to ${recipientEmail}`);
      
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

      if (emailSent) {
        console.log('✅ Email sent successfully');
      } else {
        emailError = `Failed to send email via ${emailService}. Check logs for details.`;
        console.error('❌', emailError);
        console.error('❌ Email service configuration:', {
          service: emailService,
          hasResendKey: !!process.env.RESEND_API_KEY,
          hasResendFrom: !!process.env.RESEND_FROM_EMAIL,
          recipientEmail
        });
      }
    } catch (error) {
      emailError = error.message || 'Unknown error occurred';
      console.error('❌ Error sending email:', error);
      console.error('❌ Error stack:', error.stack);
    }

    // Create notification for admin user (jrsschroeder@gmail.com)
    // This should ALWAYS happen, even if email fails
    let notificationCreated = false;
    let notificationError = null;

    try {
      console.log('🔔 Attempting to create notification for bug report');
      const supabase = getSupabase();
      
      if (!supabase) {
        notificationError = 'Supabase not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)';
        console.error('❌', notificationError);
      } else {
        console.log('✅ Supabase client initialized');
        
        // Find user by email
        console.log('🔍 Looking up user: jrsschroeder@gmail.com');
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', 'jrsschroeder@gmail.com')
          .single();

        if (profileError) {
          notificationError = `Profile lookup error: ${profileError.message}`;
          console.error('❌', notificationError, profileError);
        } else if (!profile) {
          notificationError = 'User jrsschroeder@gmail.com not found in profiles table';
          console.error('❌', notificationError);
        } else {
          console.log(`✅ Found user profile: ${profile.id} (${profile.email})`);
          
          // Create notification
          const notificationTitle = '🐛 New Bug Report';
          const notificationMessage = bugReport.description.length > 100 
            ? bugReport.description.substring(0, 100) + '...'
            : bugReport.description;

          console.log('📝 Creating notification:', {
            user_id: profile.id,
            type: 'bug_report',
            title: notificationTitle,
            message: notificationMessage.substring(0, 50) + '...'
          });

          const { data: notificationData, error: notificationInsertError } = await supabase
            .from('notifications')
            .insert({
              user_id: profile.id,
              type: 'bug_report',
              title: notificationTitle,
              message: notificationMessage,
              is_read: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (notificationInsertError) {
            notificationError = `Notification insert error: ${notificationInsertError.message}`;
            console.error('❌', notificationError, notificationInsertError);
          } else {
            notificationCreated = true;
            console.log('✅ Notification created successfully:', notificationData?.id);
          }
        }
      }
    } catch (error) {
      notificationError = `Exception creating notification: ${error.message}`;
      console.error('❌', notificationError, error);
    }

    // Return success if either email or notification succeeded
    // Log warnings if one failed
    if (!emailSent && !notificationCreated) {
      console.error('❌ CRITICAL: Both email and notification failed:', {
        emailError,
        notificationError,
        emailService,
        recipientEmail,
        envCheck: {
          hasResendKey: !!process.env.RESEND_API_KEY,
          hasResendFrom: !!process.env.RESEND_FROM_EMAIL,
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      });
      return res.status(500).json({ 
        success: false,
        error: 'Failed to send bug report. Email and notification creation both failed.',
        details: {
          emailError,
          notificationError,
          emailService,
          recipientEmail
        }
      });
    }

    // Return success with warnings if one method failed
    const warnings = [];
    if (!emailSent) {
      warnings.push('Email could not be sent (check email service configuration)');
    }
    if (!notificationCreated) {
      warnings.push('Notification could not be created (check Supabase configuration)');
    }

    const responseData = { 
      success: true,
      message: 'Bug report processed successfully',
      emailSent,
      notificationCreated
    };
    
    if (warnings.length > 0) {
      responseData.warnings = warnings;
      console.warn('⚠️ Bug report sent with warnings:', warnings);
    }
    
    console.log('✅ Bug report processed:', {
      emailSent,
      notificationCreated,
      recipientEmail,
      emailService
    });
    
    return res.status(200).json(responseData);

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
    console.error('❌ Resend API key not configured (RESEND_API_KEY missing)');
    return false;
  }

  try {
    // Use verified domain email (not onboarding@resend.dev which goes to spam)
    // Format: "Name <email@domain.com>" or just "email@domain.com"
    const fromEmailRaw = process.env.RESEND_FROM_EMAIL;
    if (!fromEmailRaw || fromEmailRaw === 'onboarding@resend.dev') {
      console.error('❌ RESEND_FROM_EMAIL not configured or using default. Please set a verified domain email in Vercel environment variables.');
      console.error('   Example: noreply@yourdomain.com or "Your App Name <noreply@yourdomain.com>"');
      return false;
    }
    
    // Format from email properly
    const fromEmail = fromEmailRaw.includes('<') ? fromEmailRaw : `LECRM Bug Reports <${fromEmailRaw}>`;
    const replyTo = process.env.RESEND_REPLY_TO || fromEmailRaw;
    
    console.log(`📧 Sending email via Resend from ${fromEmail} to ${recipientEmail}`);
    
    // Convert markdown-style body to proper HTML
    const htmlBody = convertToHtml(body);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipientEmail,
        reply_to: replyTo,
        subject: subject,
        html: htmlBody,
        text: body,
        // Add headers to improve deliverability
        headers: {
          'X-Entity-Ref-ID': `bug-report-${Date.now()}`,
        },
      }),
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = isJson ? JSON.parse(errorText) : { message: errorText };
      } catch (e) {
        errorDetails = { message: errorText };
      }
      console.error('❌ Resend API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        fromEmail,
        recipientEmail
      });
      return false;
    }

    let result;
    try {
      result = isJson ? await response.json() : { id: 'success' };
    } catch (e) {
      console.warn('⚠️ Could not parse Resend response as JSON, assuming success');
      result = { id: 'success' };
    }
    
    if (result.error) {
      console.error('❌ Resend API returned error:', result.error);
      return false;
    }
    
    console.log('✅ Email sent via Resend:', {
      id: result.id || 'success',
      fromEmail,
      recipientEmail
    });
    return true;
  } catch (error) {
    console.error('❌ Error sending via Resend:', error.message || error);
    return false;
  }
}

// Send email via SendGrid
async function sendViaSendGrid(recipientEmail, subject, body) {
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  
  if (!sendGridApiKey) {
    console.error('❌ SendGrid API key not configured (SENDGRID_API_KEY missing)');
    return false;
  }

  try {
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
    console.log(`📧 Sending email via SendGrid from ${fromEmail} to ${recipientEmail}`);
    
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
          email: fromEmail,
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
      const errorText = await response.text();
      console.error('❌ SendGrid API error:', response.status, errorText);
      return false;
    }

    console.log('✅ Email sent via SendGrid');
    return true;
  } catch (error) {
    console.error('❌ Error sending via SendGrid:', error.message || error);
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
    console.error('❌ Nodemailer not installed');
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
    console.error('❌ SMTP configuration incomplete. Missing:', {
      host: !smtpConfig.host ? 'SMTP_HOST' : null,
      user: !smtpConfig.auth.user ? 'SMTP_USER' : null,
      pass: !smtpConfig.auth.pass ? 'SMTP_PASS' : null
    });
    return false;
  }

  try {
    const fromEmail = process.env.SMTP_FROM || smtpConfig.auth.user;
    console.log(`📧 Sending email via SMTP from ${fromEmail} to ${recipientEmail}`);
    
    const transporter = nodemailer.createTransport(smtpConfig);

    const info = await transporter.sendMail({
      from: fromEmail,
      to: recipientEmail,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>').replace(/```/g, '<pre>').replace(/```/g, '</pre>'),
    });

    console.log('✅ Email sent via SMTP:', info.messageId || 'success');
    return true;
  } catch (error) {
    console.error('❌ Error sending via SMTP:', error.message || error);
    return false;
  }
}

// Convert plain text/markdown to HTML for better email formatting
function convertToHtml(text) {
  if (!text) return '';
  
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Convert code blocks (do this before other replacements)
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const escapedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return `<pre style="background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; border-left: 3px solid #3b82f6; margin: 15px 0;">${escapedCode}</pre>`;
  });
  
  // Convert inline code
  html = html.replace(/`([^`\n]+)`/g, '<code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: \'Courier New\', monospace; font-size: 0.9em;">$1</code>');
  
  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #1a1a1a; margin-top: 24px; margin-bottom: 12px; font-size: 18px; font-weight: 600;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="color: #1a1a1a; margin-top: 28px; margin-bottom: 14px; font-size: 22px; font-weight: 600;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="color: #1a1a1a; margin-top: 32px; margin-bottom: 16px; font-size: 26px; font-weight: 700;">$1</h1>');
  
  // Convert bullet points
  html = html.replace(/^- (.*$)/gim, '<li style="margin: 8px 0;">$1</li>');
  html = html.replace(/(<li.*<\/li>)/s, '<ul style="margin: 15px 0; padding-left: 25px;">$1</ul>');
  
  // Convert line breaks
  html = html.replace(/\n\n+/g, '</p><p style="margin: 12px 0;">');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in proper HTML structure
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
    }
    h1, h2, h3 {
      color: #1a1a1a;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    p {
      margin: 10px 0;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      border-left: 3px solid #3b82f6;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 2px;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <p style="margin: 12px 0;">${html}</p>
</body>
</html>`.trim();
}

