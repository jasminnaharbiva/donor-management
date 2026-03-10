import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { approveVolunteerApplication } from '../services/volunteer.service';
import { writeAuditLog } from '../services/audit.service';

export const volunteersRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/v1/volunteers/apply — Public application form
// ---------------------------------------------------------------------------
volunteersRouter.post(
  '/apply',
  [
    body('applicantName').trim().notEmpty(),
    body('applicantEmail').isEmail().normalizeEmail(),
    body('phone').trim().notEmpty(),
    body('motivationStatement').trim().isLength({ max: 2000 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { applicantName, applicantEmail, phone, motivationStatement } = req.body;

    const [applicationId] = await db('dfb_volunteer_applications').insert({
      applicant_name: applicantName,
      applicant_email: applicantEmail,
      phone, // Normally this should be AES-256 encrypted using an encryption service here
      motivation_statement: motivationStatement,
      status: 'pending',
      submitted_at: new Date(),
      updated_at: new Date()
    });

    res.status(201).json({ success: true, message: 'Application submitted successfully', applicationId });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/volunteers/applications — List Applications (Admin Only)
// ---------------------------------------------------------------------------
volunteersRouter.get(
  '/applications',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const applications = await db('dfb_volunteer_applications')
      .select('*')
      .orderBy('submitted_at', 'desc');

    res.json({ success: true, data: applications });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/volunteers/applications/:id/approve — Approve Application (Admin Only)
// ---------------------------------------------------------------------------
volunteersRouter.post(
  '/applications/:id/approve',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  param('id').isInt({ min: 1 }).toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    try {
      const ipAddr = req.ip || '127.0.0.1';
      const volunteerId = await approveVolunteerApplication(req.params.id as any, req.user!.userId, ipAddr);
      res.json({ success: true, message: 'Application approved, volunteer account created', volunteerId });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/volunteers/shifts — List upcoming shifts
// ---------------------------------------------------------------------------
volunteersRouter.get(
  '/shifts',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const shifts = await db('dfb_shifts')
      .where('end_datetime', '>=', new Date())
      .where('status', 'open')
      .orderBy('start_datetime', 'asc')
      .select('*');

    res.json({ success: true, data: shifts });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/volunteers/shifts/:id/signup — Volunteer signs up for shift
// ---------------------------------------------------------------------------
volunteersRouter.post(
  '/shifts/:id/signup',
  authenticate,
  requireRoles('Volunteer', 'Admin', 'Super Admin'),
  param('id').isInt({ min: 1 }).toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const shiftId = req.params.id as any;
    const userRow = await db('dfb_users').where({ user_id: req.user!.userId }).first('volunteer_id');
    const volunteerId = userRow?.volunteer_id;

    if (!volunteerId) {
      res.status(403).json({ success: false, message: 'Only active volunteers can sign up for shifts' });
      return;
    }

    const shift = await db('dfb_shifts').where({ shift_id: shiftId, status: 'open' }).first();
    if (!shift) {
      res.status(404).json({ success: false, message: 'Shift not found or is no longer open' });
      return;
    }

    // Check if already signed up
    const existing = await db('dfb_shift_signups').where({ shift_id: shiftId, volunteer_id: volunteerId }).first();
    if (existing) {
      res.status(409).json({ success: false, message: 'You are already signed up for this shift' });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('dfb_shift_signups').insert({
        shift_id: shiftId,
        volunteer_id: volunteerId,
        status: 'confirmed',
        signed_up_at: new Date()
      });

      await trx('dfb_shifts').where({ shift_id: shiftId }).increment('signed_up_count', 1);
    });

    res.status(201).json({ success: true, message: 'Successfully signed up for shift' });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/volunteers/timesheets — Log volunteer hours
// ---------------------------------------------------------------------------
volunteersRouter.post(
  '/timesheets',
  authenticate,
  requireRoles('Volunteer', 'Admin', 'Super Admin'),
  [
    body('projectId').optional().isInt({ min: 1 }).toInt(),
    body('shiftId').optional().isInt({ min: 1 }).toInt(),
    body('activityDescription').trim().notEmpty(),
    body('startDatetime').isISO8601().toDate(),
    body('endDatetime').isISO8601().toDate(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const volUser = await db('dfb_users').where({ user_id: req.user!.userId }).first('volunteer_id');
    const volunteerId = volUser?.volunteer_id;
    if (!volunteerId) {
      res.status(403).json({ success: false, message: 'Only active volunteers can log hours' });
      return;
    }

    const { projectId, shiftId, activityDescription, startDatetime, endDatetime } = req.body;

    const diffMs = new Date(endDatetime).getTime() - new Date(startDatetime).getTime();
    if (diffMs <= 0) {
      res.status(400).json({ success: false, message: 'End time must be after start time' });
      return;
    }
    const durationMinutes = Math.floor(diffMs / 60000);

    const [timesheetId] = await db('dfb_timesheets').insert({
      volunteer_id: volunteerId,
      project_id: projectId || null,
      shift_id: shiftId || null,
      activity_description: activityDescription,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      status: 'pending',
      submitted_at: new Date(),
      updated_at: new Date()
    });

    res.status(201).json({ success: true, message: 'Timesheet submitted for approval', data: { timesheet_id: timesheetId, duration_minutes: durationMinutes } });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/volunteers/timesheets — List own timesheets
// ---------------------------------------------------------------------------
volunteersRouter.get(
  '/timesheets',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userRow = await db('dfb_users').where({ user_id: req.user!.userId }).first('volunteer_id');
    const volunteerId = userRow?.volunteer_id;
    if (!volunteerId) { res.json({ success: true, data: [] }); return; }

    const sheets = await db('dfb_timesheets as t')
      .leftJoin('dfb_shifts as s', 't.shift_id', 's.shift_id')
      .where({ 't.volunteer_id': volunteerId })
      .orderBy('t.submitted_at', 'desc')
      .select(
        't.timesheet_id as id', 't.shift_id', 't.activity_description as task_description',
        't.start_datetime', 't.end_datetime', 't.duration_minutes',
        't.status', 't.submitted_at', 's.shift_title'
      );

    // add hours_worked convenience field
    const data = sheets.map((s: any) => ({ ...s, hours_worked: +(s.duration_minutes / 60).toFixed(2) }));
    res.json({ success: true, data });
  }
);
