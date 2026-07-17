import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services';
import { LoginDto, RefreshDto } from '../dto';
import { ok, created } from '../../../core/http';
import type { AuthenticatedRequest } from '../../../core/rbac';
import { authenticate } from '../../../core/rbac';
import type { PermissionResolver } from '../../../core/rbac';
import type { DbClient } from '@taralaya/db';

export function createAuthRouter(db: DbClient, resolver: PermissionResolver): Router {
  const router = Router();
  const svc = new AuthService(db);

  // POST /auth/login — public
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = LoginDto.parse(req.body);
      const ip = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await svc.login(dto, ip, userAgent);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  });

  // POST /auth/refresh — public
  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = RefreshDto.parse(req.body);
      const tokens = await svc.refresh(dto.refreshToken);
      ok(res, tokens);
    } catch (err) {
      next(err);
    }
  });

  // POST /auth/logout — authenticated
  router.post(
    '/logout',
    authenticate(resolver),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as AuthenticatedRequest;
        await svc.logout(r.sessionId, r.userId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /auth/me — authenticated
  router.get(
    '/me',
    authenticate(resolver),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as AuthenticatedRequest;
        const user = await svc.me(r.userId);
        ok(res, user);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
