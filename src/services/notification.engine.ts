/**
 * notification.engine.ts
 *
 * Central engine for all notifications.
 * - Reads rules from dfb_notification_rules (with Redis caching)
 * - Decides whether to send in-app and/or email notifications
 * - Renders templates with {{variable}} substitution
 * - Pushes real-time events via Socket.IO
 */

import { db } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { sendEmail } from './email.service';
import { decrypt } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

const RULE_CACHE_TTL = 60; // seconds

interface NotificationRule {
  rule_id: number;
  event_type: string;
  label: string;
  is_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  email_subject: string | null;
  email_body: string | null;
  recipients: 'user' | 'admin' | 'both';
}

interface FireOptions {
  /** In-app recipient user ID */
  userId?: string;
  /** Email recipient address */
  toEmail?: string;
  /** Template variables — used for {{key}} substitution */
  variables: Record<string, string | number | undefined>;
  /** In-app notification title (falls back to rendered subject) */
  title?: string;
  /** In-app notification body */
  body?: string;
  actionUrl?: string;
  referenceType?: string;
  referenceId?: string;
}

// ---------------------------------------------------------------------------
// Template renderer — replaces {{key}} with context values
// ---------------------------------------------------------------------------
function render(template: string, vars: Record<string, string | number | undefined>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    const val = v !== undefined && v !== null ? String(v) : '';
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), val);
  }
  // Remove unresolved placeholders
  out = out.replace(/\{\{[^}]+\}\}/g, '');
  return out;
}

// ---------------------------------------------------------------------------
// Rule cache
// ---------------------------------------------------------------------------
async function getRule(eventType: string): Promise<NotificationRule | null> {
  const cacheKey = `notif_rule:${eventType}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as NotificationRule;
  } catch { /* Redis unavailable — fall through */ }

  const rule = await db('dfb_notification_rules').where({ event_type: eventType }).first<NotificationRule>();
  if (rule) {
    try { await redis.setex(cacheKey, RULE_CACHE_TTL, JSON.stringify(rule)); } catch { /* ignore */ }
  }
  return rule || null;
}

// Invalidate cache after admin updates a rule
export async function invalidateRuleCache(eventType: string): Promise<void> {
  try { await redis.del(`notif_rule:${eventType}`); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Get admin emails
// ---------------------------------------------------------------------------
async function getAdminEmails(): Promise<string[]> {
  const admins = await db('dfb_users as u')
    .join('dfb_roles as r', 'u.role_id', 'r.role_id')
    .whereIn('r.role_name', ['Super Admin', 'Admin'])
    .where({ 'u.is_active': true })
    .select('u.email');
  return admins
    .map((a: { email: string }) => { try { return decrypt(a.email); } catch { return ''; } })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// IO reference — set by index.ts after server starts
// ---------------------------------------------------------------------------
let _io: any = null;
export function setNotificationIO(io: any) { _io = io; }

// ---------------------------------------------------------------------------
// Create in-app notification record (owned by engine to avoid circular imports)
// ---------------------------------------------------------------------------
async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  channel?: string;
  referenceType?: string;
  referenceId?: string;
}): Promise<void> {
  await db('dfb_notifications').insert({
    notification_id: uuidv4(),
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    action_url: params.actionUrl || null,
    channel: params.channel || 'in_app',
    is_read: false,
    sent_at: new Date(),
    reference_type: params.referenceType || null,
    reference_id: params.referenceId || null,
  });
}

// ---------------------------------------------------------------------------
// Main fire function
// ---------------------------------------------------------------------------
export async function fireNotification(eventType: string, opts: FireOptions): Promise<void> {
  try {
    const rule = await getRule(eventType);

    if (!rule || !rule.is_enabled) {
      logger.debug(`[Notif] Rule "${eventType}" is disabled or not found — skipped`);
      return;
    }

    const vars = opts.variables || {};

    // ---- In-app notification ----
    if (rule.in_app_enabled && opts.userId) {
      const title = opts.title || (rule.email_subject ? render(rule.email_subject, vars) : rule.label);
      const body  = opts.body  || (rule.email_body    ? render(rule.email_body, vars)    : '');

      await createNotification({
        userId: opts.userId,
        type:   eventType,
        title:  title.slice(0, 120),
        body:   body.slice(0, 500),
        actionUrl:     opts.actionUrl,
        channel:       'in_app',
        referenceType: opts.referenceType,
        referenceId:   opts.referenceId,
      });

      // Push real-time event if socket.io available
      if (_io) {
        _io.to(`user:${opts.userId}`).emit('notification:new', {
          type:  eventType,
          title: title.slice(0, 120),
          body:  body.slice(0, 200),
          actionUrl: opts.actionUrl,
          sentAt: new Date().toISOString(),
        });
      }
      logger.info(`[Notif] In-app sent → user:${opts.userId} [${eventType}]`);
    }

    // ---- Email notification ----
    if (rule.email_enabled && rule.email_subject && rule.email_body) {
      const subject = render(rule.email_subject, vars);
      const html    = wrapEmailHtml(rule.label, render(rule.email_body, vars));

      // Send to user
      if (opts.toEmail && rule.recipients !== 'admin') {
        await sendEmail({ to: opts.toEmail, subject, html });
        logger.info(`[Notif] Email sent → ${opts.toEmail} [${eventType}]`);
      }

      // Send to admins
      if (rule.recipients === 'admin' || rule.recipients === 'both') {
        const adminEmails = await getAdminEmails();
        for (const adminEmail of adminEmails) {
          await sendEmail({ to: adminEmail, subject, html });
        }
        logger.info(`[Notif] Email sent to ${adminEmails.length} admin(s) [${eventType}]`);
      }
    }

  } catch (err) {
    logger.error(`[Notif] Error firing "${eventType}":`, err);
    // Never throw — notification failure must not break the caller
  }
}

// ---------------------------------------------------------------------------
// Wrap body in the standard DFB email shell
// ---------------------------------------------------------------------------
function wrapEmailHtml(label: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
  .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px 32px; color: white; }
  .header h1 { margin: 0; font-size: 18px; font-weight: 600; }
  .body { padding: 28px 32px; color: #374151; font-size: 14px; line-height: 1.7; }
  .footer { background: #f8fafc; padding: 16px 32px; text-align: center; font-size: 11px; color: #94a3b8; }
  a { color: #2563eb; }
  strong { color: #0f172a; }
</style></head>
<body>
  <div class="card">
    <div class="header"><h1>DFB Foundation — ${label}</h1></div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DFB Foundation · All rights reserved</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Broadcast helper (used by admin broadcast endpoint)
// ---------------------------------------------------------------------------
export async function broadcastNotification(opts: {
  title: string;
  body: string;
  target: 'all' | 'donors' | 'volunteers';
  actionUrl?: string;
}): Promise<{ count: number }> {
  let query = db('dfb_users as u')
    .join('dfb_roles as r', 'u.role_id', 'r.role_id')
    .where({ 'u.is_active': true })
    .select('u.user_id', 'r.role_name');
  if (opts.target === 'donors') {
    query = query.whereIn('r.role_name', ['Donor']);
  } else if (opts.target === 'volunteers') {
    query = query.whereIn('r.role_name', ['Volunteer']);
  }

  const users = await query;
  let count = 0;

  for (const user of users) {
    await createNotification({
      userId:  user.user_id,
      type:    'announcement',
      title:   opts.title.slice(0, 120),
      body:    opts.body.slice(0, 500),
      channel: 'in_app',
      actionUrl: opts.actionUrl,
    });

    if (_io) {
      _io.to(`user:${user.user_id}`).emit('notification:new', {
        type:     'announcement',
        title:    opts.title,
        body:     opts.body,
        actionUrl: opts.actionUrl,
        sentAt:   new Date().toISOString(),
      });
    }
    count++;
  }

  logger.info(`[Notif] Broadcast to ${count} users [target:${opts.target}]`);
  return { count };
}
