import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'changeme';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@taralaya.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme';

export interface AuthRequest extends Request {
  admin?: { email: string };
  user?: { id: string; email: string; role: string };
}

/**
 * Verify JWT from cookie and attach user to request.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.role) {
      req.user = { id: payload.id, email: payload.email, role: payload.role };
    } else {
      // Legacy support for early implementation tokens that only had email
      req.user = { id: '', email: payload.email, role: 'admin' };
    }
    // Also set admin for backwards compatibility with any remaining code
    req.admin = { email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require user to be an admin
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }
  next();
}

export { JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD };
