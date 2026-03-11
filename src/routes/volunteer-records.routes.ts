/**
 * Volunteer Records Routes
 * Handles: ID cards, Certificates, Volunteer Messages
 */
import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';

export const volunteerRecordsRouter = Router();

// ===========================================================================
// ID CARD TEMPLATES
// ===========================================================================

// GET /api/v1/volunteer-records/id-card-templates
volunteerRecordsRouter.get('/id-card-templates', authenticate, requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const templates = await db('dfb_id_card_templates').orderBy('created_at', 'desc');
    res.json({ success: true, data: templates });
  }
);

// POST /api/v1/volunteer-records/id-card-templates
volunteerRecordsRouter.post('/id-card-templates', authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('templateName').trim().notEmpty().isLength({ max: 80 }),
    body('orientation').optional().isIn(['horizontal', 'vertical']),
    body('backgroundColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('accentColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('orgName').optional().trim().isLength({ max: 120 }),
    body('tagline').optional().trim().isLength({ max: 80 }),
    body('validityDurationMonths').optional().isInt({ min: 1 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const [id] = await db('dfb_id_card_templates').insert({
      template_name:            req.body.templateName,
      orientation:              req.body.orientation || 'horizontal',
      background_color:         req.body.backgroundColor || '#ffffff',
      accent_color:             req.body.accentColor || '#2563eb',
      org_name:                 req.body.orgName || null,
      tagline:                  req.body.tagline || null,
      show_photo:               req.body.showPhoto !== false ? 1 : 0,
      show_badge_number:        req.body.showBadgeNumber !== false ? 1 : 0,
      show_designation:         req.body.showDesignation !== false ? 1 : 0,
      show_qr_code:             req.body.showQrCode !== false ? 1 : 0,
      validity_duration_months: req.body.validityDurationMonths || 12,
      is_active:                1,
      created_by:               req.user!.userId,
      created_at:               new Date(),
      updated_at:               new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_id_card_templates', recordId: String(id), actionType: 'INSERT', actorId: req.user!.userId });
    res.status(201).json({ success: true, message: 'ID card template created', data: { template_id: id } });
  }
);

// ===========================================================================
// VOLUNTEER ID CARDS — Issue a card to a volunteer
// ===========================================================================

// GET /api/v1/volunteer-records/id-cards
volunteerRecordsRouter.get('/id-cards', authenticate, requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const cards = await db('dfb_volunteer_id_cards as c')
      .join('dfb_volunteers as v', 'c.volunteer_id', 'v.volunteer_id')
      .join('dfb_id_card_templates as t', 'c.template_id', 't.template_id')
      .orderBy('c.issue_date', 'desc')
      .select(
        'c.*', 'v.first_name', 'v.last_name', 'v.badge_number',
        't.template_name'
      );
    res.json({ success: true, data: cards });
  }
);

// POST /api/v1/volunteer-records/id-cards — Issue a new ID card
volunteerRecordsRouter.post('/id-cards', authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('volunteerId').isInt({ min: 1 }).toInt(),
    body('templateId').isInt({ min: 1 }).toInt(),
    body('issueDate').isISO8601(),
    body('expiryDate').optional().isISO8601(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    // Check volunteer exists
    const volunteer = await db('dfb_volunteers').where({ volunteer_id: req.body.volunteerId }).first('volunteer_id', 'badge_number');
    if (!volunteer) { res.status(404).json({ success: false, message: 'Volunteer not found' }); return; }

    const cardId = uuidv4();
    await db('dfb_volunteer_id_cards').insert({
      card_id:        cardId,
      volunteer_id:   req.body.volunteerId,
      template_id:    req.body.templateId,
      badge_number:   volunteer.badge_number,
      issue_date:     req.body.issueDate,
      expiry_date:    req.body.expiryDate || null,
      status:         'active',
      generated_at:   new Date(),
      generated_by:   req.user!.userId,
    });

    await writeAuditLog({ tableAffected: 'dfb_volunteer_id_cards', recordId: cardId, actionType: 'INSERT', actorId: req.user!.userId });
    res.status(201).json({ success: true, message: 'ID card issued', data: { card_id: cardId } });
  }
);

// PATCH /api/v1/volunteer-records/id-cards/:cardId/revoke
volunteerRecordsRouter.patch('/id-cards/:cardId/revoke', authenticate, requireRoles('Super Admin', 'Admin'),
  param('cardId').isUUID(),
  body('revokedReason').optional().trim().isLength({ max: 500 }),
  async (req: Request, res: Response): Promise<void> => {
    await db('dfb_volunteer_id_cards').where({ card_id: req.params.cardId }).update({
      status:         'revoked',
      revoked_reason: req.body.revokedReason || null,
      revoked_by:     req.user!.userId,
      revoked_at:     new Date(),
    });
    await writeAuditLog({ tableAffected: 'dfb_volunteer_id_cards', recordId: String(req.params.cardId), actionType: 'UPDATE', actorId: req.user!.userId });
    res.json({ success: true, message: 'ID card revoked' });
  }
);

// ===========================================================================
// CERTIFICATE TEMPLATES
// ===========================================================================

// GET /api/v1/volunteer-records/certificate-templates
volunteerRecordsRouter.get('/certificate-templates', authenticate, requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const templates = await db('dfb_certificate_templates').orderBy('created_at', 'desc');
    res.json({ success: true, data: templates });
  }
);

// POST /api/v1/volunteer-records/certificate-templates
volunteerRecordsRouter.post('/certificate-templates', authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('templateName').trim().notEmpty().isLength({ max: 80 }),
    body('titleText').trim().notEmpty().isLength({ max: 120 }),
    body('bodyTemplate').trim().notEmpty(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const [id] = await db('dfb_certificate_templates').insert({
      template_name:  req.body.templateName,
      title_text:     req.body.titleText,
      body_template:  req.body.bodyTemplate,
      primary_color:  req.body.primaryColor || '#2563eb',
      is_active:      1,
      created_by:     req.user!.userId,
      created_at:     new Date(),
      updated_at:     new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_certificate_templates', recordId: String(id), actionType: 'INSERT', actorId: req.user!.userId });
    res.status(201).json({ success: true, message: 'Certificate template created', data: { cert_template_id: id } });
  }
);

// ===========================================================================
// CERTIFICATE AWARDS
// ===========================================================================

// GET /api/v1/volunteer-records/certificates
volunteerRecordsRouter.get('/certificates', authenticate, requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const awards = await db('dfb_certificate_awards as a')
      .join('dfb_volunteers as v', 'a.volunteer_id', 'v.volunteer_id')
      .join('dfb_certificate_templates as t', 'a.cert_template_id', 't.cert_template_id')
      .orderBy('a.issued_at', 'desc')
      .select('a.*', 'v.first_name', 'v.last_name', 'v.badge_number', 't.template_name', 't.title_text');
    res.json({ success: true, data: awards });
  }
);

// POST /api/v1/volunteer-records/certificates — Award a certificate
volunteerRecordsRouter.post('/certificates', authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('volunteerId').isInt({ min: 1 }).toInt(),
    body('certTemplateId').isInt({ min: 1 }).toInt(),
    body('issueDate').isISO8601(),
    body('hoursServed').optional().isInt({ min: 0 }).toInt(),
    body('customNote').optional().trim().isLength({ max: 2000 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const volunteer = await db('dfb_volunteers').where({ volunteer_id: req.body.volunteerId }).first('volunteer_id');
    if (!volunteer) { res.status(404).json({ success: false, message: 'Volunteer not found' }); return; }

    // Generate unique verification code
    const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase() + Date.now().toString(36).toUpperCase();

    const awardId = uuidv4();
    await db('dfb_certificate_awards').insert({
      award_id:          awardId,
      cert_template_id:  req.body.certTemplateId,
      volunteer_id:      req.body.volunteerId,
      project_id:        req.body.projectId || null,
      custom_note:       req.body.customNote || null,
      hours_served:      req.body.hoursServed || null,
      issue_date:        req.body.issueDate,
      verification_code: verificationCode,
      issued_by:         req.user!.userId,
      issued_at:         new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_certificate_awards', recordId: awardId, actionType: 'INSERT', actorId: req.user!.userId });
    res.status(201).json({ success: true, message: 'Certificate awarded', data: { award_id: awardId, verification_code: verificationCode } });
  }
);

// ===========================================================================
// VOLUNTEER MESSAGES
// ===========================================================================

// GET /api/v1/volunteer-records/messages — Admin: list all messages
volunteerRecordsRouter.get('/messages', authenticate, requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const messages = await db('dfb_volunteer_messages as m')
      .join('dfb_users as u', 'm.sender_user_id', 'u.user_id')
      .join('dfb_volunteers as v', 'm.recipient_volunteer_id', 'v.volunteer_id')
      .orderBy('m.sent_at', 'desc')
      .limit(100)
      .select('m.*', 'v.first_name', 'v.last_name', 'v.badge_number');
    res.json({ success: true, data: messages });
  }
);

// POST /api/v1/volunteer-records/messages — Send a message to a volunteer
volunteerRecordsRouter.post('/messages', authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('recipientVolunteerId').isInt({ min: 1 }).toInt(),
    body('subject').trim().notEmpty().isLength({ max: 150 }),
    body('body').trim().notEmpty().isLength({ max: 5000 }),
    body('channel').optional().isIn(['in_app', 'email', 'both']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const volunteer = await db('dfb_volunteers').where({ volunteer_id: req.body.recipientVolunteerId }).first('volunteer_id');
    if (!volunteer) { res.status(404).json({ success: false, message: 'Volunteer not found' }); return; }

    const messageId = uuidv4();
    await db('dfb_volunteer_messages').insert({
      message_id:             messageId,
      sender_user_id:         req.user!.userId,
      recipient_volunteer_id: req.body.recipientVolunteerId,
      subject:                req.body.subject,
      body:                   req.body.body,
      channel:                req.body.channel || 'in_app',
      is_read:                false,
      sent_at:                new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_volunteer_messages', recordId: messageId, actionType: 'INSERT', actorId: req.user!.userId });
    res.status(201).json({ success: true, message: 'Message sent', data: { message_id: messageId } });
  }
);

// GET /api/v1/volunteer-records/my-messages — Volunteer: read own messages
volunteerRecordsRouter.get('/my-messages', authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const volUser = await db('dfb_users').where({ user_id: req.user!.userId }).first('volunteer_id');
    if (!volUser?.volunteer_id) {
      res.status(403).json({ success: false, message: 'No volunteer profile linked to this account' });
      return;
    }

    const messages = await db('dfb_volunteer_messages')
      .where({ recipient_volunteer_id: volUser.volunteer_id })
      .orderBy('sent_at', 'desc')
      .limit(50)
      .select('*');

    res.json({ success: true, data: messages });
  }
);

// PATCH /api/v1/volunteer-records/my-messages/:messageId/read
volunteerRecordsRouter.patch('/my-messages/:messageId/read', authenticate, param('messageId').isUUID(),
  async (req: Request, res: Response): Promise<void> => {
    const volUser = await db('dfb_users').where({ user_id: req.user!.userId }).first('volunteer_id');
    if (!volUser?.volunteer_id) { res.status(403).json({ success: false, message: 'No volunteer profile' }); return; }

    await db('dfb_volunteer_messages')
      .where({ message_id: req.params.messageId, recipient_volunteer_id: volUser.volunteer_id })
      .update({ is_read: true, read_at: new Date() });

    res.json({ success: true, message: 'Marked as read' });
  }
);
