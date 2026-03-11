import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const volunteerApplicationsRouter = Router();

// GET /api/v1/volunteer-applications
volunteerApplicationsRouter.get('/', authenticate, requireRoles('Super Admin', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  const page   = Number(req.query.page  || 1);
  const limit  = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  let qb = db('dfb_volunteer_applications');
  if (status) qb = qb.where({ status });

  const [{ total }] = await qb.clone().count('application_id as total');
  const apps = await qb.orderBy('submitted_at', 'desc').limit(limit).offset(offset)
    .select('application_id','applicant_name','applicant_email','city','country','status','review_notes','submitted_at','reviewed_at','motivation_statement','skills','availability');

  res.json({ success: true, data: apps, meta: { page, limit, total: Number(total) } });
});

// GET /api/v1/volunteer-applications/:id
volunteerApplicationsRouter.get('/:id', authenticate, requireRoles('Super Admin', 'Admin'), param('id').isInt().toInt(), async (req: Request, res: Response): Promise<void> => {
  const app = await db('dfb_volunteer_applications').where({ application_id: req.params.id as any }).first();
  if (!app) { res.status(404).json({ success: false, message: 'Application not found' }); return; }
  res.json({ success: true, data: app });
});

// POST /api/v1/volunteer-applications — Public endpoint (no auth)
volunteerApplicationsRouter.post('/',
  [
    body('applicantName').trim().notEmpty().isLength({ max: 160 }),
    body('applicantEmail').isEmail().normalizeEmail(),
    body('motivationStatement').optional().isString(),
    body('skills').optional().isString(),
    body('availability').optional().isString(),
    body('city').optional().trim().isLength({ max: 80 }),
    body('country').optional().trim().isLength({ max: 60 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { applicantName, applicantEmail, motivationStatement, skills, availability, city, country, referenceName, address } = req.body;

    const [id] = await db('dfb_volunteer_applications').insert({
      applicant_name:        applicantName,
      applicant_email:       applicantEmail,
      motivation_statement:  motivationStatement || null,
      skills:                skills ? JSON.stringify(skills) : null,
      availability:          availability || null,
      city:                  city || null,
      country:               country || null,
      reference_name:        referenceName || null,
      address:               address || null,
      status:                'pending',
      submitted_at:          new Date(),
      updated_at:            new Date(),
    });

    res.status(201).json({ success: true, data: { application_id: id }, message: 'Application submitted successfully.' });
  }
);

// PATCH /api/v1/volunteer-applications/:id/review — Approve / reject / put on waitlist
volunteerApplicationsRouter.patch('/:id/review',
  authenticate, requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  [
    body('status').isIn(['under_review','approved','rejected','waitlisted']),
    body('reviewNotes').optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { status, reviewNotes } = req.body;
    const appId = req.params.id as any;

    await db('dfb_volunteer_applications').where({ application_id: appId }).update({
      status,
      review_notes: reviewNotes || null,
      reviewed_by:  req.user!.userId,
      reviewed_at:  new Date(),
      updated_at:   new Date(),
    });

    // If approved, automatically create a volunteer record
    if (status === 'approved') {
      const app = await db('dfb_volunteer_applications').where({ application_id: appId }).first();
      const existing = await db('dfb_volunteers').where({ email: app.applicant_email }).first();
      if (!existing) {
        await db('dfb_volunteers').insert({
          first_name:   app.applicant_name.split(' ')[0] || app.applicant_name,
          last_name:    app.applicant_name.split(' ').slice(1).join(' ') || '',
          email:        app.applicant_email,
          city:         app.city || null,
          country:      app.country || null,
          skills:       app.skills || null,
          status:       'active',
          created_at:   new Date(),
          updated_at:   new Date(),
        });
      }
    }

    await writeAuditLog({ tableAffected: 'dfb_volunteer_applications', recordId: String(appId), actionType: 'UPDATE', newPayload: { status, reviewNotes }, actorId: req.user!.userId });
    res.json({ success: true, message: `Application ${status}` });
  }
);
