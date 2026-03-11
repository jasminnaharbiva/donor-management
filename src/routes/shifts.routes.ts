import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const shiftsRouter = Router();

// ─── SHIFTS ──────────────────────────────────────────────────────────────────

// GET /api/v1/shifts
shiftsRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const page   = Number(req.query.page  || 1);
  const limit  = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  let qb = db('dfb_shifts as s')
    .leftJoin('dfb_projects as p', 's.project_id', 'p.project_id')
    .leftJoin('dfb_campaigns as c', 's.campaign_id', 'c.campaign_id');

  if (status) qb = qb.where('s.status', status);

  const [{ total }] = await qb.clone().count('s.shift_id as total');
  const shifts = await qb.orderBy('s.start_datetime', 'desc').limit(limit).offset(offset)
    .select('s.*', 'p.project_name', 'c.title as campaign_title');

  res.json({ success: true, data: shifts, meta: { page, limit, total: Number(total) } });
});

// POST /api/v1/shifts — Create shift (admin)
shiftsRouter.post('/',
  authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('shiftTitle').trim().notEmpty().isLength({ max: 120 }),
    body('startDatetime').isISO8601().toDate(),
    body('endDatetime').isISO8601().toDate(),
    body('maxVolunteers').optional().isInt({ min: 0 }).toInt(),
    body('projectId').optional().isInt().toInt(),
    body('campaignId').optional().isInt().toInt(),
    body('locationName').optional().trim().isLength({ max: 120 }),
    body('status').optional().isIn(['open','full','completed','cancelled']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { shiftTitle, startDatetime, endDatetime, maxVolunteers, projectId, campaignId, locationName, description, skillsRequired, status } = req.body;

    const [id] = await db('dfb_shifts').insert({
      shift_title:      shiftTitle,
      start_datetime:   startDatetime,
      end_datetime:     endDatetime,
      max_volunteers:   maxVolunteers || 0,
      project_id:       projectId || null,
      campaign_id:      campaignId || null,
      location_name:    locationName || null,
      description:      description || null,
      skills_required:  skillsRequired ? JSON.stringify(skillsRequired) : null,
      status:           status || 'open',
      created_by:       req.user!.userId,
      created_at:       new Date(),
      updated_at:       new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_shifts', recordId: String(id), actionType: 'INSERT', newPayload: { shiftTitle }, actorId: req.user!.userId });
    res.status(201).json({ success: true, data: { shift_id: id } });
  }
);

// PATCH /api/v1/shifts/:id
shiftsRouter.patch('/:id',
  authenticate, requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const allowed = ['shift_title','description','start_datetime','end_datetime','max_volunteers','location_name','status'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, (_,c) => c.toUpperCase());
      if (req.body[camel] !== undefined) updates[key] = req.body[camel];
      if (req.body[key]  !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date();
    await db('dfb_shifts').where({ shift_id: req.params.id as any }).update(updates);
    res.json({ success: true, message: 'Shift updated' });
  }
);

// DELETE /api/v1/shifts/:id
shiftsRouter.delete('/:id', authenticate, requireRoles('Super Admin'), param('id').isInt().toInt(), async (req: Request, res: Response): Promise<void> => {
  await db('dfb_shifts').where({ shift_id: req.params.id as any }).delete();
  res.json({ success: true, message: 'Shift deleted' });
});

// ─── TIMESHEETS ──────────────────────────────────────────────────────────────

// GET /api/v1/shifts/timesheets
shiftsRouter.get('/timesheets', authenticate, async (req: Request, res: Response): Promise<void> => {
  const page   = Number(req.query.page  || 1);
  const limit  = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  let qb = db('dfb_timesheets as t')
    .leftJoin('dfb_volunteers as v', 't.volunteer_id', 'v.volunteer_id')
    .leftJoin('dfb_projects as p', 't.project_id', 'p.project_id')
    .leftJoin('dfb_shifts as s', 't.shift_id', 's.shift_id');

  if (status) qb = qb.where('t.status', status);

  const [{ total }] = await qb.clone().count('t.timesheet_id as total');
  const timesheets = await qb.orderBy('t.submitted_at', 'desc').limit(limit).offset(offset)
    .select('t.*', 'v.first_name', 'v.last_name', 'p.project_name', 's.shift_title');

  res.json({ success: true, data: timesheets, meta: { page, limit, total: Number(total) } });
});

// PATCH /api/v1/shifts/timesheets/:id/review
shiftsRouter.patch('/timesheets/:id/review',
  authenticate, requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  [
    body('status').isIn(['approved','rejected']),
    body('adminNotes').optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { status, adminNotes } = req.body;
    await db('dfb_timesheets').where({ timesheet_id: req.params.id as any }).update({
      status,
      admin_notes:  adminNotes || null,
      reviewed_by:  req.user!.userId,
      reviewed_at:  new Date(),
      updated_at:   new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_timesheets', recordId: String(req.params.id), actionType: 'UPDATE', newPayload: { status }, actorId: req.user!.userId });
    res.json({ success: true, message: `Timesheet ${status}` });
  }
);

// POST /api/v1/shifts/timesheets — Volunteer submits timesheet
shiftsRouter.post('/timesheets',
  authenticate,
  [
    body('volunteerId').isInt({ min: 1 }).toInt(),
    body('startDatetime').isISO8601().toDate(),
    body('endDatetime').isISO8601().toDate(),
    body('activityDescription').optional().isString(),
    body('projectId').optional().isInt().toInt(),
    body('shiftId').optional().isInt().toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { volunteerId, startDatetime, endDatetime, activityDescription, projectId, shiftId } = req.body;

    const [id] = await db('dfb_timesheets').insert({
      volunteer_id:           volunteerId,
      project_id:             projectId || null,
      shift_id:               shiftId || null,
      activity_description:   activityDescription || null,
      start_datetime:         startDatetime,
      end_datetime:           endDatetime,
      status:                 'pending',
      submitted_at:           new Date(),
      updated_at:             new Date(),
    });

    res.status(201).json({ success: true, data: { timesheet_id: id } });
  }
);
