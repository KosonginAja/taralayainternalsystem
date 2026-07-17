import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { UserService } from '../services';
import { CreateUserDto, UpdateUserDto, AssignRolesDto } from '../dto';
import { ok, created, noContent, paginatedOk } from '../../../core/http';
import { authenticate, requirePermission } from '../../../core/rbac';
import type { AuthenticatedRequest, PermissionResolver } from '../../../core/rbac';
import { PaginationQuery } from '../../../core/validation';
import { PERMISSIONS } from '@taralaya/shared';
import type { DbClient } from '@taralaya/db';

export function createUsersRouter(db: DbClient, resolver: PermissionResolver): Router {
  const router = Router();
  const svc = new UserService(db);
  const auth = authenticate(resolver);

  // GET /users
  router.get(
    '/',
    auth,
    requirePermission(PERMISSIONS.USER_VIEW),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { page, perPage } = PaginationQuery.parse(req.query);
        const { items, total } = await svc.list(page, perPage);
        paginatedOk(res, items.map(({ passwordHash: _, ...u }) => u), total, page, perPage);
      } catch (err) { next(err); }
    },
  );

  // POST /users
  router.post(
    '/',
    auth,
    requirePermission(PERMISSIONS.USER_CREATE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as AuthenticatedRequest;
        const dto = CreateUserDto.parse(req.body);
        const user = await svc.create(dto, r.userId);
        created(res, user);
      } catch (err) { next(err); }
    },
  );

  // GET /users/:id
  router.get(
    '/:id',
    auth,
    requirePermission(PERMISSIONS.USER_VIEW),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = BigInt(req.params.id);
        const user = await svc.getById(id);
        ok(res, user);
      } catch (err) { next(err); }
    },
  );

  // PATCH /users/:id
  router.patch(
    '/:id',
    auth,
    requirePermission(PERMISSIONS.USER_UPDATE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as AuthenticatedRequest;
        const id = BigInt(req.params.id);
        const dto = UpdateUserDto.parse(req.body);
        const user = await svc.update(id, dto, r.userId);
        ok(res, user);
      } catch (err) { next(err); }
    },
  );

  // DELETE /users/:id
  router.delete(
    '/:id',
    auth,
    requirePermission(PERMISSIONS.USER_DELETE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as AuthenticatedRequest;
        const id = BigInt(req.params.id);
        await svc.delete(id, r.userId);
        noContent(res);
      } catch (err) { next(err); }
    },
  );

  // POST /users/:id/activate
  router.post(
    '/:id/activate',
    auth,
    requirePermission(PERMISSIONS.USER_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as AuthenticatedRequest;
        const id = BigInt(req.params.id);
        const user = await svc.activate(id, r.userId);
        ok(res, user);
      } catch (err) { next(err); }
    },
  );

  // POST /users/:id/suspend
  router.post(
    '/:id/suspend',
    auth,
    requirePermission(PERMISSIONS.USER_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as AuthenticatedRequest;
        const id = BigInt(req.params.id);
        const user = await svc.suspend(id, r.userId);
        ok(res, user);
      } catch (err) { next(err); }
    },
  );

  // POST /users/:id/deactivate
  router.post(
    '/:id/deactivate',
    auth,
    requirePermission(PERMISSIONS.USER_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as AuthenticatedRequest;
        const id = BigInt(req.params.id);
        await svc.deactivate(id, r.userId, r.isFounder);
        noContent(res);
      } catch (err) { next(err); }
    },
  );

  // GET /users/:id/roles
  router.get(
    '/:id/roles',
    auth,
    requirePermission(PERMISSIONS.USER_VIEW),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = BigInt(req.params.id);
        const roles = await svc.getUserRoles(id);
        ok(res, roles);
      } catch (err) { next(err); }
    },
  );

  // POST /users/:id/roles
  router.post(
    '/:id/roles',
    auth,
    requirePermission(PERMISSIONS.USER_MANAGE),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const r = req as AuthenticatedRequest;
        const id = BigInt(req.params.id);
        const dto = AssignRolesDto.parse(req.body);
        await svc.assignRoles(id, dto, r.userId);
        noContent(res);
      } catch (err) { next(err); }
    },
  );

  return router;
}
