import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config';
import { authenticate } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { encrypt, decrypt } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

export const authRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------------------
authRouter.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/),
    body('firstName').trim().notEmpty().isLength({ max: 80 }),
    body('lastName').trim().notEmpty().isLength({ max: 80 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, errors: errors.array() });
      return;
    }

    const { email, password, firstName, lastName } = req.body;

    const encryptedEmail = encrypt(email);

    // Check for existing email — scan encrypted values is impractical at scale;
    // use a hash index instead (sha256 of normalised email for dedup)
    const { sha256Hash } = await import('../utils/crypto');
    const emailHash = sha256Hash(email.toLowerCase());

    const existing = await db('dfb_users').where({ email: encryptedEmail }).first();
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId       = uuidv4();
    const donorRole    = await db('dfb_roles').where({ role_name: 'Donor' }).first('role_id');

    await db.transaction(async (trx) => {
      // Create donor record
      const [donorId] = await trx('dfb_donors').insert({
        first_name: firstName,
        last_name:  lastName,
        email:      encryptedEmail,
        donor_type: 'Individual',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Create user account
      await trx('dfb_users').insert({
        user_id:       userId,
        email:         encryptedEmail,
        password_hash: passwordHash,
        role_id:       donorRole?.role_id || 5,
        donor_id:      donorId,
        status:        'pending',
        created_at:    new Date(),
        updated_at:    new Date(),
      });
    });

    await writeAuditLog({
      tableAffected: 'dfb_users',
      recordId:      userId,
      actionType:    'INSERT',
      newPayload:    { userId, firstName, lastName },
      ipAddress:     req.ip,
      userAgent:     req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      userId,
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------
authRouter.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, errors: errors.array() });
      return;
    }

    const { email, password } = req.body;
    const encryptedEmail = encrypt(email);

    const user = await db('dfb_users')
      .where({ email: encryptedEmail })
      .whereNull('deleted_at')
      .first();

    // Constant-time comparison: always hash even if user not found
    const hashToCheck = user?.password_hash || '$2b$12$invalidhashpadding00000000000000000000000000000000000';
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!user || !valid) {
      // Increment failed attempts if user exists
      if (user) {
        await db('dfb_users')
          .where({ user_id: user.user_id })
          .increment('failed_login_attempts', 1)
          .update({ updated_at: new Date() });

        if (user.failed_login_attempts >= 4) {
          const lockUntil = new Date(Date.now() + Number(config.rateLimit.windowMs));
          await db('dfb_users').where({ user_id: user.user_id }).update({ locked_until: lockUntil });
        }
      }
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });
      return;
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      res.status(429).json({ success: false, message: 'Account temporarily locked. Try again later.' });
      return;
    }

    const payload = { userId: user.user_id, roleId: user.role_id };

    const accessToken  = jwt.sign(payload, config.jwt.accessSecret,  { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: '30d' });

    const refreshHash = (await import('../utils/crypto')).sha256Hash(refreshToken);

    await db('dfb_users').where({ user_id: user.user_id }).update({
      failed_login_attempts: 0,
      locked_until:          null,
      last_login_at:         new Date(),
      last_login_ip:         req.ip,
      refresh_token_hash:    refreshHash,
      updated_at:            new Date(),
    });

    await writeAuditLog({
      tableAffected: 'dfb_users',
      recordId:      user.user_id,
      actionType:    'LOGIN',
      actorId:       user.user_id,
      ipAddress:     req.ip,
      userAgent:     req.get('User-Agent'),
    });

    res.json({
      success:      true,
      accessToken,
      refreshToken,
      expiresIn:    config.jwt.accessExpires,
      tokenType:    'Bearer',
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------
authRouter.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization!;
  const token      = authHeader.slice(7);

  // Add token suffix to deny-list in Redis (TTL = JWT max lifetime)
  await redis.set(`denied_token:${token.slice(-16)}`, '1', 'EX', 60 * 60 * 24 * 30);

  await writeAuditLog({
    tableAffected: 'dfb_users',
    recordId:      req.user!.userId,
    actionType:    'LOGOUT',
    actorId:       req.user!.userId,
    ipAddress:     req.ip,
    userAgent:     req.get('User-Agent'),
  });

  res.json({ success: true, message: 'Logged out successfully' });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------
authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ success: false, message: 'Refresh token required' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string; roleId: number };
    const { sha256Hash } = await import('../utils/crypto');
    const refreshHash = sha256Hash(refreshToken);

    const user = await db('dfb_users')
      .where({ user_id: decoded.userId, refresh_token_hash: refreshHash })
      .whereNull('deleted_at')
      .first();

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const newAccessToken = jwt.sign(
      { userId: user.user_id, roleId: user.role_id },
      config.jwt.accessSecret,
      { expiresIn: '15m' }
    );

    res.json({ success: true, accessToken: newAccessToken, expiresIn: config.jwt.accessExpires });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------
authRouter.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = await db('dfb_users as u')
    .join('dfb_roles as r', 'u.role_id', 'r.role_id')
    .where({ 'u.user_id': req.user!.userId })
    .first(
      'u.user_id', 'u.email', 'u.status', 'u.email_verified_at',
      'u.two_fa_enabled', 'u.last_login_at', 'u.created_at',
      'r.role_name'
    );

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  // Decrypt email before returning
  try { user.email = decrypt(user.email); } catch { user.email = '[encrypted]'; }

  res.json({ success: true, data: user });
});
