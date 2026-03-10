import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const announcementsRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/v1/announcements — List active announcements (filtered by audience)
// ---------------------------------------------------------------------------
announcementsRouter.get('/', authenticate, async (req: Request, res: Response) => {
  const now = new Date();
  const audience = req.query.audience as string;

  let q = db('dfb_announcements')
    .where({ is_active: true })
    .where('show_from', '<=', now)
    .where(function() {
      this.whereNull('show_until').orWhere('show_until', '>=', now);
    })
    .orderBy('created_at', 'desc');

  if (audience) {
    q = q.where(function() {
      this.where('target_audience', audience).orWhere('target_audience', 'all');
    });
  }

  const announcements = await q.select('*');
  res.json({ success: true, data: announcements });
});

// ---------------------------------------------------------------------------
// POST /api/v1/announcements — Create announcement (admin)
// ---------------------------------------------------------------------------
announcementsRouter.post('/',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  [
    body('title').trim().notEmpty().isLength({ max: 120 }),
    body('body').trim().notEmpty(),
    body('type').isIn(['info', 'warning', 'success', 'urgent']),
    body('targetAudience').isIn(['public', 'donors', 'volunteers', 'admins', 'all']),
    body('isDismissible').optional().isBoolean().toBoolean(),
    body('showFrom').optional().isISO8601().toDate(),
    body('showUntil').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const [id] = await db('dfb_announcements').insert({
      title: req.body.title,
      body: req.body.body,
      type: req.body.type,
      target_audience: req.body.targetAudience,
      display_locations: JSON.stringify(req.body.displayLocations || []),
      is_dismissible: req.body.isDismissible ?? true,
      show_from: req.body.showFrom || new Date(),
      show_until: req.body.showUntil || null,
      is_active: true,
      created_by: req.user!.userId,
      created_at: new Date(),
    });

    await writeAuditLog({
      tableAffected: 'dfb_announcements',
      recordId: String(id),
      actionType: 'INSERT',
      newPayload: { title: req.body.title, type: req.body.type, target_audience: req.body.targetAudience },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Announcement created', announcementId: id });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/v1/announcements/:id — Update / deactivate announcement
// ---------------------------------------------------------------------------
announcementsRouter.patch('/:id',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as any;
    const updateData: any = {};
    if (req.body.isActive !== undefined) updateData.is_active = req.body.isActive;
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.body !== undefined) updateData.body = req.body.body;
    if (req.body.showUntil !== undefined) updateData.show_until = req.body.showUntil;

    const updated = await db('dfb_announcements').where({ announcement_id: id }).update(updateData);
    if (!updated) { res.status(404).json({ success: false, message: 'Announcement not found' }); return; }

    res.json({ success: true, message: 'Announcement updated' });
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/v1/announcements/:id
// ---------------------------------------------------------------------------
announcementsRouter.delete('/:id',
  authenticate,
  requireRoles('Super Admin'),
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as any;
    await db('dfb_announcements').where({ announcement_id: id }).update({ is_active: false });
    res.json({ success: true, message: 'Announcement deactivated' });
  }
);
