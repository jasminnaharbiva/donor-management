import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Transporter Factory — uses SMTP if configured, else falls back to
// a local sendmail / "ethereal" test account so emails don't silently vanish
// ---------------------------------------------------------------------------
let _transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (_transporter) return _transporter;

  if (config.email.user && config.email.host !== 'localhost') {
    // Production SMTP
    _transporter = nodemailer.createTransport({
      host:   config.email.host,
      port:   config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  } else {
    // Development fallback — use Ethereal so we don't need a real SMTP server
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    logger.info(`[Email] Using Ethereal test account: ${testAccount.user}`);
    logger.info(`[Email] Preview at: https://ethereal.email`);
  }

  return _transporter;
}

// ---------------------------------------------------------------------------
// Core send helper
// ---------------------------------------------------------------------------
interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: `"${config.email.fromName}" <${config.email.fromAddress}>`,
      ...opts,
    });
    logger.info(`[Email] Sent to ${opts.to}: ${info.messageId}`);
    // Log preview URL if using Ethereal
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) logger.info(`[Email] Preview: ${preview}`);
  } catch (err) {
    logger.error(`[Email] Failed to send to ${opts.to}:`, err);
    // Do NOT throw — email failure should never crash the main request
  }
}

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

/** Sent immediately after a successful donation */
export async function sendDonationReceipt(opts: {
  toEmail: string;
  firstName: string;
  amount: number;
  currency: string;
  transactionId: string;
  campaignName?: string;
  fundName?: string;
  date: Date;
}): Promise<void> {
  const { toEmail, firstName, amount, currency, transactionId, campaignName, fundName, date } = opts;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2,
  }).format(amount);

  await sendEmail({
    to: toEmail,
    subject: `✅ Donation Receipt — ${formattedAmount} — DFB Foundation`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px; text-align: center; color: white; }
  .header h1 { margin: 0 0 4px; font-size: 22px; }
  .header p { margin: 0; opacity: 0.85; font-size: 14px; }
  .body { padding: 32px; }
  .amount-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
  .amount-box .amount { font-size: 36px; font-weight: 700; color: #1d4ed8; }
  .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
  .detail-row:last-child { border-bottom: none; }
  .detail-label { color: #64748b; }
  .detail-value { font-weight: 600; color: #0f172a; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
  .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <h1>❤️ Thank You, ${firstName}!</h1>
      <p>Your donation has been successfully processed</p>
    </div>
    <div class="body">
      <div class="amount-box">
        <div style="font-size:13px;color:#64748b;margin-bottom:6px;">DONATION AMOUNT</div>
        <div class="amount">${formattedAmount}</div>
        <div style="font-size:13px;color:#64748b;margin-top:4px;">${currency}</div>
      </div>

      <div style="margin-top:24px;">
        <div class="detail-row"><span class="detail-label">Transaction ID</span><span class="detail-value">${transactionId}</span></div>
        ${campaignName ? `<div class="detail-row"><span class="detail-label">Campaign</span><span class="detail-value">${campaignName}</span></div>` : ''}
        ${fundName ? `<div class="detail-row"><span class="detail-label">Fund</span><span class="detail-value">${fundName}</span></div>` : ''}
        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value" style="color:#16a34a;">✓ Confirmed</span></div>
      </div>

      <div style="text-align:center;margin-top:28px;">
        <a href="${config.appUrl}/donor" class="btn">View Impact Dashboard →</a>
      </div>

      <p style="font-size:13px;color:#64748b;margin-top:20px;">
        This is your official donation receipt. Please keep it for your records.
        Your generous contribution makes a real difference in the lives of those we serve.
      </p>
    </div>
    <div class="footer">
      <p>© 2026 DFB Foundation · All rights reserved</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

/** Sent when a new user registers */
export async function sendWelcomeEmail(opts: {
  toEmail: string;
  firstName: string;
  role: string;
}): Promise<void> {
  const { toEmail, firstName, role } = opts;
  const dashboardUrl = role === 'Volunteer'
    ? `${config.appUrl}/volunteer`
    : `${config.appUrl}/donor`;

  await sendEmail({
    to: toEmail,
    subject: `Welcome to DFB Foundation, ${firstName}! 🎉`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #059669, #047857); padding: 32px; text-align: center; color: white; }
  .body { padding: 32px; }
  .btn { display: inline-block; background: #059669; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin:0 0 4px;font-size:22px;">Welcome, ${firstName}! 🎉</h1>
      <p style="margin:0;opacity:.85;font-size:14px;">Your DFB account is ready</p>
    </div>
    <div class="body">
      <p>Thank you for joining the DFB Foundation as a <strong>${role}</strong>.</p>
      <p>Your account is now active. You can log in and access your personalized dashboard to:</p>
      <ul style="color:#374151;line-height:1.8;">
        ${role === 'Volunteer'
          ? '<li>View your assigned projects and shifts</li><li>Submit expense receipts</li><li>Log volunteer hours</li>'
          : '<li>Make secure donations</li><li>Track your impact in real-time</li><li>View where every cent was spent</li>'}
      </ul>
      <div style="text-align:center;margin-top:24px;">
        <a href="${dashboardUrl}" class="btn">Go to My Dashboard →</a>
      </div>
    </div>
    <div class="footer">
      <p>© 2026 DFB Foundation</p>
    </div>
  </div>
</body>
</html>`,
  });
}

/** Sent to volunteer when their expense is approved */
export async function sendExpenseApproved(opts: {
  toEmail: string;
  firstName: string;
  amount: number;
  purpose: string;
  expenseId: string;
}): Promise<void> {
  const { toEmail, firstName, amount, purpose, expenseId } = opts;
  await sendEmail({
    to: toEmail,
    subject: `✅ Expense Approved — $${amount.toFixed(2)} — DFB Foundation`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #16a34a, #15803d); padding: 32px; text-align: center; color: white; }
  .body { padding: 32px; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin:0 0 4px;font-size:22px;">✅ Expense Approved!</h1>
    </div>
    <div class="body">
      <p>Hi ${firstName},</p>
      <p>Your expense submission has been <strong style="color:#16a34a;">approved</strong> by the admin.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:10px;background:#f8fafc;color:#64748b;font-size:13px;">Amount</td><td style="padding:10px;font-weight:600;">$${amount.toFixed(2)}</td></tr>
        <tr><td style="padding:10px;background:#f8fafc;color:#64748b;font-size:13px;">Purpose</td><td style="padding:10px;font-weight:600;">${purpose}</td></tr>
        <tr><td style="padding:10px;background:#f8fafc;color:#64748b;font-size:13px;">Expense ID</td><td style="padding:10px;font-weight:600;">${expenseId}</td></tr>
      </table>
      <p style="font-size:13px;color:#64748b;">The amount has been deducted from the fund balance. Thank you for your service!</p>
    </div>
    <div class="footer"><p>© 2026 DFB Foundation</p></div>
  </div>
</body>
</html>`,
  });
}

/** Sent to volunteer when their expense is rejected */
export async function sendExpenseRejected(opts: {
  toEmail: string;
  firstName: string;
  amount: number;
  purpose: string;
  reason: string;
  expenseId: string;
}): Promise<void> {
  const { toEmail, firstName, amount, purpose, reason, expenseId } = opts;
  await sendEmail({
    to: toEmail,
    subject: `❌ Expense Requires Attention — DFB Foundation`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 32px; text-align: center; color: white; }
  .body { padding: 32px; }
  .reason-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin:0 0 4px;font-size:22px;">❌ Expense Needs Attention</h1>
    </div>
    <div class="body">
      <p>Hi ${firstName},</p>
      <p>Your expense submission requires attention.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:10px;background:#f8fafc;color:#64748b;font-size:13px;">Amount</td><td style="padding:10px;font-weight:600;">$${amount.toFixed(2)}</td></tr>
        <tr><td style="padding:10px;background:#f8fafc;color:#64748b;font-size:13px;">Purpose</td><td style="padding:10px;font-weight:600;">${purpose}</td></tr>
        <tr><td style="padding:10px;background:#f8fafc;color:#64748b;font-size:13px;">Expense ID</td><td style="padding:10px;font-weight:600;">${expenseId}</td></tr>
      </table>
      <div class="reason-box">
        <strong style="color:#dc2626;">Reason:</strong>
        <p style="margin:8px 0 0;color:#374151;">${reason}</p>
      </div>
      <p style="font-size:13px;color:#64748b;">Please review and resubmit with the required information.</p>
    </div>
    <div class="footer"><p>© 2026 DFB Foundation</p></div>
  </div>
</body>
</html>`,
  });
}

/** Sent to admin when a high-value donation arrives */
export async function sendHighValueDonationAlert(opts: {
  toEmail: string;
  donorName: string;
  amount: number;
  currency: string;
  transactionId: string;
}): Promise<void> {
  const { toEmail, donorName, amount, currency, transactionId } = opts;
  await sendEmail({
    to: toEmail,
    subject: `🔔 High-Value Donation Alert — $${amount.toFixed(2)} from ${donorName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 32px; text-align: center; color: white; }
  .body { padding: 32px; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
  .btn { display: inline-block; background: #7c3aed; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin:0 0 4px;font-size:22px;">🎉 High-Value Donation Received!</h1>
    </div>
    <div class="body">
      <p><strong>${donorName}</strong> just donated <strong style="font-size:24px;color:#7c3aed;">$${amount.toFixed(2)} ${currency}</strong></p>
      <p><strong>Transaction ID:</strong> ${transactionId}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <div style="text-align:center;margin-top:24px;">
        <a href="${config.appUrl}/admin/donations" class="btn">View in Admin Panel →</a>
      </div>
    </div>
    <div class="footer"><p>© 2026 DFB Foundation</p></div>
  </div>
</body>
</html>`,
  });
}

/** Password reset email */
export async function sendPasswordReset(opts: {
  toEmail: string;
  firstName: string;
  resetToken: string;
}): Promise<void> {
  const { toEmail, firstName, resetToken } = opts;
  const resetUrl = `${config.appUrl}/reset-password?token=${resetToken}`;
  await sendEmail({
    to: toEmail,
    subject: `Reset Your DFB Password`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #0284c7, #0369a1); padding: 32px; text-align: center; color: white; }
  .body { padding: 32px; }
  .btn { display: inline-block; background: #0284c7; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; }
</style></head>
<body>
  <div class="card">
    <div class="header">
      <h1 style="margin:0 0 4px;font-size:22px;">🔐 Password Reset Request</h1>
    </div>
    <div class="body">
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetUrl}" class="btn">Reset My Password →</a>
      </div>
      <p style="font-size:13px;color:#64748b;">
        If you didn't request a password reset, please ignore this email. Your account is safe.
      </p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all;">
        Or copy this link: ${resetUrl}
      </p>
    </div>
    <div class="footer"><p>© 2026 DFB Foundation</p></div>
  </div>
</body>
</html>`,
  });
}
