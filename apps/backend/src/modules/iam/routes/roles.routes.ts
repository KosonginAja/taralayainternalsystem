import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { RoleService, PermissionService } from '../services';
import { CreateRoleDto, UpdateRoleDto, ReplaceRolePermissionsDto } from '../dto';
import { ok, created, noContent } from '../../../core/http';
import { authenticate, requirePermission } from '../../../core/rbac';
import type { AuthenticatedRequest, PermissionResolver } from '../../../core/rbac';
import { PERMISSIONS } from '@taralaya/shared';
import type { DbClient } from '@taralaya/db';

export function createRolesRouter(db: DbClient, resolver: PermissionResolver): Router {
  const router = Router();
  const svc = new RoleService(db);
  const auth = authenticate(resolver);

  // GET /roles
  router.get('/', auth, requirePermission(PERMISSIONS.ROLE_VIEW), async (req, res, next) => {
    try { ok(res, await svc.list()); } catch (err) { next(err); }
  });

  // POST /roles
  router.post('/', auth, requirePermission(PERMISSIONS.ROLE_CREATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AuthenticatedRequest;
      const dto = CreateRoleDto.parse(req.body);
      created(res, await svc.create(dto, r.userId));
    } catch (err) { next(err); }
  });

  // GET /roles/:id
  router.get('/:id', auth, requirePermission(PERMISSIONS.ROLE_VIEW), async (req, res, next) => {
    try { ok(res, await svc.getById(BigInt(req.params.id))); } catch (err) { next(err); }
  });

  // PATCH /roles/:id
  router.patch('/:id', auth, requirePermission(PERMISSIONS.ROLE_UPDATE), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AuthenticatedRequest;
      ok(res, await svc.update(BigInt(req.params.id), UpdateRoleDto.parse(req.body), r.userId));
    } catch (err) { next(err); }
  });

  // DELETE /roles/:id
  router.delete('/:id', auth, requirePermission(PERMISSIONS.ROLE_DELETE), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AuthenticatedRequest;
      await svc.delete(BigInt(req.params.id), r.userId);
      noContent(res);
    } catch (err) { next(err); }
  });

  // PUT /roles/:id/permissions
  router.put('/:id/permissions', auth, requirePermission(PERMISSIONS.ROLE_PERMISSION_CHANGE), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = req as AuthenticatedRequest;
      await svc.replacePermissions(BigInt(req.params.id), ReplaceRolePermissionsDto.parse(req.body), r.userId);
      noContent(res);
    } catch (err) { next(err); }
  });

  return router;
}

export function createPermissionsRouter(db: DbClient, resolver: PermissionResolver): Router {
  const router = Router();
  const svc = new PermissionService(db);
  const auth = authenticate(resolver);

  // GET /permissions
  router.get('/', auth, requirePermission(PERMISSIONS.PERMISSION_VIEW), async (req, res, next) => {
    try { ok(res, await svc.list()); } catch (err) { next(err); }
  });

  return router;
}
