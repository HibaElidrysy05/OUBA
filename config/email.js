const nodemailer = require('nodemailer');
const https = require('https');

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ouba.app';

  if (apiKey && apiKey.startsWith('SG.')) {
    return sendViaSendGridAPI(apiKey, from, to, subject, html);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    family: 4,
    connectionTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: process.env.SMTP_USER || 'apikey',
      pass: apiKey
    }
  });
  return transporter.sendMail({ from, to, subject, html });
}

function sendViaSendGridAPI(apiKey, from, to, subject, html) {
  const data = JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from },
    subject,
    content: [{ type: 'text/html', value: html }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.sendgrid.com',
      port: 443,
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 202 || res.statusCode === 200) resolve();
        else reject(new Error('SendGrid API ' + res.statusCode + ': ' + body));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = sendEmail;
