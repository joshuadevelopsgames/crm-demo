/**
 * Shared email service for sending emails via Resend or SMTP
 * Used by bug reports, ticket notifications, etc.
 */

import nodemailer from 'nodemailer';

/**
 * Send email via Resend
 */
export async function sendViaResend(recipientEmail, subject, body, fromName = 'CRM') {
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    const errorMsg = 'Resend API key not configured (RESEND_API_KEY missing)';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const fromEmailRaw = process.env.RESEND_FROM_EMAIL;
    if (!fromEmailRaw) {
      const errorMsg = 'RESEND_FROM_EMAIL not configured. Please set a verified domain email in Vercel environment variables, or use EMAIL_SERVICE=smtp with Gmail SMTP settings. Example: noreply@yourdomain.com';
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    if (fromEmailRaw === 'onboarding@resend.dev') {
      console.warn('⚠️ Using onboarding@resend.dev - emails may go to spam. Consider verifying a domain or using SMTP.');
    }
    
    const fromEmail = fromEmailRaw.includes('<') ? fromEmailRaw : `${fromName} <${fromEmailRaw}>`;
    const replyTo = process.env.RESEND_REPLY_TO || fromEmailRaw;
    
    console.log(`📧 Sending email via Resend from ${fromEmail} to ${recipientEmail}`);
    
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
        headers: {
          'X-Entity-Ref-ID': `email-${Date.now()}`,
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
      const errorMsg = `Resend API error (${response.status}): ${errorDetails.message || JSON.stringify(errorDetails)}`;
      console.error('❌ Resend API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        fromEmail,
        recipientEmail
      });
      throw new Error(errorMsg);
    }

    let result;
    try {
      result = isJson ? await response.json() : { id: 'success' };
    } catch (e) {
      console.warn('⚠️ Could not parse Resend response as JSON, assuming success');
      result = { id: 'success' };
    }
    
    if (result.error) {
      const errorMsg = `Resend API returned error: ${result.error.message || JSON.stringify(result.error)}`;
      console.error('❌ Resend API returned error:', result.error);
      throw new Error(errorMsg);
    }
    
    console.log('✅ Email sent via Resend:', {
      id: result.id || 'success',
      fromEmail,
      recipientEmail
    });
    return true;
  } catch (error) {
    console.error('❌ Error sending via Resend:', error.message || error);
    throw error;
  }
}

/**
 * Send email via SMTP (Nodemailer)
 */
export async function sendViaSMTP(recipientEmail, subject, body, fromName = 'CRM') {
  if (!nodemailer) {
    const errorMsg = 'Nodemailer not available. Please ensure nodemailer is installed: npm install nodemailer';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
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
    const missing = [];
    if (!smtpConfig.host) missing.push('SMTP_HOST');
    if (!smtpConfig.auth.user) missing.push('SMTP_USER');
    if (!smtpConfig.auth.pass) missing.push('SMTP_PASS');
    const errorMsg = `SMTP configuration incomplete. Missing: ${missing.join(', ')}`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const fromEmail = process.env.SMTP_FROM || smtpConfig.auth.user;
    console.log(`📧 Sending email via SMTP from ${fromEmail} to ${recipientEmail}`, {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.auth.user
    });
    
    const transporter = nodemailer.createTransport(smtpConfig);

    await transporter.verify();
    console.log('✅ SMTP connection verified');

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
    let errorMsg = 'Unknown SMTP error';
    if (error.code === 'EAUTH') {
      errorMsg = 'SMTP authentication failed. Check SMTP_USER and SMTP_PASS (app password).';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMsg = `SMTP connection failed. Check SMTP_HOST (${smtpConfig.host}) and SMTP_PORT (${smtpConfig.port}).`;
    } else if (error.code === 'EENVELOPE') {
      errorMsg = 'SMTP envelope error. Check recipient email address.';
    } else if (error.message) {
      errorMsg = `SMTP error: ${error.message}`;
    }
    console.error('❌ Error sending via SMTP:', {
      code: error.code,
      message: error.message,
      response: error.response,
      responseCode: error.responseCode,
      command: error.command,
      error: errorMsg
    });
    throw new Error(errorMsg);
  }
}

/**
 * Send email using configured service (Resend or SMTP)
 */
export async function sendEmail(recipientEmail, subject, body, fromName = 'CRM') {
  const emailService = process.env.EMAIL_SERVICE || 'resend';
  
  try {
    if (emailService === 'resend') {
      return await sendViaResend(recipientEmail, subject, body, fromName);
    } else if (emailService === 'smtp') {
      return await sendViaSMTP(recipientEmail, subject, body, fromName);
    } else {
      // Fallback: Try Resend first, then SMTP
      try {
        return await sendViaResend(recipientEmail, subject, body, fromName);
      } catch (resendError) {
        console.warn('⚠️ Resend failed, trying SMTP:', resendError.message);
        return await sendViaSMTP(recipientEmail, subject, body, fromName);
      }
    }
  } catch (error) {
    console.error('❌ Error sending email:', error.message || error);
    throw error;
  }
}

/**
 * Convert plain text/markdown to HTML for better email formatting
 */
function convertToHtml(text) {
  if (!text) return '';
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const escapedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return `<pre style="background: #f4f4f4; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; border-left: 3px solid #3b82f6; margin: 15px 0;">${escapedCode}</pre>`;
  });
  
  html = html.replace(/`([^`\n]+)`/g, '<code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: \'Courier New\', monospace; font-size: 0.9em;">$1</code>');
  
  html = html.replace(/^### (.*$)/gim, '<h3 style="color: #1a1a1a; margin-top: 24px; margin-bottom: 12px; font-size: 18px; font-weight: 600;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="color: #1a1a1a; margin-top: 28px; margin-bottom: 14px; font-size: 22px; font-weight: 600;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="color: #1a1a1a; margin-top: 32px; margin-bottom: 16px; font-size: 26px; font-weight: 700;">$1</h1>');
  
  html = html.replace(/^- (.*$)/gim, '<li style="margin: 8px 0;">$1</li>');
  html = html.replace(/(<li.*<\/li>)/s, '<ul style="margin: 15px 0; padding-left: 25px;">$1</ul>');
  
  html = html.replace(/\n\n+/g, '</p><p style="margin: 12px 0;">');
  html = html.replace(/\n/g, '<br>');
  
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

