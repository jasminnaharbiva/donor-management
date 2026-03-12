import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const projectsRouter = Router();

type ProjectRow = {
  project_id: number;
  status: string;
  budget_allocated?: number;
  budget_spent?: number;
  budget_remaining?: number;
};

async function attachProjectInsights<T extends ProjectRow>(projects: T[]): Promise<Array<T & Record<string, unknown>>> {
  if (!projects.length) return projects;

  const projectIds = projects.map(project => project.project_id);
  const [assignmentRows, progressCountRows, progressRows] = await Promise.all([
    db('dfb_project_assignments')
      .whereIn('project_id', projectIds)
      .andWhere('status', 'active')
      .groupBy('project_id')
      .select('project_id')
      .count('assignment_id as volunteer_count'),
    db('dfb_project_progress_logs')
      .whereIn('project_id', projectIds)
      .groupBy('project_id')
      .select('project_id')
      .count('log_id as progress_log_count'),
    db('dfb_project_progress_logs')
      .whereIn('project_id', projectIds)
      .orderBy('happened_at', 'desc')
      .orderBy('log_id', 'desc')
      .select('project_id', 'progress_percent', 'update_type', 'update_title', 'update_body', 'status_snapshot', 'happened_at'),
  ]);

  const assignmentMap = new Map<number, number>();
  const progressCountMap = new Map<number, number>();
  const latestProgressMap = new Map<number, any>();

  assignmentRows.forEach((row: any) => assignmentMap.set(Number(row.project_id), Number(row.volunteer_count || 0)));
  progressCountRows.forEach((row: any) => progressCountMap.set(Number(row.project_id), Number(row.progress_log_count || 0)));
  progressRows.forEach((row: any) => {
    const projectId = Number(row.project_id);
    if (!latestProgressMap.has(projectId)) latestProgressMap.set(projectId, row);
  });

  return projects.map(project => {
    const latest = latestProgressMap.get(project.project_id);
    return {
      ...project,
      volunteer_count: assignmentMap.get(project.project_id) || 0,
      progress_log_count: progressCountMap.get(project.project_id) || 0,
      latest_progress_percent: latest ? Number(latest.progress_percent || 0) : null,
      latest_progress_type: latest?.update_type || null,
      latest_progress_title: latest?.update_title || null,
      latest_progress_body: latest?.update_body || null,
      latest_progress_status: latest?.status_snapshot || null,
      latest_progress_at: latest?.happened_at || null,
    };
  });
}

// GET /api/v1/projects
projectsRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const page   = Number(req.query.page  || 1);
  const limit  = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  let qb = db('dfb_projects as p')
    .leftJoin('dfb_campaigns as c', 'p.campaign_id', 'c.campaign_id')
    .leftJoin('dfb_funds as f', 'p.fund_id', 'f.fund_id');

  if (status) qb = qb.where('p.status', status);

  const [{ total }] = await qb.clone().count('p.project_id as total');
  const projects = await qb
    .orderBy('p.created_at', 'desc')
    .limit(limit).offset(offset)
    .select(
      'p.project_id', 'p.project_name', 'p.description', 'p.status',
      'p.budget_allocated', 'p.budget_spent', 'p.budget_remaining',
      'p.location_country', 'p.location_city',
      'p.start_date', 'p.target_completion_date', 'p.actual_completion_date',
      'p.created_at', 'p.updated_at', 'p.campaign_id', 'p.fund_id',
      'c.title as campaign_title', 'f.fund_name'
    );

  const enrichedProjects = await attachProjectInsights(projects as ProjectRow[]);

  res.json({ success: true, data: enrichedProjects, meta: { page, limit, total: Number(total) } });
});

// GET /api/v1/projects/:id
projectsRouter.get('/:id', authenticate, param('id').isInt().toInt(), async (req: Request, res: Response): Promise<void> => {
  const project = await db('dfb_projects').where({ project_id: req.params.id as any }).first();
  if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

  const [enrichedProject] = await attachProjectInsights([project as ProjectRow]);
  const progressLogs = await db('dfb_project_progress_logs')
    .where({ project_id: req.params.id as any })
    .orderBy('happened_at', 'desc')
    .orderBy('log_id', 'desc')
    .limit(10);

  res.json({ success: true, data: { ...enrichedProject, progress_logs: progressLogs } });
});

// POST /api/v1/projects
projectsRouter.post('/',
  authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('projectName').trim().notEmpty().isLength({ max: 200 }),
    body('fundId').isInt({ min: 1 }).toInt(),
    body('campaignId').optional().isInt({ min: 1 }).toInt(),
    body('budgetAllocated').optional().isFloat({ min: 0 }).toFloat(),
    body('status').optional().isIn(['planning','active','on_hold','completed','cancelled']),
    body('startDate').optional().isISO8601().toDate(),
    body('targetCompletionDate').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { projectName, fundId, campaignId, budgetAllocated, status, startDate, targetCompletionDate, locationCountry, locationCity, description } = req.body;

    const [id] = await db('dfb_projects').insert({
      project_name:            projectName,
      fund_id:                 fundId,
      campaign_id:             campaignId || null,
      budget_allocated:        budgetAllocated || 0,
      status:                  status || 'planning',
      start_date:              startDate || null,
      target_completion_date:  targetCompletionDate || null,
      location_country:        locationCountry || null,
      location_city:           locationCity || null,
      description:             description || null,
      created_by:              req.user!.userId,
      created_at:              new Date(),
      updated_at:              new Date(),
    });

    await db('dfb_project_progress_logs').insert({
      project_id:       id,
      update_type:      'field_update',
      update_title:     'Project created',
      update_body:      description || 'Initial project record created',
      progress_percent: 0,
      status_snapshot:  status || 'planning',
      logged_by:        req.user!.userId,
      happened_at:      new Date(),
      created_at:       new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_projects', recordId: String(id), actionType: 'INSERT', newPayload: { projectName }, actorId: req.user!.userId });
    res.status(201).json({ success: true, data: { project_id: id } });
  }
);

// PATCH /api/v1/projects/:id
projectsRouter.patch('/:id',
  authenticate, requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const allowed = ['project_name','description','fund_id','campaign_id','budget_allocated','status','start_date','target_completion_date','actual_completion_date','location_country','location_city'];
    const updates: Record<string, unknown> = {};

    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, (_,c) => c.toUpperCase());
      if (req.body[camel] !== undefined) updates[key] = req.body[camel];
      if (req.body[key]  !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date();

    await db('dfb_projects').where({ project_id: req.params.id as any }).update(updates);
    await writeAuditLog({ tableAffected: 'dfb_projects', recordId: String(req.params.id), actionType: 'UPDATE', newPayload: updates, actorId: req.user!.userId });
    res.json({ success: true, message: 'Project updated' });
  }
);

// DELETE /api/v1/projects/:id
projectsRouter.delete('/:id', authenticate, requireRoles('Super Admin'), param('id').isInt().toInt(), async (req: Request, res: Response): Promise<void> => {
  await db('dfb_projects').where({ project_id: req.params.id as any }).delete();
  await writeAuditLog({ tableAffected: 'dfb_projects', recordId: String(req.params.id), actionType: 'DELETE', actorId: req.user!.userId });
  res.json({ success: true, message: 'Project deleted' });
});

// ---------------------------------------------------------------------------
// GET /api/v1/projects/:id/progress-logs — List project progress logs
// POST /api/v1/projects/:id/progress-logs — Add append-only project progress update
// ---------------------------------------------------------------------------
projectsRouter.get('/:id/progress-logs', authenticate, param('id').isInt().toInt(), async (req: Request, res: Response): Promise<void> => {
  const project = await db('dfb_projects').where({ project_id: req.params.id as any }).first('project_id');
  if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

  const logs = await db('dfb_project_progress_logs')
    .where({ project_id: req.params.id as any })
    .orderBy('happened_at', 'desc')
    .orderBy('log_id', 'desc');

  res.json({ success: true, data: logs });
});

projectsRouter.post('/:id/progress-logs',
  authenticate, requireRoles('Super Admin', 'Admin', 'Finance'),
  [
    param('id').isInt().toInt(),
    body('updateTitle').trim().notEmpty().isLength({ max: 160 }),
    body('updateBody').optional().isString().isLength({ max: 4000 }),
    body('updateType').optional().isIn(['field_update', 'milestone', 'issue', 'note']),
    body('progressPercent').isInt({ min: 0, max: 100 }).toInt(),
    body('status').optional().isIn(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
    body('happenedAt').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const project = await db('dfb_projects').where({ project_id: req.params.id as any }).first('project_id', 'status');
    if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

    const statusSnapshot = req.body.status || project.status;
    const happenedAt = req.body.happenedAt || new Date();

    const [logId] = await db('dfb_project_progress_logs').insert({
      project_id:       req.params.id as any,
      update_type:      req.body.updateType || 'field_update',
      update_title:     req.body.updateTitle,
      update_body:      req.body.updateBody || null,
      progress_percent: req.body.progressPercent,
      status_snapshot:  statusSnapshot,
      logged_by:        req.user!.userId,
      happened_at:      happenedAt,
      created_at:       new Date(),
    });

    const projectUpdates: Record<string, unknown> = { updated_at: new Date() };
    if (req.body.status) {
      projectUpdates.status = req.body.status;
      projectUpdates.actual_completion_date = req.body.status === 'completed' ? happenedAt : null;
    }
    await db('dfb_projects').where({ project_id: req.params.id as any }).update(projectUpdates);

    await writeAuditLog({
      tableAffected: 'dfb_project_progress_logs',
      recordId: String(logId),
      actionType: 'INSERT',
      newPayload: { projectId: req.params.id, updateTitle: req.body.updateTitle, progressPercent: req.body.progressPercent, statusSnapshot },
      actorId: req.user!.userId,
    });

    res.status(201).json({ success: true, data: { log_id: logId }, message: 'Progress update logged' });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/projects/:id/assignments — List volunteer assignments for a project
// POST /api/v1/projects/:id/assignments — Assign a volunteer
// DELETE /api/v1/projects/:id/assignments/:assignmentId — Remove an assignment
// ---------------------------------------------------------------------------
projectsRouter.get('/:id/assignments', authenticate, requireRoles('Super Admin', 'Admin'), param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const assignments = await db('dfb_project_assignments as pa')
      .join('dfb_volunteers as v', 'pa.volunteer_id', 'v.volunteer_id')
      .where({ 'pa.project_id': req.params.id as any })
      .select('pa.*', 'v.first_name', 'v.last_name', 'v.badge_number');
    res.json({ success: true, data: assignments });
  }
);

projectsRouter.post('/:id/assignments', authenticate, requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  body('volunteerId').isInt({ min: 1 }).toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const exists = await db('dfb_project_assignments')
      .where({ project_id: req.params.id as any, volunteer_id: req.body.volunteerId }).first();
    if (exists) { res.status(409).json({ success: false, message: 'Volunteer already assigned to this project' }); return; }

    const [id] = await db('dfb_project_assignments').insert({
      project_id:   req.params.id as any,
      volunteer_id: req.body.volunteerId,
      assigned_at:  new Date(),
      assigned_by:  req.user!.userId,
      status:       'active',
    });
    await writeAuditLog({ tableAffected: 'dfb_project_assignments', recordId: String(id), actionType: 'INSERT', actorId: req.user!.userId });
    res.status(201).json({ success: true, message: 'Volunteer assigned', data: { assignment_id: id } });
  }
);

projectsRouter.delete('/:id/assignments/:assignmentId', authenticate, requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  param('assignmentId').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    await db('dfb_project_assignments').where({ assignment_id: req.params.assignmentId as any }).delete();
    await writeAuditLog({ tableAffected: 'dfb_project_assignments', recordId: String(req.params.assignmentId), actionType: 'DELETE', actorId: req.user!.userId });
    res.json({ success: true, message: 'Assignment removed' });
  }
);
