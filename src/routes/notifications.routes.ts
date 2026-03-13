import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { invalidateRuleCache, broadcastNotification, fireNotification } from '../services/notification.engine';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// =============================================================================
// USER ENDPOINTS
// =============================================================================

// GET /api/v1/notifications — List notifications for authenticated user
notificationsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;

  const [{ total }] = await db('dfb_notifications')
    .where({ user_id: req.user!.userId })
    .count('notification_id as total');

  const [{ unread }] = await db('dfb_notifications')
    .where({ user_id: req.user!.userId, is_read: false })
    .count('notification_id as unread');

  const notifications = await db('dfb_notifications')
    .where({ user_id: req.user!.userId })
    .orderBy('sent_at', 'desc')
    .limit(limit).offset(offset)
    .select(
      'notification_id as id',
      'notification_id',
      'type',
      'title',
      'body as message',
      'body',
      'is_read',
      'sent_at as created_at',
      'sent_at',
      'read_at',
      'action_url',
      'channel',
      'reference_type',
      'reference_id'
    );

  res.json({
    success: true,
    data: notifications,
    meta: { total: Number(total), unread: Number(unread), page, limit }
  });
});

// PATCH /api/v1/notifications/:id/read — Mark single notification as read
notificationsRouter.patch('/:id/read',
  param('id').isUUID(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const updated = await db('dfb_notifications')
      .where({ notification_id: req.params.id, user_id: req.user!.userId })
      .update({ is_read: true, read_at: new Date() });

    if (!updated) { res.status(404).json({ success: false, message: 'Notification not found' }); return; }
    res.json({ success: true, message: 'Marked as read' });
  }
);

// PATCH /api/v1/notifications/read-all — Mark all as read
notificationsRouter.patch('/read-all', async (req: Request, res: Response): Promise<void> => {
  await db('dfb_notifications')
    .where({ user_id: req.user!.userId, is_read: false })
    .update({ is_read: true, read_at: new Date() });
  res.json({ success: true, message: 'All notifications marked as read' });
});

// DELETE /api/v1/notifications/:id — Delete a notification (user's own)
notificationsRouter.delete('/:id', param('id').isUUID(), async (req: Request, res: Response): Promise<void> => {
  await db('dfb_notifications')
    .where({ notification_id: req.params.id, user_id: req.user!.userId })
    .delete();
  res.json({ success: true, message: 'Notification deleted' });
});

// =============================================================================
// ADMIN ENDPOINTS — Notification Rules
// =============================================================================

// GET /api/v1/notification-rules — List all rules (admin)
notificationsRouter.get('/rules', requireRoles('Super Admin', 'Admin'), async (_req: Request, res: Response): Promise<void> => {
  const rules = await db('dfb_notification_rules').orderBy('rule_id', 'asc');
  res.json({ success: true, data: rules });
});

// PATCH /api/v1/notification-rules/:eventType — Update a rule
notificationsRouter.patch('/rules/:eventType',
  requireRoles('Super Admin', 'Admin'),
  [
    body('is_enabled').optional().isBoolean(),
    body('in_app_enabled').optional().isBoolean(),
    body('email_enabled').optional().isBoolean(),
    body('email_subject').optional().isString().isLength({ max: 255 }),
    body('email_body').optional().isString(),
    body('recipients').optional().isIn(['user', 'admin', 'both']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { eventType } = req.params;
    const allowed = ['is_enabled', 'in_app_enabled', 'email_enabled', 'email_subject', 'email_body', 'recipients'];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (!Object.keys(updates).length) { res.status(400).json({ success: false, message: 'No valid fields provided' }); return; }

    await db('dfb_notification_rules').where({ event_type: eventType }).update(updates);

    // Invalidate the Redis cache for this rule
    await invalidateRuleCache(String(eventType));

    await writeAuditLog({
      tableAffected: 'dfb_notification_rules',
      recordId: String(eventType),
      actionType: 'UPDATE',
      newPayload: updates,
      actorId: req.user!.userId,
    });

    res.json({ success: true, message: 'Rule updated' });
  }
);

// POST /api/v1/notification-rules/:eventType/test — Send a test notification
notificationsRouter.post('/rules/:eventType/test',
  requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { eventType } = req.params;
    const rule = await db('dfb_notification_rules').where({ event_type: eventType }).first();
    if (!rule) { res.status(404).json({ success: false, message: 'Rule not found' }); return; }

    // Get admin user info for the test
    const admin = await db('dfb_users').where({ user_id: req.user!.userId }).first();
    if (!admin) { res.status(404).json({ success: false, message: 'Admin user not found' }); return; }

    // Fire with sample variables
    await fireNotification(String(eventType), {
      userId: req.user!.userId,
      toEmail: admin.email,
      variables: {
        firstName: admin.first_name || 'Admin',
        amount: '50.00',
        formattedAmount: '$50.00',
        transactionId: 'TEST-TXN-001',
        campaignName: 'Test Campaign',
        fundName: 'General Fund',
        purpose: 'Test Purpose',
        reason: 'This is a test rejection reason.',
        expenseId: 'EXP-TEST-001',
        donorName: 'Test Donor',
        role: 'Donor',
        status: 'approved',
        percent: '75',
        raised: '$7,500',
        balance: '$100.00',
        fundBalanceName: 'Test Fund',
        title: 'Test Announcement',
        message: 'This is a test broadcast message.',
        adminNotes: 'Test admin notes.',
        resetUrl: '#',
        date: new Date().toLocaleDateString(),
      },
      title: `TEST: ${rule.label}`,
      body: 'This is a test notification from the admin panel.',
    });

    res.json({ success: true, message: 'Test notification fired' });
  }
);

// =============================================================================
// ADMIN BROADCAST
// =============================================================================

// POST /api/v1/notifications/broadcast — Send broadcast to users
notificationsRouter.post('/broadcast',
  requireRoles('Super Admin', 'Admin'),
  [
    body('title').trim().notEmpty().isLength({ max: 120 }),
    body('message').trim().notEmpty().isLength({ max: 1000 }),
    body('target').isIn(['all', 'donors', 'volunteers']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { title, message, target } = req.body;
    const result = await broadcastNotification({ title, body: message, target });

    await writeAuditLog({
      tableAffected: 'dfb_notifications',
      recordId: 'broadcast',
      actionType: 'INSERT',
      newPayload: { title, target, count: result.count },
      actorId: req.user!.userId,
    });

    res.json({ success: true, message: `Broadcast sent to ${result.count} users`, data: result });
  }
);

// =============================================================================
// ADMIN NOTIFICATION LOG
// =============================================================================

// GET /api/v1/notifications/admin-log — All notifications for admin view
notificationsRouter.get('/admin-log',
  requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const offset = (page - 1) * limit;
    const type = req.query.type ? String(req.query.type) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    let qb = db('dfb_notifications as n')
      .leftJoin('dfb_users as u', 'n.user_id', 'u.user_id')
      .select(
        'n.notification_id', 'n.type', 'n.title', 'n.body',
        'n.channel', 'n.is_read', 'n.sent_at', 'n.read_at',
        'u.email as recipient_email',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as recipient_name")
      );

      if (type) qb = qb.where('n.type', String(type));
      if (search) {
      qb = qb.where(function() {
        this.where('n.title', 'like', `%${search}%`)
          .orWhere('u.email', 'like', `%${search}%`)
          .orWhere('n.body', 'like', `%${search}%`);
      });
    }

    const [{ total }] = await qb.clone().clearSelect().count('n.notification_id as total');
    const rows = await qb.orderBy('n.sent_at', 'desc').limit(limit).offset(offset);

    res.json({ success: true, data: rows, meta: { page, limit, total: Number(total) } });
  }
);

