import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { createHash } from 'crypto';
import { decrypt } from '../utils/crypto';

export const donorRecordsRouter = Router();

const safeJsonStringify = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const safeJsonParse = <T = any>(value: unknown, fallback: T): T => {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const sanitizeRichHtml = (html: string): string => {
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])javascript:[\s\S]*?\2/gi, '');
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const interpolateTemplate = (template: string, payload: Record<string, unknown>): string => {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, key: string) => {
    const value = payload[key];
    return value === null || value === undefined ? '' : escapeHtml(String(value));
  });
};

const toDateString = (value: Date): string => value.toISOString().split('T')[0];

const generateHash = (identifier: string, donorId: number | string, issueDate: string): string => {
  return createHash('sha256').update(`${identifier}|${donorId}|${issueDate}`).digest('hex');
};

const parseValidationErrors = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
};

const getLinkedDonorId = async (userId: string): Promise<number | null> => {
  const row = await db('dfb_users').where({ user_id: userId }).first('donor_id');
  return row?.donor_id ? Number(row.donor_id) : null;
};

const resolveDonorPayload = (donor: any) => {
  let phone = '';
  try {
    phone = donor.phone ? decrypt(String(donor.phone)) : '';
  } catch {
    phone = '';
  }

  return {
    donor_id: donor.donor_id,
    donor_ref: `DON-${String(donor.donor_id).padStart(6, '0')}`,
    donor_name: `${donor.first_name || ''} ${donor.last_name || ''}`.trim(),
    first_name: donor.first_name || '',
    last_name: donor.last_name || '',
    profession: donor.profession || '',
    country: donor.country || '',
    donor_type: donor.donor_type || '',
    mobile_number: phone,
  };
};

const buildIdCardHtml = (template: any, payload: Record<string, unknown>, qrDataUrl: string): string => {
  const dynamicFields = safeJsonParse<Array<{ key?: string; label?: string; staticText?: string; enabled?: boolean }>>(template.dynamic_fields_json, []);
  const textBlocks = safeJsonParse<Array<{ text?: string }>>(template.text_blocks_json, []);
  const activeFields = dynamicFields.filter((field) => field.enabled !== false);

  const defaultFields = [
    { label: 'Donor Ref', value: payload.donor_ref },
    { label: 'Name', value: payload.donor_name },
    { label: 'Profession', value: payload.profession },
    { label: 'Country', value: payload.country },
    { label: 'Issue Date', value: payload.issue_date },
    { label: 'Expiry', value: payload.expiry_date || 'N/A' },
  ];

  const renderedFields = activeFields.length
    ? activeFields.map((field) => {
        const key = String(field.key || '').trim();
        const value = key ? payload[key] : field.staticText || '';
        return `<div style="margin-bottom:4px;"><strong>${field.label || key || 'Field'}:</strong> ${value || ''}</div>`;
      })
    : defaultFields.map((row) => `<div style="margin-bottom:4px;"><strong>${row.label}:</strong> ${row.value || ''}</div>`);

  const renderedTextBlocks = textBlocks
    .map((block) => String(block?.text || '').trim())
    .filter(Boolean)
    .map((text) => `<div style="font-size:11px; opacity:0.85; margin-top:4px;">${interpolateTemplate(text, payload)}</div>`)
    .join('');

  return `
<div style="width:720px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;font-family:${template.font_family || 'Inter, Arial, sans-serif'};background:${template.background_color || '#ffffff'};color:${template.text_color || '#0f172a'};">
  <div style="background:${template.accent_color || '#2563eb'};color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-weight:700;font-size:18px;">${payload.org_name || 'Donor ID Card'}</div>
      <div style="font-size:12px;opacity:0.9;">${payload.tagline || ''}</div>
    </div>
    ${template.org_logo_url ? `<img src="${template.org_logo_url}" alt="logo" style="height:42px;max-width:120px;object-fit:contain;"/>` : ''}
  </div>
  <div style="padding:16px;display:grid;grid-template-columns:1fr 120px;gap:14px;align-items:start;">
    <div style="font-size:13px;line-height:1.4;">
      ${renderedFields.join('')}
      ${renderedTextBlocks}
    </div>
    <div style="text-align:center;">
      ${template.show_qr_code !== 0 ? `<img src="${qrDataUrl}" alt="qr" style="width:110px;height:110px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;"/>` : ''}
      <div style="font-size:10px;color:#475569;margin-top:6px;word-break:break-all;">${payload.card_id || ''}</div>
    </div>
  </div>
  <div style="padding:8px 16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
    <div style="font-size:11px;color:#475569;">${payload.footer_text || ''}</div>
    <div style="display:flex;gap:8px;align-items:center;">
      ${template.admin_signature_url ? `<img src="${template.admin_signature_url}" alt="signature" style="height:28px;max-width:100px;object-fit:contain;"/>` : ''}
      <div style="font-size:11px;text-align:right;color:#475569;">
        <div>${payload.admin_signature_name || ''}</div>
        <div>${payload.admin_signature_title || ''}</div>
      </div>
    </div>
  </div>
</div>`;
};

const buildCertificateHtml = (template: any, payload: Record<string, unknown>, qrDataUrl: string): string => {
  const bodyTemplate = String(template.body_template || '').trim();
  const fallbackBody = `
    <div style="text-align:center;">
      <h1 style="margin:0 0 10px 0;">${payload.title_text || 'Certificate of Appreciation'}</h1>
      <p style="margin:10px 0;">This certificate is awarded to</p>
      <h2 style="margin:10px 0;">${payload.donor_name || ''}</h2>
      <p style="margin:10px 0;">For valued contribution and support</p>
      <p style="margin:10px 0;">Issue Date: ${payload.issue_date || ''}</p>
      <p style="margin:10px 0;">Verification Code: ${payload.verification_code || ''}</p>
    </div>
  `;

  const renderedBody = interpolateTemplate(sanitizeRichHtml(bodyTemplate || fallbackBody), payload);

  return `
<div style="width:1080px;min-height:760px;border:12px solid ${template.primary_color || '#2563eb'};padding:28px 40px;background:#ffffff;font-family:Inter, Arial, sans-serif;position:relative;">
  ${template.background_image_url ? `<img src="${template.background_image_url}" alt="bg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.08;"/>` : ''}
  <div style="position:relative;z-index:2;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      ${template.org_logo_url ? `<img src="${template.org_logo_url}" alt="logo" style="height:64px;max-width:180px;object-fit:contain;"/>` : '<div></div>'}
      <div style="font-size:12px;color:#334155;">Code: ${payload.verification_code || ''}</div>
    </div>
    <div style="margin-top:20px;">${renderedBody}</div>
    <div style="margin-top:28px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        ${template.admin_signature_1_url ? `<img src="${template.admin_signature_1_url}" alt="signature1" style="height:48px;max-width:200px;object-fit:contain;"/>` : ''}
        <div style="font-size:12px;color:#334155;">${template.admin_signature_1_name || ''}</div>
        <div style="font-size:11px;color:#64748b;">${template.admin_signature_1_title || ''}</div>
      </div>
      <div style="text-align:center;">
        <img src="${qrDataUrl}" alt="qr" style="width:130px;height:130px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;"/>
        <div style="font-size:10px;color:#64748b;margin-top:4px;word-break:break-all;">${payload.verification_url || ''}</div>
      </div>
      <div style="text-align:right;">
        ${template.admin_signature_2_url ? `<img src="${template.admin_signature_2_url}" alt="signature2" style="height:48px;max-width:200px;object-fit:contain;"/>` : ''}
        <div style="font-size:12px;color:#334155;">${template.admin_signature_2_name || ''}</div>
        <div style="font-size:11px;color:#64748b;">${template.admin_signature_2_title || ''}</div>
      </div>
    </div>
  </div>
</div>`;
};

donorRecordsRouter.get('/id-card-templates', authenticate, requireRoles('Super Admin', 'Admin'), async (_req: Request, res: Response): Promise<void> => {
  const templates = await db('dfb_donor_id_card_templates').orderBy('created_at', 'desc');
  res.json({ success: true, data: templates });
});

donorRecordsRouter.post('/id-card-templates', authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('templateName').trim().notEmpty().isLength({ max: 80 }),
    body('orientation').optional().isIn(['horizontal', 'vertical']),
    body('backgroundColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('accentColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('textColor').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('orgName').optional().trim().isLength({ max: 120 }),
    body('tagline').optional().trim().isLength({ max: 80 }),
    body('orgLogoUrl').optional().trim().isLength({ max: 500 }),
    body('adminSignatureUrl').optional().trim().isLength({ max: 500 }),
    body('adminSignatureName').optional().trim().isLength({ max: 80 }),
    body('adminSignatureTitle').optional().trim().isLength({ max: 80 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (parseValidationErrors(req, res)) return;

    const [id] = await db('dfb_donor_id_card_templates').insert({
      template_name: req.body.templateName,
      orientation: req.body.orientation || 'horizontal',
      background_color: req.body.backgroundColor || '#ffffff',
      accent_color: req.body.accentColor || '#2563eb',
      text_color: req.body.textColor || '#0f172a',
      org_logo_url: req.body.orgLogoUrl || null,
      org_name: req.body.orgName || null,
      tagline: req.body.tagline || null,
      show_photo: req.body.showPhoto !== false ? 1 : 0,
      show_donor_id: req.body.showDonorId !== false ? 1 : 0,
      show_profession: req.body.showProfession !== false ? 1 : 0,
      show_country: req.body.showCountry !== false ? 1 : 0,
      show_validity_date: req.body.showValidityDate !== false ? 1 : 0,
      show_qr_code: req.body.showQrCode !== false ? 1 : 0,
      qr_base_url: req.body.qrBaseUrl || '/donor/records/id/{{card_id}}',
      validity_duration_months: req.body.validityDurationMonths || 12,
      admin_signature_url: req.body.adminSignatureUrl || null,
      admin_signature_name: req.body.adminSignatureName || null,
      admin_signature_title: req.body.adminSignatureTitle || null,
      footer_text: req.body.footerText || null,
      font_family: req.body.fontFamily || 'Inter, Arial, sans-serif',
      layout_json: safeJsonStringify(req.body.layoutJson),
      dynamic_fields_json: safeJsonStringify(req.body.dynamicFieldsJson),
      text_blocks_json: safeJsonStringify(req.body.textBlocksJson),
      logo_position_json: safeJsonStringify(req.body.logoPositionJson),
      signature_position_json: safeJsonStringify(req.body.signaturePositionJson),
      is_active: req.body.isActive ?? true ? 1 : 0,
      created_by: req.user!.userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_donor_id_card_templates', recordId: String(id), actionType: 'INSERT', actorId: req.user!.userId });
    res.status(201).json({ success: true, data: { template_id: id } });
  }
);

donorRecordsRouter.put('/id-card-templates/:templateId', authenticate, requireRoles('Super Admin', 'Admin'),
  [param('templateId').isInt({ min: 1 }).toInt()],
  async (req: Request, res: Response): Promise<void> => {
    if (parseValidationErrors(req, res)) return;

    const templateId = Number(req.params.templateId);
    const found = await db('dfb_donor_id_card_templates').where({ template_id: templateId }).first('template_id');
    if (!found) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }

    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (req.body.templateName !== undefined) patch.template_name = req.body.templateName;
    if (req.body.orientation !== undefined) patch.orientation = req.body.orientation;
    if (req.body.backgroundColor !== undefined) patch.background_color = req.body.backgroundColor;
    if (req.body.accentColor !== undefined) patch.accent_color = req.body.accentColor;
    if (req.body.textColor !== undefined) patch.text_color = req.body.textColor;
    if (req.body.orgName !== undefined) patch.org_name = req.body.orgName || null;
    if (req.body.tagline !== undefined) patch.tagline = req.body.tagline || null;
    if (req.body.orgLogoUrl !== undefined) patch.org_logo_url = req.body.orgLogoUrl || null;
    if (req.body.adminSignatureUrl !== undefined) patch.admin_signature_url = req.body.adminSignatureUrl || null;
    if (req.body.adminSignatureName !== undefined) patch.admin_signature_name = req.body.adminSignatureName || null;
    if (req.body.adminSignatureTitle !== undefined) patch.admin_signature_title = req.body.adminSignatureTitle || null;
    if (req.body.footerText !== undefined) patch.footer_text = req.body.footerText || null;
    if (req.body.fontFamily !== undefined) patch.font_family = req.body.fontFamily || 'Inter, Arial, sans-serif';
    if (req.body.qrBaseUrl !== undefined) patch.qr_base_url = req.body.qrBaseUrl || '/donor/records/id/{{card_id}}';
    if (req.body.showPhoto !== undefined) patch.show_photo = req.body.showPhoto ? 1 : 0;
    if (req.body.showDonorId !== undefined) patch.show_donor_id = req.body.showDonorId ? 1 : 0;
    if (req.body.showProfession !== undefined) patch.show_profession = req.body.showProfession ? 1 : 0;
    if (req.body.showCountry !== undefined) patch.show_country = req.body.showCountry ? 1 : 0;
    if (req.body.showValidityDate !== undefined) patch.show_validity_date = req.body.showValidityDate ? 1 : 0;
    if (req.body.showQrCode !== undefined) patch.show_qr_code = req.body.showQrCode ? 1 : 0;
    if (req.body.validityDurationMonths !== undefined) patch.validity_duration_months = req.body.validityDurationMonths;
    if (req.body.isActive !== undefined) patch.is_active = req.body.isActive ? 1 : 0;
    if (req.body.layoutJson !== undefined) patch.layout_json = safeJsonStringify(req.body.layoutJson);
    if (req.body.dynamicFieldsJson !== undefined) patch.dynamic_fields_json = safeJsonStringify(req.body.dynamicFieldsJson);
    if (req.body.textBlocksJson !== undefined) patch.text_blocks_json = safeJsonStringify(req.body.textBlocksJson);
    if (req.body.logoPositionJson !== undefined) patch.logo_position_json = safeJsonStringify(req.body.logoPositionJson);
    if (req.body.signaturePositionJson !== undefined) patch.signature_position_json = safeJsonStringify(req.body.signaturePositionJson);

    await db('dfb_donor_id_card_templates').where({ template_id: templateId }).update(patch);
    const updated = await db('dfb_donor_id_card_templates').where({ template_id: templateId }).first();
    res.json({ success: true, data: updated });
  }
);

donorRecordsRouter.delete('/id-card-templates/:templateId', authenticate, requireRoles('Super Admin', 'Admin'), [param('templateId').isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;
  const templateId = Number(req.params.templateId);
  const linked = await db('dfb_donor_id_cards').where({ template_id: templateId }).count('* as total').first();
  if (Number((linked as any)?.total || 0) > 0) {
    res.status(409).json({ success: false, message: 'Template is already used by issued cards and cannot be deleted' });
    return;
  }
  const deleted = await db('dfb_donor_id_card_templates').where({ template_id: templateId }).delete();
  if (!deleted) {
    res.status(404).json({ success: false, message: 'Template not found' });
    return;
  }
  res.json({ success: true, message: 'Template deleted' });
});

donorRecordsRouter.post('/id-card-templates/:templateId/preview', authenticate, requireRoles('Super Admin', 'Admin'), [param('templateId').isInt({ min: 1 }).toInt(), body('donorId').optional().isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;

  const template = await db('dfb_donor_id_card_templates').where({ template_id: Number(req.params.templateId) }).first();
  if (!template) {
    res.status(404).json({ success: false, message: 'Template not found' });
    return;
  }

  const donor = req.body.donorId
    ? await db('dfb_donors').where({ donor_id: req.body.donorId }).first()
    : await db('dfb_donors').whereNull('deleted_at').orderBy('donor_id', 'asc').first();

  if (!donor) {
    res.status(404).json({ success: false, message: 'No donor found for preview' });
    return;
  }

  const card = {
    card_id: uuidv4(),
    issue_date: toDateString(new Date()),
    expiry_date: toDateString(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
  };

  const payload = { ...resolveDonorPayload(donor), ...card, org_name: template.org_name || '', tagline: template.tagline || '', footer_text: template.footer_text || '', admin_signature_name: template.admin_signature_name || '', admin_signature_title: template.admin_signature_title || '' };
  const qrTarget = interpolateTemplate(template.qr_base_url || '/donor/records/id/{{card_id}}', payload);
  const qrData = await QRCode.toDataURL(qrTarget, { errorCorrectionLevel: 'H', margin: 1, width: 260 });
  const html = buildIdCardHtml(template, payload, qrData);

  res.json({ success: true, data: { qr_code_value: qrTarget, qr_code_data_url: qrData, render_payload: payload, rendered_html: html } });
});

donorRecordsRouter.get('/id-cards', authenticate, requireRoles('Super Admin', 'Admin'), async (_req: Request, res: Response): Promise<void> => {
  const cards = await db('dfb_donor_id_cards as c')
    .join('dfb_donors as d', 'c.donor_id', 'd.donor_id')
    .join('dfb_donor_id_card_templates as t', 'c.template_id', 't.template_id')
    .orderBy('c.issue_date', 'desc')
    .select('c.*', 'd.first_name', 'd.last_name', 'd.country', 'd.profession', 't.template_name', 't.org_name');
  res.json({ success: true, data: cards });
});

donorRecordsRouter.post('/id-cards', authenticate, requireRoles('Super Admin', 'Admin'),
  [body('donorId').isInt({ min: 1 }).toInt(), body('templateId').isInt({ min: 1 }).toInt(), body('issueDate').isISO8601(), body('expiryDate').optional().isISO8601(), body('dynamicValues').optional()],
  async (req: Request, res: Response): Promise<void> => {
    if (parseValidationErrors(req, res)) return;

    const donor = await db('dfb_donors').where({ donor_id: req.body.donorId }).first();
    if (!donor) {
      res.status(404).json({ success: false, message: 'Donor not found' });
      return;
    }

    const template = await db('dfb_donor_id_card_templates').where({ template_id: req.body.templateId }).first();
    if (!template) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }

    const issueDate = String(req.body.issueDate);
    let expiryDate = req.body.expiryDate ? String(req.body.expiryDate) : null;
    if (!expiryDate && Number(template.validity_duration_months || 0) > 0) {
      const d = new Date(issueDate);
      d.setMonth(d.getMonth() + Number(template.validity_duration_months || 12));
      expiryDate = toDateString(d);
    }

    await db('dfb_donor_id_cards').where({ donor_id: req.body.donorId, status: 'active' }).update({
      status: 'revoked',
      revoked_reason: 'Auto replaced by latest card issuance',
      revoked_by: req.user!.userId,
      revoked_at: new Date(),
    });

    const cardId = uuidv4();
    const payload = {
      ...resolveDonorPayload(donor),
      card_id: cardId,
      issue_date: issueDate,
      expiry_date: expiryDate,
      org_name: template.org_name || '',
      tagline: template.tagline || '',
      footer_text: template.footer_text || '',
      admin_signature_name: template.admin_signature_name || '',
      admin_signature_title: template.admin_signature_title || '',
      ...(req.body.dynamicValues || {}),
    };

    const qrCodeValue = interpolateTemplate(template.qr_base_url || '/donor/records/id/{{card_id}}', payload);
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeValue, { errorCorrectionLevel: 'H', margin: 1, width: 260 });
    const renderedHtml = buildIdCardHtml(template, payload, qrCodeDataUrl);

    await db('dfb_donor_id_cards').insert({
      card_id: cardId,
      donor_id: req.body.donorId,
      template_id: req.body.templateId,
      donor_ref: payload.donor_ref,
      issue_date: issueDate,
      expiry_date: expiryDate,
      status: expiryDate && new Date(expiryDate) < new Date() ? 'expired' : 'active',
      qr_code_value: qrCodeValue,
      qr_code_data_url: qrCodeDataUrl,
      template_snapshot_json: JSON.stringify(template),
      render_payload_json: JSON.stringify(payload),
      rendered_html: renderedHtml,
      generated_at: new Date(),
      generated_by: req.user!.userId,
    });

    await writeAuditLog({ tableAffected: 'dfb_donor_id_cards', recordId: cardId, actionType: 'INSERT', actorId: req.user!.userId });
    res.status(201).json({ success: true, data: { card_id: cardId, qr_code_value: qrCodeValue, qr_code_data_url: qrCodeDataUrl, rendered_html: renderedHtml } });
  }
);

donorRecordsRouter.patch('/id-cards/:cardId/revoke', authenticate, requireRoles('Super Admin', 'Admin'), [param('cardId').isUUID()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;
  await db('dfb_donor_id_cards').where({ card_id: req.params.cardId }).update({
    status: 'revoked',
    revoked_reason: req.body.revokedReason || null,
    revoked_by: req.user!.userId,
    revoked_at: new Date(),
  });
  res.json({ success: true, message: 'Card revoked' });
});

donorRecordsRouter.get('/id-cards/:cardId/render', authenticate, requireRoles('Super Admin', 'Admin'), [param('cardId').isUUID()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;

  const card = await db('dfb_donor_id_cards as c')
    .join('dfb_donors as d', 'c.donor_id', 'd.donor_id')
    .join('dfb_donor_id_card_templates as t', 'c.template_id', 't.template_id')
    .where({ 'c.card_id': req.params.cardId })
    .first('c.*', 'd.first_name', 'd.last_name', 'd.country', 'd.profession', 'd.phone', 't.*');

  if (!card) {
    res.status(404).json({ success: false, message: 'Card not found' });
    return;
  }

  const payload = safeJsonParse<Record<string, unknown>>(card.render_payload_json, {});
  const qrData = card.qr_code_data_url || await QRCode.toDataURL(String(card.qr_code_value || ''), { errorCorrectionLevel: 'H', margin: 1, width: 260 });
  const renderedHtml = card.rendered_html || buildIdCardHtml(card, payload, qrData);
  res.json({ success: true, data: { ...card, render_payload: payload, qr_code_data_url: qrData, rendered_html: renderedHtml } });
});

donorRecordsRouter.get('/certificate-templates', authenticate, requireRoles('Super Admin', 'Admin'), async (_req: Request, res: Response): Promise<void> => {
  const templates = await db('dfb_donor_certificate_templates').orderBy('created_at', 'desc');
  res.json({ success: true, data: templates });
});

donorRecordsRouter.post('/certificate-templates', authenticate, requireRoles('Super Admin', 'Admin'),
  [body('templateName').trim().notEmpty().isLength({ max: 80 }), body('titleText').trim().notEmpty().isLength({ max: 120 }), body('bodyTemplate').trim().notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    if (parseValidationErrors(req, res)) return;

    const [id] = await db('dfb_donor_certificate_templates').insert({
      template_name: req.body.templateName,
      title_text: req.body.titleText,
      body_template: req.body.bodyTemplate,
      primary_color: req.body.primaryColor || '#2563eb',
      background_image_url: req.body.backgroundImageUrl || null,
      org_logo_url: req.body.orgLogoUrl || null,
      admin_signature_1_url: req.body.adminSignature1Url || null,
      admin_signature_1_name: req.body.adminSignature1Name || null,
      admin_signature_1_title: req.body.adminSignature1Title || null,
      admin_signature_2_url: req.body.adminSignature2Url || null,
      admin_signature_2_name: req.body.adminSignature2Name || null,
      admin_signature_2_title: req.body.adminSignature2Title || null,
      layout_json: safeJsonStringify(req.body.layoutJson),
      dynamic_fields_json: safeJsonStringify(req.body.dynamicFieldsJson),
      text_blocks_json: safeJsonStringify(req.body.textBlocksJson),
      is_active: req.body.isActive ?? true ? 1 : 0,
      created_by: req.user!.userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    res.status(201).json({ success: true, data: { cert_template_id: id } });
  }
);

donorRecordsRouter.put('/certificate-templates/:templateId', authenticate, requireRoles('Super Admin', 'Admin'), [param('templateId').isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;

  const templateId = Number(req.params.templateId);
  const found = await db('dfb_donor_certificate_templates').where({ cert_template_id: templateId }).first('cert_template_id');
  if (!found) {
    res.status(404).json({ success: false, message: 'Template not found' });
    return;
  }

  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (req.body.templateName !== undefined) patch.template_name = req.body.templateName;
  if (req.body.titleText !== undefined) patch.title_text = req.body.titleText;
  if (req.body.bodyTemplate !== undefined) patch.body_template = req.body.bodyTemplate;
  if (req.body.primaryColor !== undefined) patch.primary_color = req.body.primaryColor;
  if (req.body.backgroundImageUrl !== undefined) patch.background_image_url = req.body.backgroundImageUrl || null;
  if (req.body.orgLogoUrl !== undefined) patch.org_logo_url = req.body.orgLogoUrl || null;
  if (req.body.adminSignature1Url !== undefined) patch.admin_signature_1_url = req.body.adminSignature1Url || null;
  if (req.body.adminSignature1Name !== undefined) patch.admin_signature_1_name = req.body.adminSignature1Name || null;
  if (req.body.adminSignature1Title !== undefined) patch.admin_signature_1_title = req.body.adminSignature1Title || null;
  if (req.body.adminSignature2Url !== undefined) patch.admin_signature_2_url = req.body.adminSignature2Url || null;
  if (req.body.adminSignature2Name !== undefined) patch.admin_signature_2_name = req.body.adminSignature2Name || null;
  if (req.body.adminSignature2Title !== undefined) patch.admin_signature_2_title = req.body.adminSignature2Title || null;
  if (req.body.layoutJson !== undefined) patch.layout_json = safeJsonStringify(req.body.layoutJson);
  if (req.body.dynamicFieldsJson !== undefined) patch.dynamic_fields_json = safeJsonStringify(req.body.dynamicFieldsJson);
  if (req.body.textBlocksJson !== undefined) patch.text_blocks_json = safeJsonStringify(req.body.textBlocksJson);
  if (req.body.isActive !== undefined) patch.is_active = req.body.isActive ? 1 : 0;

  await db('dfb_donor_certificate_templates').where({ cert_template_id: templateId }).update(patch);
  const updated = await db('dfb_donor_certificate_templates').where({ cert_template_id: templateId }).first();
  res.json({ success: true, data: updated });
});

donorRecordsRouter.delete('/certificate-templates/:templateId', authenticate, requireRoles('Super Admin', 'Admin'), [param('templateId').isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;

  const templateId = Number(req.params.templateId);
  const linked = await db('dfb_donor_certificate_awards').where({ cert_template_id: templateId }).count('* as total').first();
  if (Number((linked as any)?.total || 0) > 0) {
    res.status(409).json({ success: false, message: 'Template is already used by certificates and cannot be deleted' });
    return;
  }

  const deleted = await db('dfb_donor_certificate_templates').where({ cert_template_id: templateId }).delete();
  if (!deleted) {
    res.status(404).json({ success: false, message: 'Template not found' });
    return;
  }

  res.json({ success: true, message: 'Template deleted' });
});

donorRecordsRouter.post('/certificate-templates/:templateId/preview', authenticate, requireRoles('Super Admin', 'Admin'), [param('templateId').isInt({ min: 1 }).toInt(), body('donorId').optional().isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;

  const template = await db('dfb_donor_certificate_templates').where({ cert_template_id: Number(req.params.templateId) }).first();
  if (!template) {
    res.status(404).json({ success: false, message: 'Template not found' });
    return;
  }

  const donor = req.body.donorId
    ? await db('dfb_donors').where({ donor_id: req.body.donorId }).first()
    : await db('dfb_donors').whereNull('deleted_at').orderBy('donor_id', 'asc').first();

  if (!donor) {
    res.status(404).json({ success: false, message: 'No donor found for preview' });
    return;
  }

  const verificationCode = `PREVIEW-${Date.now().toString(36).toUpperCase()}`;
  const award = {
    award_id: uuidv4(),
    issue_date: toDateString(new Date()),
    verification_code: verificationCode,
    custom_note: 'Template preview render',
    verification_url: `/donor/certificate/${verificationCode}`,
  };

  const payload = { ...resolveDonorPayload(donor), ...award, title_text: template.title_text };
  const qrData = await QRCode.toDataURL(String(payload.verification_url), { errorCorrectionLevel: 'H', margin: 1, width: 260 });
  const html = buildCertificateHtml(template, payload, qrData);

  res.json({ success: true, data: { qr_code_value: payload.verification_url, qr_code_data_url: qrData, render_payload: payload, rendered_html: html } });
});

donorRecordsRouter.get('/certificates', authenticate, requireRoles('Super Admin', 'Admin'), async (_req: Request, res: Response): Promise<void> => {
  const awards = await db('dfb_donor_certificate_awards as a')
    .join('dfb_donors as d', 'a.donor_id', 'd.donor_id')
    .join('dfb_donor_certificate_templates as t', 'a.cert_template_id', 't.cert_template_id')
    .orderBy('a.issue_date', 'desc')
    .select('a.*', 'd.first_name', 'd.last_name', 'd.country', 'd.profession', 't.template_name', 't.title_text', 't.primary_color');
  res.json({ success: true, data: awards });
});

donorRecordsRouter.post('/certificates', authenticate, requireRoles('Super Admin', 'Admin'),
  [body('donorId').isInt({ min: 1 }).toInt(), body('certTemplateId').isInt({ min: 1 }).toInt(), body('issueDate').isISO8601(), body('customNote').optional().trim().isLength({ max: 2000 }), body('expiresAt').optional().isISO8601(), body('dynamicValues').optional()],
  async (req: Request, res: Response): Promise<void> => {
    if (parseValidationErrors(req, res)) return;

    const donor = await db('dfb_donors').where({ donor_id: req.body.donorId }).first();
    if (!donor) {
      res.status(404).json({ success: false, message: 'Donor not found' });
      return;
    }

    const template = await db('dfb_donor_certificate_templates').where({ cert_template_id: req.body.certTemplateId }).first();
    if (!template) {
      res.status(404).json({ success: false, message: 'Template not found' });
      return;
    }

    const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase() + Date.now().toString(36).toUpperCase();
    const awardId = uuidv4();
    const issueDate = String(req.body.issueDate);
    const verificationUrl = `/donor/certificate/${verificationCode}`;

    const payload = {
      ...resolveDonorPayload(donor),
      award_id: awardId,
      issue_date: issueDate,
      verification_code: verificationCode,
      custom_note: req.body.customNote || '',
      verification_url: verificationUrl,
      title_text: template.title_text,
      ...(req.body.dynamicValues || {}),
    };

    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: 'H', margin: 1, width: 260 });
    const renderedHtml = buildCertificateHtml(template, payload, qrCodeDataUrl);
    const certificateHash = generateHash(verificationCode, req.body.donorId, issueDate);

    await db('dfb_donor_certificate_awards').insert({
      award_id: awardId,
      cert_template_id: req.body.certTemplateId,
      donor_id: req.body.donorId,
      project_id: req.body.projectId || null,
      custom_note: req.body.customNote || null,
      impact_units: req.body.impactUnits || null,
      issue_date: issueDate,
      expires_at: req.body.expiresAt || null,
      verification_code: verificationCode,
      verification_url: verificationUrl,
      certificate_hash: certificateHash,
      qr_code_value: verificationUrl,
      qr_code_data_url: qrCodeDataUrl,
      template_snapshot_json: JSON.stringify(template),
      render_payload_json: JSON.stringify(payload),
      rendered_html: renderedHtml,
      issued_by: req.user!.userId,
      issued_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });

    res.status(201).json({ success: true, data: { award_id: awardId, verification_code: verificationCode, verification_url: verificationUrl, qr_code_data_url: qrCodeDataUrl, certificate_hash: certificateHash, rendered_html: renderedHtml } });
  }
);

donorRecordsRouter.get('/certificates/:awardId/render', authenticate, requireRoles('Super Admin', 'Admin'), [param('awardId').isUUID()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;

  const award = await db('dfb_donor_certificate_awards as a')
    .join('dfb_donors as d', 'a.donor_id', 'd.donor_id')
    .join('dfb_donor_certificate_templates as t', 'a.cert_template_id', 't.cert_template_id')
    .where({ 'a.award_id': req.params.awardId })
    .first('a.*', 'd.first_name', 'd.last_name', 'd.country', 'd.profession', 'd.phone', 't.*');

  if (!award) {
    res.status(404).json({ success: false, message: 'Certificate not found' });
    return;
  }

  const payload = safeJsonParse<Record<string, unknown>>(award.render_payload_json, {});
  const qrData = award.qr_code_data_url || await QRCode.toDataURL(String(award.qr_code_value || award.verification_url || ''), { errorCorrectionLevel: 'H', margin: 1, width: 260 });
  const renderedHtml = award.rendered_html || buildCertificateHtml(award, payload, qrData);
  res.json({ success: true, data: { ...award, render_payload: payload, qr_code_data_url: qrData, rendered_html: renderedHtml } });
});

donorRecordsRouter.get('/messages', authenticate, requireRoles('Super Admin', 'Admin'), async (_req: Request, res: Response): Promise<void> => {
  const messages = await db('dfb_donor_messages as m')
    .join('dfb_donors as d', 'm.recipient_donor_id', 'd.donor_id')
    .orderBy('m.sent_at', 'desc')
    .limit(100)
    .select('m.*', 'd.first_name', 'd.last_name', 'd.profession', 'd.country');
  res.json({ success: true, data: messages });
});

donorRecordsRouter.post('/messages', authenticate, requireRoles('Super Admin', 'Admin'), [body('recipientDonorId').isInt({ min: 1 }).toInt(), body('subject').trim().notEmpty().isLength({ max: 150 }), body('body').trim().notEmpty().isLength({ max: 5000 }), body('channel').optional().isIn(['in_app', 'email', 'both'])], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;

  const donor = await db('dfb_donors').where({ donor_id: req.body.recipientDonorId }).first('donor_id');
  if (!donor) {
    res.status(404).json({ success: false, message: 'Donor not found' });
    return;
  }

  const messageId = uuidv4();
  await db('dfb_donor_messages').insert({
    message_id: messageId,
    sender_user_id: req.user!.userId,
    recipient_donor_id: req.body.recipientDonorId,
    subject: req.body.subject,
    body: req.body.body,
    channel: req.body.channel || 'in_app',
    is_read: false,
    sent_at: new Date(),
  });

  await writeAuditLog({ tableAffected: 'dfb_donor_messages', recordId: messageId, actionType: 'INSERT', actorId: req.user!.userId });
  res.status(201).json({ success: true, data: { message_id: messageId } });
});

donorRecordsRouter.get('/my/id-cards', authenticate, async (req: Request, res: Response): Promise<void> => {
  const donorId = await getLinkedDonorId(req.user!.userId);
  if (!donorId) {
    res.status(403).json({ success: false, message: 'No donor profile linked to this account' });
    return;
  }

  const cards = await db('dfb_donor_id_cards as c')
    .join('dfb_donor_id_card_templates as t', 'c.template_id', 't.template_id')
    .where('c.donor_id', donorId)
    .orderBy('c.issue_date', 'desc')
    .select('c.card_id', 'c.issue_date', 'c.expiry_date', 'c.status', 'c.revoked_reason', 'c.revoked_at', 'c.qr_code_data_url', 't.template_name');

  res.json({ success: true, data: cards });
});

donorRecordsRouter.get('/my/id-cards/:cardId/render', authenticate, [param('cardId').isUUID()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;
  const donorId = await getLinkedDonorId(req.user!.userId);
  if (!donorId) {
    res.status(403).json({ success: false, message: 'No donor profile linked to this account' });
    return;
  }

  const card = await db('dfb_donor_id_cards').where({ card_id: req.params.cardId, donor_id: donorId }).first();
  if (!card) {
    res.status(404).json({ success: false, message: 'Card not found' });
    return;
  }

  res.json({ success: true, data: { card_id: card.card_id, rendered_html: card.rendered_html, qr_code_data_url: card.qr_code_data_url } });
});

donorRecordsRouter.get('/my/certificates', authenticate, async (req: Request, res: Response): Promise<void> => {
  const donorId = await getLinkedDonorId(req.user!.userId);
  if (!donorId) {
    res.status(403).json({ success: false, message: 'No donor profile linked to this account' });
    return;
  }

  const certs = await db('dfb_donor_certificate_awards as a')
    .join('dfb_donor_certificate_templates as t', 'a.cert_template_id', 't.cert_template_id')
    .where('a.donor_id', donorId)
    .orderBy('a.issue_date', 'desc')
    .select('a.award_id', 'a.issue_date', 'a.expires_at', 'a.revoked_at', 'a.verification_code', 'a.verification_url', 'a.qr_code_data_url', 't.template_name', 't.title_text');

  res.json({ success: true, data: certs });
});

donorRecordsRouter.get('/my/certificates/:awardId/render', authenticate, [param('awardId').isUUID()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;
  const donorId = await getLinkedDonorId(req.user!.userId);
  if (!donorId) {
    res.status(403).json({ success: false, message: 'No donor profile linked to this account' });
    return;
  }

  const cert = await db('dfb_donor_certificate_awards').where({ award_id: req.params.awardId, donor_id: donorId }).first();
  if (!cert) {
    res.status(404).json({ success: false, message: 'Certificate not found' });
    return;
  }

  res.json({ success: true, data: { award_id: cert.award_id, rendered_html: cert.rendered_html, qr_code_data_url: cert.qr_code_data_url, verification_code: cert.verification_code, verification_url: cert.verification_url } });
});

donorRecordsRouter.get('/my/messages', authenticate, async (req: Request, res: Response): Promise<void> => {
  const donorId = await getLinkedDonorId(req.user!.userId);
  if (!donorId) {
    res.status(403).json({ success: false, message: 'No donor profile linked to this account' });
    return;
  }

  const messages = await db('dfb_donor_messages').where({ recipient_donor_id: donorId }).orderBy('sent_at', 'desc').limit(100).select('*');
  res.json({ success: true, data: messages });
});

donorRecordsRouter.patch('/my/messages/:messageId/read', authenticate, [param('messageId').isUUID()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;
  const donorId = await getLinkedDonorId(req.user!.userId);
  if (!donorId) {
    res.status(403).json({ success: false, message: 'No donor profile linked to this account' });
    return;
  }

  await db('dfb_donor_messages').where({ message_id: req.params.messageId, recipient_donor_id: donorId }).update({ is_read: true, read_at: new Date() });
  res.json({ success: true, message: 'Marked as read' });
});
