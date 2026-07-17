import type { Request, Response, NextFunction } from 'express';
import { JwtService } from '../auth/jwt.service';
import { PermissionResolver } from './permission-resolver';
import type { PermissionKey } from '@taralaya/shared';
import { UnauthorizedError, ForbiddenError } from '../errors';
import type { DbClient } from '@taralaya/db';

const jwtService = new JwtService();

export interface AuthenticatedRequest extends Request {
  userId: bigint;
  sessionId: bigint;
  isFounder: boolean;
  permissionResolver: PermissionResolver;
}

/**
 * Middleware that validates the Bearer JWT and attaches user context to request.
 */
export function authenticate(resolver: PermissionResolver) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new UnauthorizedError('No bearer token provided'));
    }

    try {
      const token = authHeader.slice(7);
      const payload = jwtService.verifyAccessToken(token);
      const r = req as AuthenticatedRequest;
      r.userId = payload.userId;
      r.sessionId = payload.sessionId;
      r.isFounder = payload.isFounder;
      r.permissionResolver = resolver;
      next();
    } catch {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  };
}

/**
 * Route middleware factory that enforces a permission key.
 * Usage: router.get('/invoices', requirePermission('invoice.view'), handler)
 */
export function requirePermission(key: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const r = req as AuthenticatedRequest;
    if (!r.userId) return next(new UnauthorizedError());

    try {
      await r.permissionResolver.require(r.userId, r.isFounder, key);
      next();
    } catch (err) {
      next(err);
    }
  };
}
