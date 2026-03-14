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

    // Check blocklist (logout / token revocation) using sha256(token)
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const revoked = await redis.get(`blocklist:${tokenHash}`);
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

type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'export' | 'impersonate';

async function resolveRoleName(roleId: number): Promise<string | null> {
  const cacheKey = `perm:role-name:${roleId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const role = await db('dfb_roles').where({ role_id: roleId }).first('role_name');
  const roleName = role?.role_name || null;
  if (roleName) await redis.setex(cacheKey, 60, roleName);
  return roleName;
}

async function roleHasCustomPermissions(roleId: number, userId: string): Promise<boolean> {
  const cacheKey = `perm:any:${roleId}:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return cached === '1';

  const [{ total }] = await db('dfb_permissions')
    .where({ role_id: roleId })
    .orWhere({ user_id: userId })
    .count('permission_id as total');

  const hasAny = Number(total || 0) > 0;
  await redis.setex(cacheKey, 60, hasAny ? '1' : '0');
  return hasAny;
}

async function hasPermission(roleId: number, userId: string, resource: string, action: PermissionAction): Promise<boolean> {
  const cacheKey = `perm:${roleId}:${userId}:${resource}:${action}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return cached === '1';

  const permission = await db('dfb_permissions')
    .where(function whereRoleOrUser() {
      this.where({ role_id: roleId }).orWhere({ user_id: userId });
    })
    .andWhere({ resource, action })
    .first('permission_id');

  const allowed = Boolean(permission?.permission_id);
  await redis.setex(cacheKey, 60, allowed ? '1' : '0');
  return allowed;
}

export function requirePermission(resource: string, action: PermissionAction, fallbackRoles: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const roleName = await resolveRoleName(req.user.roleId);
    if (!roleName) {
      res.status(403).json({ success: false, message: 'Role not found' });
      return;
    }
    req.user.roleName = roleName;

    if (roleName === 'Super Admin') {
      next();
      return;
    }

    const hasCustomPermRows = await roleHasCustomPermissions(req.user.roleId, req.user.userId);
    if (hasCustomPermRows) {
      const allowed = await hasPermission(req.user.roleId, req.user.userId, resource, action);
      if (!allowed) {
        res.status(403).json({
          success: false,
          message: `Access denied for ${resource}.${action}. Update role permissions in admin panel.`,
        });
        return;
      }
      next();
      return;
    }

    if (fallbackRoles.includes(roleName)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: `Access denied for ${resource}.${action}`,
    });
  };
}
