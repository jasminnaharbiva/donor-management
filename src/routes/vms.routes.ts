import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createHash } from 'crypto';

import { db } from '../config/database';
import { config } from '../config';
import { authenticate, requireRoles } from '../middleware/auth.middleware';

export const vmsRouter = Router();

const vmsUploadRoot = path.join(process.cwd(), 'public', 'uploads', 'vms');
const volunteerDir = path.join(vmsUploadRoot, 'volunteers');
const certificateDir = path.join(vmsUploadRoot, 'certificates');
const logoDir = path.join(vmsUploadRoot, 'logo');

[volunteerDir, certificateDir, logoDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function safeUnlink(relativePath: string | null | undefined): void {
  if (!relativePath) return;
  const filePath = path.join(process.cwd(), 'public', relativePath.replace(/^\//, ''));
  if (!filePath.startsWith(path.join(process.cwd(), 'public'))) return;
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function generateCertificateId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const n = String(Math.floor(Math.random() * 900000) + 100000);
  return `CNS-${y}-${n}`;
}

function buildVerificationUrl(certificateId: string): string {
  return `/vms/certificate/${encodeURIComponent(certificateId)}`;
}

function buildCertificateHash(certificateId: string, volunteerId: number | string, issueDate: Date | string): string {
  return createHash('sha256')
    .update(`${certificateId}|${volunteerId}|${new Date(issueDate).toISOString()}`)
    .digest('hex');
}

async function logCertificateVerification(payload: {
  certificateIdentifier: string;
  sourceSystem: 'vms' | 'dfb' | 'unknown';
  status: 'verified' | 'not_found' | 'revoked' | 'expired';
  volunteerRef?: string | null;
  ipAddress?: string;
  userAgent?: string | null;
}) {
  try {
    const hasTable = await db.schema.hasTable('dfb_certificate_verification_logs');
    if (!hasTable) return;

    await db('dfb_certificate_verification_logs').insert({
      certificate_identifier: payload.certificateIdentifier,
      source_system: payload.sourceSystem,
      verification_status: payload.status,
      volunteer_ref: payload.volunteerRef || null,
      ip_address: payload.ipAddress || null,
      user_agent: payload.userAgent || null,
      verified_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });
  } catch {
    // Logging should never block certificate verification responses
  }
}

type UnifiedCertificateLookup = {
  certificate_pk: number | string;
  certificate_id: string;
  issue_date: string | Date | null;
  certificate_status: number | boolean;
  image_path: string | null;
  volunteer_id: number | string;
  full_name: string;
  father_name: string | null;
  mother_name: string | null;
  date_of_birth: string | Date | null;
  blood_group: string | null;
  mobile_number: string | null;
  nid_or_birth_certificate: string | null;
  gender: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  volunteer_status: number | boolean;
  picture_path: string | null;
  source_system: 'vms' | 'dfb';
  certificate_hash: string | null;
  expires_at: string | Date | null;
  verification_url: string | null;
};

async function findCertificateAcrossSystems(certificateId: string): Promise<UnifiedCertificateLookup | null> {
  const vmsRow = await db('vms_certificates as c')
    .join('vms_volunteers as v', 'c.volunteer_id', 'v.id')
    .where({ 'c.certificate_id': certificateId })
    .first(
      'c.id as certificate_pk', 'c.certificate_id', 'c.issue_date', 'c.image_path',
      'v.id as volunteer_id', 'v.full_name', 'v.father_name', 'v.mother_name', 'v.date_of_birth', 'v.blood_group',
      'v.mobile_number', 'v.nid_or_birth_certificate', 'v.gender', 'v.division', 'v.district', 'v.upazila',
      'v.status as volunteer_status', 'v.picture_path', 'c.certificate_hash', 'c.expires_at', 'c.verification_url',
      db.raw('CASE WHEN c.revoked_at IS NOT NULL THEN 0 WHEN c.expires_at IS NOT NULL AND c.expires_at < CURDATE() THEN 0 ELSE c.status END as certificate_status'),
      db.raw("'vms' as source_system")
    ) as UnifiedCertificateLookup | undefined;

  if (vmsRow) return vmsRow;

  const hasAwardsTable = await db.schema.hasTable('dfb_certificate_awards');
  if (!hasAwardsTable) return null;

  const hasFather = await db.schema.hasColumn('dfb_volunteers', 'father_name');
  const hasDob = await db.schema.hasColumn('dfb_volunteers', 'date_of_birth');
  const hasBlood = await db.schema.hasColumn('dfb_volunteers', 'blood_group');
  const hasMobile = await db.schema.hasColumn('dfb_volunteers', 'mobile_number');
  const hasGender = await db.schema.hasColumn('dfb_volunteers', 'gender');
  const hasDivision = await db.schema.hasColumn('dfb_volunteers', 'division');
  const hasDistrict = await db.schema.hasColumn('dfb_volunteers', 'district');
  const hasUpazila = await db.schema.hasColumn('dfb_volunteers', 'upazila');
  const hasStatus = await db.schema.hasColumn('dfb_volunteers', 'status');

  const dfbRow = await db('dfb_certificate_awards as a')
    .join('dfb_volunteers as v', 'a.volunteer_id', 'v.volunteer_id')
    .where((builder) => {
      builder.where('a.verification_code', certificateId).orWhere('a.award_id', certificateId);
    })
    .first(
      'a.award_id as certificate_pk',
      'a.verification_code as certificate_id',
      'a.issue_date',
      db.raw('NULL as image_path'),
      'v.volunteer_id',
      db.raw("TRIM(CONCAT(IFNULL(v.first_name, ''), ' ', IFNULL(v.last_name, ''))) as full_name"),
      hasFather ? 'v.father_name' : db.raw('NULL as father_name'),
      db.raw('NULL as mother_name'),
      hasDob ? 'v.date_of_birth' : db.raw('NULL as date_of_birth'),
      hasBlood ? 'v.blood_group' : db.raw('NULL as blood_group'),
      hasMobile ? 'v.mobile_number' : db.raw('NULL as mobile_number'),
      db.raw('NULL as nid_or_birth_certificate'),
      hasGender ? 'v.gender' : db.raw('NULL as gender'),
      hasDivision ? 'v.division' : db.raw('NULL as division'),
      hasDistrict ? 'v.district' : db.raw('NULL as district'),
      hasUpazila ? 'v.upazila' : db.raw('NULL as upazila'),
      hasStatus ? db.raw("CASE WHEN v.status = 'active' THEN 1 ELSE 0 END as volunteer_status") : db.raw('1 as volunteer_status'),
      db.raw('NULL as picture_path'),
      db.raw('COALESCE(a.certificate_hash, NULL) as certificate_hash'),
      db.raw('COALESCE(a.expires_at, NULL) as expires_at'),
      db.raw('COALESCE(a.verification_url, NULL) as verification_url'),
      db.raw('CASE WHEN a.revoked_at IS NOT NULL THEN 0 WHEN a.expires_at IS NOT NULL AND a.expires_at < CURDATE() THEN 0 ELSE 1 END as certificate_status'),
      db.raw("'dfb' as source_system")
    ) as UnifiedCertificateLookup | undefined;

  return dfbRow || null;
}

async function writeVmsAuditLog(payload: {
  actorAdminId?: number | null;
  actionType: string;
  tableName: string;
  recordId?: string | number | null;
  body?: unknown;
  ipAddress?: string;
}) {
  await db('vms_audit_logs').insert({
    actor_admin_id: payload.actorAdminId ?? null,
    action_type: payload.actionType,
    table_name: payload.tableName,
    record_id: payload.recordId ? String(payload.recordId) : null,
    payload: payload.body ? JSON.stringify(payload.body) : null,
    ip_address: payload.ipAddress || null,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

type VmsJwtPayload = {
  vmsAdminId: number;
  username: string;
  role: string;
  type: 'vms_admin';
  iat?: number;
  exp?: number;
};

declare global {
  namespace Express {
    interface Request {
      vmsAdmin?: VmsJwtPayload;
    }
  }
}

function authenticateVmsAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authorization token required' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as VmsJwtPayload;
    if (decoded.type !== 'vms_admin') {
      res.status(401).json({ success: false, message: 'Invalid VMS token' });
      return;
    }
    req.vmsAdmin = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const category = String(req.params.category || '').toLowerCase();
    if (category === 'volunteers') return cb(null, volunteerDir);
    if (category === 'certificates') return cb(null, certificateDir);
    if (category === 'logo') return cb(null, logoDir);
    return cb(new Error('Invalid upload category'), volunteerDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: jpg, jpeg, png'));
  },
});

function mapValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------
vmsRouter.get('/public/settings', async (_req: Request, res: Response): Promise<void> => {
  const settings = await db('vms_general_settings').first();
  if (!settings) {
    res.status(404).json({ success: false, message: 'VMS settings not found' });
    return;
  }
  res.json({ success: true, data: settings });
});

vmsRouter.post(
  '/public/verify-certificate',
  [body('certificateId').trim().notEmpty().isLength({ max: 80 })],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const certificateId = String(req.body.certificateId).trim();

    const row = await findCertificateAcrossSystems(certificateId);

    if (!row) {
      await logCertificateVerification({
        certificateIdentifier: certificateId,
        sourceSystem: 'unknown',
        status: 'not_found',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
      res.status(404).json({ success: false, message: 'Certificate not found' });
      return;
    }

    const isExpired = Boolean(row.expires_at) && new Date(String(row.expires_at)) < new Date();
    const isRevoked = !Boolean(row.certificate_status);
    await logCertificateVerification({
      certificateIdentifier: certificateId,
      sourceSystem: row.source_system,
      status: isRevoked ? (isExpired ? 'expired' : 'revoked') : 'verified',
      volunteerRef: String(row.volunteer_id),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.json({ success: true, data: row });
  }
);

vmsRouter.get(
  '/public/certificate/:certificateId',
  [param('certificateId').trim().notEmpty().isLength({ max: 80 })],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const certificateId = String(req.params.certificateId).trim();

    const row = await findCertificateAcrossSystems(certificateId);

    if (!row) {
      await logCertificateVerification({
        certificateIdentifier: certificateId,
        sourceSystem: 'unknown',
        status: 'not_found',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
      res.status(404).json({ success: false, message: 'Certificate not found' });
      return;
    }

    const isExpired = Boolean(row.expires_at) && new Date(String(row.expires_at)) < new Date();
    const isRevoked = !Boolean(row.certificate_status);
    await logCertificateVerification({
      certificateIdentifier: certificateId,
      sourceSystem: row.source_system,
      status: isRevoked ? (isExpired ? 'expired' : 'revoked') : 'verified',
      volunteerRef: String(row.volunteer_id),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.json({ success: true, data: row });
  }
);

// ---------------------------------------------------------------------------
// VMS standalone auth endpoints (for independent module usage)
// ---------------------------------------------------------------------------
vmsRouter.post(
  '/auth/login',
  [body('username').trim().notEmpty(), body('password').notEmpty()],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const { username, password } = req.body;

    const admin = await db('vms_admins').where({ username, status: 1 }).first();
    if (!admin) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { vmsAdminId: admin.id, username: admin.username, role: admin.role, type: 'vms_admin' },
      config.jwt.accessSecret,
      { expiresIn: '12h' }
    );

    await db('vms_admins').where({ id: admin.id }).update({
      last_login_at: new Date(),
      last_login_ip: req.ip,
      updated_at: new Date(),
    });

    await writeVmsAuditLog({
      actorAdminId: admin.id,
      actionType: 'LOGIN',
      tableName: 'vms_admins',
      recordId: admin.id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  }
);

vmsRouter.post('/auth/logout', authenticateVmsAdmin, async (req: Request, res: Response): Promise<void> => {
  await writeVmsAuditLog({
    actorAdminId: req.vmsAdmin?.vmsAdminId,
    actionType: 'LOGOUT',
    tableName: 'vms_admins',
    recordId: req.vmsAdmin?.vmsAdminId,
    ipAddress: req.ip,
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

vmsRouter.get('/auth/me', authenticateVmsAdmin, async (req: Request, res: Response): Promise<void> => {
  const admin = await db('vms_admins')
    .where({ id: req.vmsAdmin!.vmsAdminId })
    .first('id', 'username', 'email', 'role', 'status', 'last_login_at', 'created_at');

  if (!admin) {
    res.status(404).json({ success: false, message: 'VMS admin not found' });
    return;
  }

  res.json({ success: true, data: admin });
});

vmsRouter.post(
  '/auth/change-password',
  authenticateVmsAdmin,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 8 })],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const admin = await db('vms_admins')
      .where({ id: req.vmsAdmin!.vmsAdminId })
      .first('id', 'password_hash');

    if (!admin) {
      res.status(404).json({ success: false, message: 'VMS admin not found' });
      return;
    }

    const valid = await bcrypt.compare(req.body.currentPassword, admin.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(req.body.newPassword, 12);
    await db('vms_admins').where({ id: admin.id }).update({ password_hash: newHash, updated_at: new Date() });

    await writeVmsAuditLog({
      actorAdminId: admin.id,
      actionType: 'CHANGE_PASSWORD',
      tableName: 'vms_admins',
      recordId: admin.id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password changed successfully' });
  }
);

// ---------------------------------------------------------------------------
// Integrated admin endpoints (protected by existing main admin auth)
// ---------------------------------------------------------------------------
vmsRouter.use('/admin', authenticate, requireRoles('Super Admin', 'Admin'));

vmsRouter.get('/admin/dashboard/stats', async (_req: Request, res: Response): Promise<void> => {
  const volunteerCount = await db('vms_volunteers').count('id as total').first();
  const certCount = await db('vms_certificates').count('id as total').first();
  const activeCertCount = await db('vms_certificates').where({ status: 1 }).count('id as total').first();

  const hasDfbVolunteers = await db.schema.hasTable('dfb_volunteers');
  const hasDfbAwards = await db.schema.hasTable('dfb_certificate_awards');
  const dfbVolunteerCount = hasDfbVolunteers
    ? await db('dfb_volunteers').count('volunteer_id as total').first()
    : ({ total: 0 } as any);
  const dfbCertCount = hasDfbAwards
    ? await db('dfb_certificate_awards').count('award_id as total').first()
    : ({ total: 0 } as any);

  res.json({
    success: true,
    data: {
      volunteers: Number((volunteerCount as any)?.total || 0),
      certificates: Number((certCount as any)?.total || 0),
      verifiedCertificates: Number((activeCertCount as any)?.total || 0),
      dfbVolunteers: Number((dfbVolunteerCount as any)?.total || 0),
      dfbCertificates: Number((dfbCertCount as any)?.total || 0),
      totalVolunteersUnified: Number((volunteerCount as any)?.total || 0) + Number((dfbVolunteerCount as any)?.total || 0),
      totalCertificatesUnified: Number((certCount as any)?.total || 0) + Number((dfbCertCount as any)?.total || 0),
    },
  });
});

vmsRouter.get(
  '/admin/unified/volunteers',
  [
    query('status').optional().isIn(['active', 'inactive']),
    query('search').optional().isString(),
    query('source').optional().isIn(['all', 'vms', 'dfb']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const { status, search } = req.query;
    const source = String(req.query.source || 'all');
    const pageNum = Number(req.query.page || 1);
    const limitNum = Number(req.query.limit || 50);
    const offset = (pageNum - 1) * limitNum;
    const data: Array<Record<string, unknown>> = [];

    if (source === 'all' || source === 'vms') {
      const q = db('vms_volunteers as v')
        .leftJoin('vms_certificates as c', 'v.id', 'c.volunteer_id')
        .select(
          'v.id', 'v.full_name', 'v.mobile_number', 'v.blood_group', 'v.gender',
          'v.division', 'v.district', 'v.upazila', 'v.status', 'v.picture_path', 'v.created_at',
          'c.certificate_id',
          db.raw("'vms' as source_system")
        )
        .orderBy('v.id', 'desc')
        .limit(limitNum * 2);

      if (status) q.where('v.status', status === 'active' ? 1 : 0);
      if (search) {
        const term = `%${String(search).trim()}%`;
        q.where((builder) => {
          builder.where('v.full_name', 'like', term)
            .orWhere('v.mobile_number', 'like', term)
            .orWhere('v.nid_or_birth_certificate', 'like', term)
            .orWhere('c.certificate_id', 'like', term);
        });
      }

      data.push(...(await q));
    }

    if ((source === 'all' || source === 'dfb') && await db.schema.hasTable('dfb_volunteers')) {
      const hasMobile = await db.schema.hasColumn('dfb_volunteers', 'mobile_number');
      const hasBloodGroup = await db.schema.hasColumn('dfb_volunteers', 'blood_group');
      const hasGender = await db.schema.hasColumn('dfb_volunteers', 'gender');
      const hasDivision = await db.schema.hasColumn('dfb_volunteers', 'division');
      const hasDistrict = await db.schema.hasColumn('dfb_volunteers', 'district');
      const hasUpazila = await db.schema.hasColumn('dfb_volunteers', 'upazila');
      const hasBadge = await db.schema.hasColumn('dfb_volunteers', 'badge_number');
      const hasStatus = await db.schema.hasColumn('dfb_volunteers', 'status');

      const q = db('dfb_volunteers as v')
        .select(
          db.raw('v.volunteer_id as id'),
          db.raw("TRIM(CONCAT(IFNULL(v.first_name, ''), ' ', IFNULL(v.last_name, ''))) as full_name"),
          hasMobile ? 'v.mobile_number' : db.raw('NULL as mobile_number'),
          hasBloodGroup ? 'v.blood_group' : db.raw('NULL as blood_group'),
          hasGender ? 'v.gender' : db.raw('NULL as gender'),
          hasDivision ? 'v.division' : db.raw('NULL as division'),
          hasDistrict ? 'v.district' : db.raw('NULL as district'),
          hasUpazila ? 'v.upazila' : db.raw('NULL as upazila'),
          hasStatus ? db.raw("CASE WHEN v.status = 'active' THEN 1 ELSE 0 END as status") : db.raw('1 as status'),
          db.raw('NULL as picture_path'),
          'v.created_at',
          db.raw('NULL as certificate_id'),
          db.raw("'dfb' as source_system"),
          hasBadge ? 'v.badge_number' : db.raw('NULL as badge_number')
        )
        .orderBy('v.volunteer_id', 'desc')
        .limit(limitNum * 2);

      if (status && hasStatus) q.where('v.status', status === 'active' ? 'active' : 'inactive');
      if (search) {
        const term = `%${String(search).trim()}%`;
        q.where((builder) => {
          builder.where('v.first_name', 'like', term)
            .orWhere('v.last_name', 'like', term)
            .orWhere(hasMobile ? 'v.mobile_number' : 'v.first_name', 'like', term)
            .orWhere(hasBadge ? 'v.badge_number' : 'v.last_name', 'like', term);
        });
      }

      data.push(...(await q));
    }

    data.sort((a, b) => new Date(String((b as any).created_at || 0)).getTime() - new Date(String((a as any).created_at || 0)).getTime());
    const paged = data.slice(offset, offset + limitNum);
    res.json({ success: true, data: paged, pagination: { page: pageNum, limit: limitNum, total: data.length, total_pages: Math.max(1, Math.ceil(data.length / limitNum)) } });
  }
);

vmsRouter.get(
  '/admin/unified/certificates',
  [
    query('status').optional().isIn(['verified', 'unverified']),
    query('search').optional().isString(),
    query('source').optional().isIn(['all', 'vms', 'dfb']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const status = String(req.query.status || '');
    const search = String(req.query.search || '').trim();
    const source = String(req.query.source || 'all');
    const pageNum = Number(req.query.page || 1);
    const limitNum = Number(req.query.limit || 50);
    const offset = (pageNum - 1) * limitNum;
    const out: Array<Record<string, unknown>> = [];

    if (source === 'all' || source === 'vms') {
      const q = db('vms_certificates as c')
        .join('vms_volunteers as v', 'c.volunteer_id', 'v.id')
        .select(
          db.raw("CONCAT('vms:', c.id) as unified_id"),
          'c.id', 'c.certificate_id', 'c.volunteer_id', 'c.issue_date', 'c.expires_at', 'c.status', 'c.image_path',
          'c.revoked_at', 'c.revoked_reason', 'c.created_at',
          'v.full_name', 'v.mobile_number',
          db.raw("'vms' as source_system")
        )
        .orderBy('c.id', 'desc')
        .limit(limitNum * 2);

      if (status) q.whereRaw(status === 'verified' ? 'c.status = 1 AND c.revoked_at IS NULL' : 'c.status = 0 OR c.revoked_at IS NOT NULL');
      if (search) {
        const term = `%${search}%`;
        q.where((builder) => {
          builder.where('c.certificate_id', 'like', term)
            .orWhere('v.full_name', 'like', term)
            .orWhere('v.mobile_number', 'like', term);
        });
      }
      out.push(...(await q));
    }

    if ((source === 'all' || source === 'dfb') && await db.schema.hasTable('dfb_certificate_awards')) {
      const hasMobile = await db.schema.hasColumn('dfb_volunteers', 'mobile_number');
      const hasBadge = await db.schema.hasColumn('dfb_volunteers', 'badge_number');

      const q = db('dfb_certificate_awards as a')
        .join('dfb_volunteers as v', 'a.volunteer_id', 'v.volunteer_id')
        .leftJoin('dfb_certificate_templates as t', 'a.cert_template_id', 't.cert_template_id')
        .select(
          db.raw("CONCAT('dfb:', a.award_id) as unified_id"),
          'a.award_id as id',
          'a.verification_code as certificate_id',
          'a.volunteer_id',
          'a.issue_date',
          'a.expires_at',
          db.raw('CASE WHEN a.revoked_at IS NOT NULL THEN 0 ELSE 1 END as status'),
          db.raw('NULL as image_path'),
          'a.revoked_at',
          'a.revoked_reason',
          'a.created_at',
          db.raw("TRIM(CONCAT(IFNULL(v.first_name, ''), ' ', IFNULL(v.last_name, ''))) as full_name"),
          hasMobile ? 'v.mobile_number' : db.raw('NULL as mobile_number'),
          't.template_name',
          db.raw("'dfb' as source_system")
        )
        .orderBy('a.issue_date', 'desc')
        .limit(limitNum * 2);

      if (status) q.whereRaw(status === 'verified' ? 'a.revoked_at IS NULL' : 'a.revoked_at IS NOT NULL');
      if (search) {
        const term = `%${search}%`;
        q.where((builder) => {
          builder.where('a.verification_code', 'like', term)
            .orWhere('v.first_name', 'like', term)
            .orWhere('v.last_name', 'like', term)
            .orWhere(hasBadge ? 'v.badge_number' : 'v.first_name', 'like', term)
            .orWhere(hasMobile ? 'v.mobile_number' : 'v.last_name', 'like', term);
        });
      }
      out.push(...(await q));
    }

    out.sort((a, b) => new Date(String((b as any).issue_date || (b as any).created_at || 0)).getTime() - new Date(String((a as any).issue_date || (a as any).created_at || 0)).getTime());
    const paged = out.slice(offset, offset + limitNum);
    res.json({ success: true, data: paged, pagination: { page: pageNum, limit: limitNum, total: out.length, total_pages: Math.max(1, Math.ceil(out.length / limitNum)) } });
  }
);

vmsRouter.post(
  '/admin/unified/certificates/bulk',
  [
    body('source_system').isIn(['vms', 'dfb']),
    body('volunteer_ids').isArray({ min: 1 }),
    body('volunteer_ids.*').isInt({ min: 1 }).toInt(),
    body('issue_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('expires_at').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('status').optional().isBoolean().toBoolean(),
    body('cert_template_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).toInt(),
    body('hours_served').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).toInt(),
    body('custom_note').optional({ nullable: true }).isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const sourceSystem: 'vms' | 'dfb' = req.body.source_system;
    const volunteerIds: number[] = req.body.volunteer_ids;
    const issueDate = req.body.issue_date || new Date();
    const expiresAt = req.body.expires_at || null;
    const status = req.body.status ?? true;
    const created: Array<Record<string, unknown>> = [];
    const skipped: Array<Record<string, unknown>> = [];

    if (sourceSystem === 'vms') {
      for (const volunteerId of volunteerIds) {
        const volunteer = await db('vms_volunteers').where({ id: volunteerId }).first('id');
        if (!volunteer) {
          skipped.push({ volunteer_id: volunteerId, reason: 'Volunteer not found in VMS' });
          continue;
        }

        const existing = await db('vms_certificates').where({ volunteer_id: volunteerId }).first('id');
        if (existing) {
          skipped.push({ volunteer_id: volunteerId, reason: 'Volunteer already has a VMS certificate' });
          continue;
        }

        const certificateId = generateCertificateId();
        const payload = {
          volunteer_id: volunteerId,
          certificate_id: certificateId,
          issue_date: issueDate,
          expires_at: expiresAt,
          status,
          verification_url: buildVerificationUrl(certificateId),
          certificate_hash: buildCertificateHash(certificateId, volunteerId, issueDate),
          created_at: new Date(),
          updated_at: new Date(),
        };
        const [id] = await db('vms_certificates').insert(payload);
        created.push({ id, volunteer_id: volunteerId, certificate_id: certificateId, source_system: 'vms' });
      }
    } else {
      const hasAwards = await db.schema.hasTable('dfb_certificate_awards');
      const hasTemplates = await db.schema.hasTable('dfb_certificate_templates');
      if (!hasAwards || !hasTemplates) {
        res.status(400).json({ success: false, message: 'DFB certificate tables are not available in this environment' });
        return;
      }

      let certTemplateId = req.body.cert_template_id;
      if (!certTemplateId) {
        const defaultTemplate = await db('dfb_certificate_templates').where({ is_active: 1 }).orderBy('cert_template_id', 'asc').first('cert_template_id');
        certTemplateId = defaultTemplate?.cert_template_id;
      }

      if (!certTemplateId) {
        res.status(400).json({ success: false, message: 'No active DFB certificate template found. Create one first.' });
        return;
      }

      const { v4: uuidv4 } = await import('uuid');
      for (const volunteerId of volunteerIds) {
        const volunteer = await db('dfb_volunteers').where({ volunteer_id: volunteerId }).first('volunteer_id');
        if (!volunteer) {
          skipped.push({ volunteer_id: volunteerId, reason: 'Volunteer not found in DFB system' });
          continue;
        }

        const verificationCode = `${Math.random().toString(36).substring(2, 10).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
        const awardId = uuidv4();
        await db('dfb_certificate_awards').insert({
          award_id: awardId,
          cert_template_id: certTemplateId,
          volunteer_id: volunteerId,
          custom_note: req.body.custom_note || null,
          hours_served: req.body.hours_served || null,
          issue_date: issueDate,
          expires_at: expiresAt,
          verification_code: verificationCode,
          verification_url: buildVerificationUrl(verificationCode),
          certificate_hash: buildCertificateHash(verificationCode, volunteerId, issueDate),
          issued_by: req.user?.userId || null,
          created_at: new Date(),
          updated_at: new Date(),
        });

        created.push({ id: awardId, volunteer_id: volunteerId, certificate_id: verificationCode, source_system: 'dfb' });
      }
    }

    await writeVmsAuditLog({
      actionType: 'BULK_ISSUE',
      tableName: sourceSystem === 'vms' ? 'vms_certificates' : 'dfb_certificate_awards',
      body: { source_system: sourceSystem, requested_count: volunteerIds.length, created_count: created.length, skipped_count: skipped.length },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Bulk issuance completed (${created.length} created, ${skipped.length} skipped)`,
      data: { created, skipped },
    });
  }
);

vmsRouter.patch(
  '/admin/unified/certificates/:source/:id/revoke',
  [
    param('source').isIn(['vms', 'dfb']),
    param('id').notEmpty(),
    body('reason').optional({ nullable: true }).isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const source = String(req.params.source);
    const reason = req.body.reason || null;

    if (source === 'vms') {
      const updated = await db('vms_certificates')
        .where({ id: Number(req.params.id) })
        .update({ status: 0, revoked_at: new Date(), revoked_reason: reason, updated_at: new Date() });
      if (!updated) {
        res.status(404).json({ success: false, message: 'VMS certificate not found' });
        return;
      }
    } else {
      if (!await db.schema.hasTable('dfb_certificate_awards')) {
        res.status(404).json({ success: false, message: 'DFB certificate table not found' });
        return;
      }

      const updated = await db('dfb_certificate_awards')
        .where({ award_id: req.params.id })
        .update({ revoked_at: new Date(), revoked_reason: reason, updated_at: new Date() });
      if (!updated) {
        res.status(404).json({ success: false, message: 'DFB certificate not found' });
        return;
      }
    }

    await writeVmsAuditLog({
      actionType: 'REVOKE',
      tableName: source === 'vms' ? 'vms_certificates' : 'dfb_certificate_awards',
      recordId: String(req.params.id),
      body: { reason },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Certificate revoked successfully' });
  }
);

vmsRouter.get('/admin/unified/certificates/verification-analytics', async (_req: Request, res: Response): Promise<void> => {
  const hasTable = await db.schema.hasTable('dfb_certificate_verification_logs');
  if (!hasTable) {
    res.json({
      success: true,
      data: {
        totalChecks: 0,
        byStatus: [],
        bySource: [],
        recentChecks: [],
      },
    });
    return;
  }

  const totalRow = await db('dfb_certificate_verification_logs').count('id as total').first();
  const byStatus = await db('dfb_certificate_verification_logs')
    .select('verification_status')
    .count('id as total')
    .groupBy('verification_status');
  const bySource = await db('dfb_certificate_verification_logs')
    .select('source_system')
    .count('id as total')
    .groupBy('source_system');
  const recentChecks = await db('dfb_certificate_verification_logs')
    .orderBy('verified_at', 'desc')
    .limit(20)
    .select('certificate_identifier', 'source_system', 'verification_status', 'verified_at');

  res.json({
    success: true,
    data: {
      totalChecks: Number((totalRow as any)?.total || 0),
      byStatus,
      bySource,
      recentChecks,
    },
  });
});

vmsRouter.post('/admin/upload/:category', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }

  const category = String(req.params.category).toLowerCase();
  const prefix = category === 'logo' ? 'logo' : category;
  const relativePath = `/uploads/vms/${prefix}/${req.file.filename}`;

  res.status(201).json({
    success: true,
    data: {
      path: relativePath,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });
});

vmsRouter.get('/admin/settings', async (_req: Request, res: Response): Promise<void> => {
  const settings = await db('vms_general_settings').first();
  res.json({ success: true, data: settings });
});

vmsRouter.put(
  '/admin/settings',
  [
    body('site_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 150 }),
    body('home_title').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 255 }),
    body('keywords').optional({ nullable: true }).isString(),
    body('description').optional({ nullable: true }).isString(),
    body('recaptcha_site_key').optional({ nullable: true }).isString(),
    body('recaptcha_secret_key').optional({ nullable: true }).isString(),
    body('logo_path').optional({ nullable: true }).isString(),
    body('timezone').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 80 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const payload = {
      ...req.body,
      updated_at: new Date(),
    };

    await db('vms_general_settings').where({ id: 1 }).update(payload);

    await writeVmsAuditLog({
      actionType: 'UPDATE',
      tableName: 'vms_general_settings',
      recordId: 1,
      body: req.body,
      ipAddress: req.ip,
    });

    const settings = await db('vms_general_settings').first();
    res.json({ success: true, message: 'Settings updated successfully', data: settings });
  }
);

vmsRouter.get(
  '/admin/volunteers',
  [
    query('status').optional().isIn(['active', 'inactive']),
    query('search').optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const { status, search } = req.query;
    const q = db('vms_volunteers as v')
      .leftJoin('vms_certificates as c', 'v.id', 'c.volunteer_id')
      .select(
        'v.id', 'v.full_name', 'v.mobile_number', 'v.blood_group', 'v.gender',
        'v.division', 'v.district', 'v.upazila', 'v.status', 'v.picture_path', 'v.created_at',
        'c.certificate_id', 'c.issue_date', 'c.status as certificate_status'
      )
      .orderBy('v.id', 'desc');

    if (status) q.where('v.status', status === 'active' ? 1 : 0);
    if (search) {
      const term = `%${String(search).trim()}%`;
      q.where((builder) => {
        builder.where('v.full_name', 'like', term)
          .orWhere('v.mobile_number', 'like', term)
          .orWhere('v.nid_or_birth_certificate', 'like', term)
          .orWhere('c.certificate_id', 'like', term);
      });
    }

    const data = await q;
    res.json({ success: true, data });
  }
);

vmsRouter.post(
  '/admin/volunteers',
  [
    body('full_name').trim().notEmpty().isLength({ max: 150 }),
    body('father_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 150 }),
    body('mother_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 150 }),
    body('date_of_birth').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('blood_group').optional({ nullable: true, checkFalsy: true }).isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    body('mobile_number').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 30 }),
    body('nid_or_birth_certificate').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
    body('gender').optional({ nullable: true, checkFalsy: true }).isIn(['Male', 'Female', 'Other']),
    body('division').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
    body('district').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
    body('upazila').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
    body('status').optional().isBoolean().toBoolean(),
    body('picture_path').optional({ nullable: true }).isString(),
    body('skills_json').optional({ nullable: true }).isString(),
    body('availability_notes').optional({ nullable: true }).isString(),
    body('hours_completed').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const payload = {
      full_name: req.body.full_name,
      father_name: req.body.father_name || null,
      mother_name: req.body.mother_name || null,
      date_of_birth: req.body.date_of_birth || null,
      blood_group: req.body.blood_group || null,
      mobile_number: req.body.mobile_number || null,
      nid_or_birth_certificate: req.body.nid_or_birth_certificate || null,
      gender: req.body.gender || null,
      division: req.body.division || null,
      district: req.body.district || null,
      upazila: req.body.upazila || null,
      status: req.body.status ?? true,
      picture_path: req.body.picture_path || null,
      skills_json: req.body.skills_json || null,
      availability_notes: req.body.availability_notes || null,
      hours_completed: req.body.hours_completed ?? 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [id] = await db('vms_volunteers').insert(payload);

    await writeVmsAuditLog({
      actionType: 'INSERT',
      tableName: 'vms_volunteers',
      recordId: id,
      body: payload,
      ipAddress: req.ip,
    });

    const row = await db('vms_volunteers').where({ id }).first();
    res.status(201).json({ success: true, message: 'Volunteer created successfully', data: row });
  }
);

vmsRouter.get('/admin/volunteers/:id', [param('id').isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (mapValidationErrors(req, res)) return;

  const row = await db('vms_volunteers').where({ id: req.params.id }).first();
  if (!row) {
    res.status(404).json({ success: false, message: 'Volunteer not found' });
    return;
  }
  res.json({ success: true, data: row });
});

vmsRouter.put(
  '/admin/volunteers/:id',
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('full_name').trim().notEmpty().isLength({ max: 150 }),
    body('father_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 150 }),
    body('mother_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 150 }),
    body('date_of_birth').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('blood_group').optional({ nullable: true, checkFalsy: true }).isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    body('mobile_number').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 30 }),
    body('nid_or_birth_certificate').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
    body('gender').optional({ nullable: true, checkFalsy: true }).isIn(['Male', 'Female', 'Other']),
    body('division').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
    body('district').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
    body('upazila').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 80 }),
    body('status').optional().isBoolean().toBoolean(),
    body('picture_path').optional({ nullable: true }).isString(),
    body('skills_json').optional({ nullable: true }).isString(),
    body('availability_notes').optional({ nullable: true }).isString(),
    body('hours_completed').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const id = Number(req.params.id);
    const existing = await db('vms_volunteers').where({ id }).first();
    if (!existing) {
      res.status(404).json({ success: false, message: 'Volunteer not found' });
      return;
    }

    const payload = {
      full_name: req.body.full_name,
      father_name: req.body.father_name || null,
      mother_name: req.body.mother_name || null,
      date_of_birth: req.body.date_of_birth || null,
      blood_group: req.body.blood_group || null,
      mobile_number: req.body.mobile_number || null,
      nid_or_birth_certificate: req.body.nid_or_birth_certificate || null,
      gender: req.body.gender || null,
      division: req.body.division || null,
      district: req.body.district || null,
      upazila: req.body.upazila || null,
      status: req.body.status ?? true,
      picture_path: req.body.picture_path || null,
      skills_json: req.body.skills_json || null,
      availability_notes: req.body.availability_notes || null,
      hours_completed: req.body.hours_completed ?? existing.hours_completed ?? 0,
      updated_at: new Date(),
    };

    if (existing.picture_path && payload.picture_path !== existing.picture_path) safeUnlink(existing.picture_path);

    await db('vms_volunteers').where({ id }).update(payload);

    await writeVmsAuditLog({
      actionType: 'UPDATE',
      tableName: 'vms_volunteers',
      recordId: id,
      body: payload,
      ipAddress: req.ip,
    });

    const row = await db('vms_volunteers').where({ id }).first();
    res.json({ success: true, message: 'Volunteer updated successfully', data: row });
  }
);

vmsRouter.patch(
  '/admin/volunteers/:id/status',
  [param('id').isInt({ min: 1 }).toInt(), body('status').isBoolean().toBoolean()],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const id = Number(req.params.id);
    const updated = await db('vms_volunteers').where({ id }).update({ status: req.body.status, updated_at: new Date() });
    if (!updated) {
      res.status(404).json({ success: false, message: 'Volunteer not found' });
      return;
    }

    await writeVmsAuditLog({
      actionType: 'STATUS_CHANGE',
      tableName: 'vms_volunteers',
      recordId: id,
      body: { status: req.body.status },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Volunteer status updated' });
  }
);

vmsRouter.delete('/admin/volunteers/:id', [param('id').isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (mapValidationErrors(req, res)) return;

  const id = Number(req.params.id);
  const existing = await db('vms_volunteers').where({ id }).first();
  if (!existing) {
    res.status(404).json({ success: false, message: 'Volunteer not found' });
    return;
  }

  const cert = await db('vms_certificates').where({ volunteer_id: id }).first();
  if (cert?.image_path) safeUnlink(cert.image_path);
  if (existing.picture_path) safeUnlink(existing.picture_path);

  await db('vms_volunteers').where({ id }).delete();

  await writeVmsAuditLog({
    actionType: 'DELETE',
    tableName: 'vms_volunteers',
    recordId: id,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: 'Volunteer deleted successfully' });
});

vmsRouter.get(
  '/admin/certificates',
  [query('status').optional().isIn(['verified', 'unverified']), query('search').optional().isString()],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const { status, search } = req.query;
    const q = db('vms_certificates as c')
      .join('vms_volunteers as v', 'c.volunteer_id', 'v.id')
      .select(
        'c.id', 'c.certificate_id', 'c.volunteer_id', 'c.issue_date', 'c.expires_at', 'c.status', 'c.image_path', 'c.created_at',
        'c.verification_url', 'c.certificate_hash', 'c.revoked_at', 'c.revoked_reason',
        'v.full_name', 'v.mobile_number', 'v.blood_group', 'v.division', 'v.district'
      )
      .orderBy('c.id', 'desc');

    if (status) q.where('c.status', status === 'verified' ? 1 : 0);
    if (search) {
      const term = `%${String(search).trim()}%`;
      q.where((builder) => {
        builder.where('c.certificate_id', 'like', term)
          .orWhere('v.full_name', 'like', term)
          .orWhere('v.mobile_number', 'like', term);
      });
    }

    const data = await q;
    res.json({ success: true, data });
  }
);

vmsRouter.post(
  '/admin/certificates',
  [
    body('volunteer_id').isInt({ min: 1 }).toInt(),
    body('certificate_id').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 3, max: 80 }),
    body('issue_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('expires_at').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('status').optional().isBoolean().toBoolean(),
    body('image_path').optional({ nullable: true }).isString(),
    body('verification_url').optional({ nullable: true }).isString(),
    body('certificate_hash').optional({ nullable: true }).isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const volunteer = await db('vms_volunteers').where({ id: req.body.volunteer_id }).first('id');
    if (!volunteer) {
      res.status(404).json({ success: false, message: 'Volunteer not found' });
      return;
    }

    const existing = await db('vms_certificates').where({ volunteer_id: req.body.volunteer_id }).first('id');
    if (existing) {
      res.status(409).json({ success: false, message: 'This volunteer already has a certificate in VMS. Use DFB source for multiple certificates.' });
      return;
    }

    let certificateId = req.body.certificate_id || generateCertificateId();
    const duplicate = await db('vms_certificates').where({ certificate_id: certificateId }).first('id');
    if (duplicate) {
      certificateId = generateCertificateId();
    }

    const payload = {
      volunteer_id: req.body.volunteer_id,
      certificate_id: certificateId,
      issue_date: req.body.issue_date || new Date(),
      expires_at: req.body.expires_at || null,
      status: req.body.status ?? true,
      image_path: req.body.image_path || null,
      verification_url: req.body.verification_url || buildVerificationUrl(certificateId),
      certificate_hash: req.body.certificate_hash || buildCertificateHash(certificateId, req.body.volunteer_id, req.body.issue_date || new Date()),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const [id] = await db('vms_certificates').insert(payload);

    await writeVmsAuditLog({
      actionType: 'INSERT',
      tableName: 'vms_certificates',
      recordId: id,
      body: payload,
      ipAddress: req.ip,
    });

    const row = await db('vms_certificates').where({ id }).first();
    res.status(201).json({ success: true, message: 'Certificate created successfully', data: row });
  }
);

vmsRouter.get('/admin/certificates/:id', [param('id').isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (mapValidationErrors(req, res)) return;

  const row = await db('vms_certificates').where({ id: req.params.id }).first();
  if (!row) {
    res.status(404).json({ success: false, message: 'Certificate not found' });
    return;
  }
  res.json({ success: true, data: row });
});

vmsRouter.put(
  '/admin/certificates/:id',
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('volunteer_id').isInt({ min: 1 }).toInt(),
    body('certificate_id').trim().isLength({ min: 3, max: 80 }),
    body('issue_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('expires_at').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('status').optional().isBoolean().toBoolean(),
    body('image_path').optional({ nullable: true }).isString(),
    body('verification_url').optional({ nullable: true }).isString(),
    body('certificate_hash').optional({ nullable: true }).isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const id = Number(req.params.id);
    const existing = await db('vms_certificates').where({ id }).first();
    if (!existing) {
      res.status(404).json({ success: false, message: 'Certificate not found' });
      return;
    }

    const duplicateCertId = await db('vms_certificates')
      .where({ certificate_id: req.body.certificate_id })
      .andWhereNot({ id })
      .first('id');
    if (duplicateCertId) {
      res.status(409).json({ success: false, message: 'Certificate ID already exists' });
      return;
    }

    const duplicateVolunteer = await db('vms_certificates')
      .where({ volunteer_id: req.body.volunteer_id })
      .andWhereNot({ id })
      .first('id');
    if (duplicateVolunteer) {
      res.status(409).json({ success: false, message: 'Selected volunteer already has another VMS certificate' });
      return;
    }

    const payload = {
      volunteer_id: req.body.volunteer_id,
      certificate_id: req.body.certificate_id,
      issue_date: req.body.issue_date || null,
      expires_at: req.body.expires_at || null,
      status: req.body.status ?? true,
      image_path: req.body.image_path || null,
      verification_url: req.body.verification_url || buildVerificationUrl(req.body.certificate_id),
      certificate_hash: req.body.certificate_hash || buildCertificateHash(req.body.certificate_id, req.body.volunteer_id, req.body.issue_date || existing.issue_date || new Date()),
      updated_at: new Date(),
    };

    if (existing.image_path && payload.image_path !== existing.image_path) safeUnlink(existing.image_path);

    await db('vms_certificates').where({ id }).update(payload);

    await writeVmsAuditLog({
      actionType: 'UPDATE',
      tableName: 'vms_certificates',
      recordId: id,
      body: payload,
      ipAddress: req.ip,
    });

    const row = await db('vms_certificates').where({ id }).first();
    res.json({ success: true, message: 'Certificate updated successfully', data: row });
  }
);

vmsRouter.patch(
  '/admin/certificates/:id/status',
  [param('id').isInt({ min: 1 }).toInt(), body('status').isBoolean().toBoolean()],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const id = Number(req.params.id);
    const updated = await db('vms_certificates').where({ id }).update({ status: req.body.status, updated_at: new Date() });
    if (!updated) {
      res.status(404).json({ success: false, message: 'Certificate not found' });
      return;
    }

    await writeVmsAuditLog({
      actionType: 'STATUS_CHANGE',
      tableName: 'vms_certificates',
      recordId: id,
      body: { status: req.body.status },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Certificate status updated' });
  }
);

vmsRouter.delete('/admin/certificates/:id', [param('id').isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (mapValidationErrors(req, res)) return;

  const id = Number(req.params.id);
  const existing = await db('vms_certificates').where({ id }).first();
  if (!existing) {
    res.status(404).json({ success: false, message: 'Certificate not found' });
    return;
  }

  if (existing.image_path) safeUnlink(existing.image_path);
  await db('vms_certificates').where({ id }).delete();

  await writeVmsAuditLog({
    actionType: 'DELETE',
    tableName: 'vms_certificates',
    recordId: id,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: 'Certificate deleted successfully' });
});
