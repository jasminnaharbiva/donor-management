import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { approveVolunteerApplication } from '../services/volunteer.service';
import { writeAuditLog } from '../services/audit.service';

export const volunteersRouter = Router();

async function attachVolunteerProjectProgress<T extends { project_id: number }>(projects: T[]): Promise<Array<T & Record<string, unknown>>> {
  if (!projects.length) return projects;

  const projectIds = projects.map(project => project.project_id);
  const rows = await db('dfb_project_progress_logs')
    .whereIn('project_id', projectIds)
    .orderBy('happened_at', 'desc')
    .orderBy('log_id', 'desc')
    .select('project_id', 'progress_percent', 'update_title', 'update_body', 'update_type', 'status_snapshot', 'happened_at');

  const latestByProject = new Map<number, any>();
  rows.forEach((row: any) => {
    const projectId = Number(row.project_id);
    if (!latestByProject.has(projectId)) latestByProject.set(projectId, row);
  });

  return projects.map(project => {
    const latest = latestByProject.get(project.project_id);
    return {
      ...project,
      latest_progress_percent: latest ? Number(latest.progress_percent || 0) : null,
      latest_progress_title: latest?.update_title || null,
      latest_progress_body: latest?.update_body || null,
      latest_progress_type: latest?.update_type || null,
      latest_progress_status: latest?.status_snapshot || null,
      latest_progress_at: latest?.happened_at || null,
    };
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/volunteers — Admin: list all volunteers (for dropdowns etc.)
// ---------------------------------------------------------------------------
volunteersRouter.get(
  '/',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  async (_req: Request, res: Response): Promise<void> => {
    const volunteers = await db('dfb_volunteers')
      .orderBy('first_name', 'asc')
      .select('volunteer_id', 'first_name', 'last_name', 'badge_number', 'status');
    res.json({ success: true, data: volunteers });
  }
);

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
// GET /api/v1/volunteers/my-projects — Projects the logged-in volunteer is assigned to
// ---------------------------------------------------------------------------
volunteersRouter.get(
  '/my-projects',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const userRow = await db('dfb_users').where({ user_id: req.user!.userId }).first('volunteer_id');
    const volunteerId = userRow?.volunteer_id;
    if (!volunteerId) {
      res.json({ success: true, data: [] });
      return;
    }
    const projects = await db('dfb_project_assignments as pa')
      .join('dfb_projects as p', 'pa.project_id', 'p.project_id')
      .leftJoin('dfb_funds as f', 'p.fund_id', 'f.fund_id')
      .where({ 'pa.volunteer_id': volunteerId, 'pa.status': 'active' })
      .select(
        'p.project_id', 'p.project_name', 'p.description', 'p.status',
        'p.budget_allocated', 'p.budget_spent', 'p.budget_remaining',
        'p.location_country', 'p.location_city',
        'p.start_date', 'p.target_completion_date',
        'f.fund_name', 'pa.assigned_at'
      );
    const enrichedProjects = await attachVolunteerProjectProgress(projects as Array<{ project_id: number }>);
    res.json({ success: true, data: enrichedProjects });
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
    body('receiptUrl').optional({ nullable: true }).isString(),
    body('gpsLat').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).toFloat(),
    body('gpsLon').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).toFloat(),
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

    const { projectId, shiftId, activityDescription, startDatetime, endDatetime, receiptUrl, gpsLat, gpsLon } = req.body;

    let linkedProject: { project_id: number; fund_id: number } | undefined;
    if (projectId) {
      linkedProject = await db('dfb_projects').where({ project_id: projectId }).first('project_id', 'fund_id');
      if (!linkedProject) {
        res.status(404).json({ success: false, message: 'Project not found' });
        return;
      }

      const assignment = await db('dfb_project_assignments')
        .where({ project_id: projectId, volunteer_id: volunteerId, status: 'active' })
        .first('assignment_id');
      if (!assignment) {
        res.status(403).json({ success: false, message: 'You are not assigned to this project' });
        return;
      }
    }

    if (!linkedProject && shiftId) {
      const shiftProject = await db('dfb_shifts as s')
        .leftJoin('dfb_projects as p', 's.project_id', 'p.project_id')
        .where({ 's.shift_id': shiftId })
        .first('s.project_id', 'p.fund_id');
      if (shiftProject?.project_id && shiftProject?.fund_id) {
        linkedProject = { project_id: shiftProject.project_id, fund_id: shiftProject.fund_id };
      }
    }

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
      receipt_url: receiptUrl || null,
      status: 'pending',
      submitted_at: new Date(),
      updated_at: new Date()
    });

    // If receiptUrl OR GPS provided, also log an expense record for audit trail
    if ((receiptUrl || (gpsLat != null && gpsLon != null)) && linkedProject?.fund_id) {
      const { v4: uuidv4 } = await import('uuid');
      await db('dfb_expenses').insert({
        expense_id:                uuidv4(),
        fund_id:                   linkedProject.fund_id,
        project_id:                linkedProject.project_id,
        amount_spent:              0,
        purpose:                   activityDescription,
        receipt_url:               receiptUrl || null,
        gps_lat:                   gpsLat ?? null,
        gps_lon:                   gpsLon ?? null,
        spent_timestamp:           startDatetime,
        submitted_by_volunteer_id: volunteerId,
        status:                    'Pending',
        created_at:                new Date(),
      });
    }

    res.status(201).json({ success: true, message: 'Timesheet submitted for approval', data: { timesheet_id: timesheetId, duration_minutes: durationMinutes, receipt_url: receiptUrl } });
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
      .leftJoin('dfb_projects as p', 't.project_id', 'p.project_id')
      .where({ 't.volunteer_id': volunteerId })
      .orderBy('t.submitted_at', 'desc')
      .select(
        't.timesheet_id as id', 't.shift_id', 't.activity_description as task_description',
        't.start_datetime', 't.end_datetime', 't.duration_minutes', 't.receipt_url',
        't.status', 't.submitted_at', 's.shift_title', 'p.project_name'
      );

    res.json({ success: true, data: sheets });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/volunteers/search — Advanced volunteer search/filter (Admin Only)
// ---------------------------------------------------------------------------
volunteersRouter.get(
  '/search',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const {
      search,
      status,
      city,
      country,
      background_check_status,
      badge_number,
      approved_after,
      approved_before,
      father_name,
      district,
      upazila,
      division,
      education_level,
      blood_group,
      sort_by = 'first_name',
      sort_order = 'asc',
      page = '1',
      limit = '50'
    } = req.query;

    let query = db('dfb_volunteers as v')
      .leftJoin('dfb_users as u', 'v.user_id', 'u.user_id')
      .select(
        'v.volunteer_id',
        'v.first_name',
        'v.last_name',
        'v.father_name',
        'v.date_of_birth',
        'v.blood_group',
        'v.education_level',
        'v.mobile_number',
        'v.address',
        'v.full_address',
        'v.division',
        'v.district',
        'v.upazila',
        'v.city',
        'v.country',
        'v.background_check_status',
        'v.badge_number',
        'v.status',
        'v.approved_at',
        'v.created_at',
        'u.email'
      );

    // Apply filters
    if (search) {
      const searchTerm = `%${search}%`;
      query = query.where(function() {
        this.where('v.first_name', 'like', searchTerm)
            .orWhere('v.last_name', 'like', searchTerm)
            .orWhere('v.badge_number', 'like', searchTerm)
            .orWhere('u.email', 'like', searchTerm);
      });
    }

    if (status) {
      query = query.where('v.status', status);
    }

    if (city) {
      query = query.where('v.city', 'like', `%${city}%`);
    }

    if (country) {
      query = query.where('v.country', country);
    }

    if (background_check_status) {
      query = query.where('v.background_check_status', background_check_status);
    }

    if (badge_number) {
      query = query.where('v.badge_number', 'like', `%${badge_number}%`);
    }

    if (approved_after) {
      query = query.where('v.approved_at', '>=', approved_after);
    }

    if (approved_before) {
      query = query.where('v.approved_at', '<=', approved_before);
    }

    if (father_name) {
      query = query.where('v.father_name', 'like', `%${father_name}%`);
    }

    if (district) {
      query = query.where('v.district', 'like', `%${district}%`);
    }

    if (upazila) {
      query = query.where('v.upazila', 'like', `%${upazila}%`);
    }

    if (division) {
      query = query.where('v.division', 'like', `%${division}%`);
    }

    if (education_level) {
      query = query.where('v.education_level', 'like', `%${education_level}%`);
    }

    if (blood_group) {
      query = query.where('v.blood_group', blood_group);
    }

    // Sorting
    const validSortFields = ['first_name', 'last_name', 'badge_number', 'status', 'approved_at', 'created_at', 'father_name', 'district', 'upazila', 'division', 'education_level'];
    const sortField = validSortFields.includes(sort_by as string) ? sort_by : 'first_name';
    const sortDir = (sort_order as string) === 'desc' ? 'desc' : 'asc';
    query = query.orderBy(`v.${sortField}`, sortDir);

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const countQuery = query.clone().clearSelect().clearOrder().select(db.raw('COUNT(*) as total'));
    const countResult = await countQuery.first();
    const total = Number((countResult as any)?.total || 0);

    // Apply pagination
    query = query.limit(limitNum).offset(offset);

    const volunteers = await query;

    res.json({
      success: true,
      data: volunteers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  }
);
