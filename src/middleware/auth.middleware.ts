import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../config/database';
import { redis } from '../config/redis';

export interface JwtPayload {
  userId:    string;
  roleId:    number;
  roleName?: string;
  iat?:      number;
  exp?:      number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Verifies the Bearer JWT and attaches decoded payload to req.user.
 * Checks token against Redis deny-list (for revoked/logged-out tokens).
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authorization token required' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;

    // Check deny-list (logout / token revocation)
    const revoked = await redis.get(`denied_token:${token.slice(-16)}`);
    if (revoked) {
      res.status(401).json({ success: false, message: 'Token has been revoked' });
      return;
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token expired' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  }
}

/**
 * Role-based access control middleware.
 * Pass one or more allowed role names.
 */
export function requireRoles(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const role = await db('dfb_roles')
      .where({ role_id: req.user.roleId })
      .first('role_name');

    if (!role || !allowedRoles.includes(role.role_name)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    req.user.roleName = role.role_name;
    next();
  };
}
