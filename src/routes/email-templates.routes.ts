import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const emailTemplatesRouter = Router();

// GET /api/v1/email-templates
emailTemplatesRouter.get('/', authenticate, requireRoles('Super Admin', 'Admin'), async (_req: Request, res: Response): Promise<void> => {
  const templates = await db('dfb_email_templates').orderBy('template_slug');
  res.json({ success: true, data: templates });
});

// GET /api/v1/email-templates/:slug
emailTemplatesRouter.get('/:slug', authenticate, requireRoles('Super Admin', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  const template = await db('dfb_email_templates').where({ template_slug: req.params.slug }).first();
  if (!template) { res.status(404).json({ success: false, message: 'Template not found' }); return; }
  res.json({ success: true, data: template });
});

// PATCH /api/v1/email-templates/:slug
emailTemplatesRouter.patch('/:slug',
  authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('subjectTemplate').optional().trim().isLength({ max: 255 }),
    body('htmlBody').optional().isString(),
    body('isActive').optional().isBoolean().toBoolean(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { subjectTemplate, htmlBody, isActive } = req.body;
    const updates: Record<string, unknown> = { updated_by: req.user!.userId, updated_at: new Date() };
    if (subjectTemplate !== undefined) updates.subject_template = subjectTemplate;
    if (htmlBody        !== undefined) updates.html_body        = htmlBody;
    if (isActive        !== undefined) updates.is_active        = isActive ? 1 : 0;

    await db('dfb_email_templates').where({ template_slug: req.params.slug }).update(updates);

    await writeAuditLog({ tableAffected: 'dfb_email_templates', recordId: String(req.params.slug), actionType: 'UPDATE', newPayload: { subjectTemplate }, actorId: req.user!.userId });
    res.json({ success: true, message: 'Email template updated' });
  }
);

// POST /api/v1/email-templates/:slug/test — Send test email using template
emailTemplatesRouter.post('/:slug/test',
  authenticate, requireRoles('Super Admin', 'Admin'),
  [body('to').isEmail().normalizeEmail()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const template = await db('dfb_email_templates').where({ template_slug: req.params.slug }).first();
    if (!template) { res.status(404).json({ success: false, message: 'Template not found' }); return; }

    const { sendEmail } = await import('../services/email.service');
    await sendEmail({
      to:      req.body.to,
      subject: `[TEST] ${template.subject_template}`,
      html:    template.html_body,
      text:    'Test email from DFB Admin Panel',
    });

    res.json({ success: true, message: `Test email sent to ${req.body.to}` });
  }
);
