import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { v4 as uuidv4 } from 'uuid';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/v1/notifications — List notifications for authenticated user
// ---------------------------------------------------------------------------
notificationsRouter.get('/', async (req: Request, res: Response) => {
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
    .select('*');

  res.json({
    success: true,
    data: notifications,
    meta: { total: Number(total), unread: Number(unread), page, limit }
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/notifications/:id/read — Mark notification as read
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// PATCH /api/v1/notifications/read-all — Mark all as read
// ---------------------------------------------------------------------------
notificationsRouter.patch('/read-all', async (req: Request, res: Response) => {
  await db('dfb_notifications')
    .where({ user_id: req.user!.userId, is_read: false })
    .update({ is_read: true, read_at: new Date() });

  res.json({ success: true, message: 'All notifications marked as read' });
});

// ---------------------------------------------------------------------------
// Utility: Create a notification (called internally by other services)
// ---------------------------------------------------------------------------
export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  channel?: string;
  referenceType?: string;
  referenceId?: string;
}) {
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
