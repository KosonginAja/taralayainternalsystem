import { eq, and, isNull } from 'drizzle-orm';
import { users, roles, settings } from '@taralaya/db';
import type { DbClient, User } from '@taralaya/db';
import { PasswordService } from '../../../core/auth/password.service';
import { SessionService } from '../../../core/auth/session.service';
import { JwtService } from '../../../core/auth/jwt.service';
import { AuditService } from '../../../core/audit';
import { ActivityService } from '../../../core/audit';
import { eventBus, Events } from '../../../core/events';
import { UserRepository, RoleRepository, PermissionRepository } from '../repositories';
import { assertUserTransition } from '../domain/user-state-machine';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ForbiddenError,
} from '../../../core/errors';
import type {
  LoginDto,
  CreateUserDto,
  UpdateUserDto,
  AssignRolesDto,
  CreateRoleDto,
  UpdateRoleDto,
  ReplaceRolePermissionsDto,
} from '../dto';

// ─────────────────────────────────────────────
// AuthService
// ─────────────────────────────────────────────
export class AuthService {
  private readonly pwd = new PasswordService();
  private readonly session: SessionService;
  private readonly audit: AuditService;
  private readonly userRepo: UserRepository;

  constructor(private readonly db: DbClient) {
    this.audit = new AuditService(db);
    this.session = new SessionService(db);
    this.userRepo = new UserRepository(db, this.audit);
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      await this.audit.record({
        action: 'login_failed',
        entityType: 'user',
        ipAddress: ip,
        after: { email: dto.email, reason: 'user_not_found' },
        result: 'failure',
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    const valid = await this.pwd.verify(user.passwordHash, dto.password);

    if (!valid) {
      // Load max failed attempts from settings
      const [maxAttemptsSetting] = await this.db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, 'auth.max_failed_attempts'))
        .limit(1);
      const maxAttempts = parseInt(maxAttemptsSetting?.value ?? '5', 10);

      const newCount = (user.failedLoginCount ?? 0) + 1;
      if (newCount >= maxAttempts) {
        const lockDuration = 15; // minutes — from settings ideally
        const lockedUntil = new Date(Date.now() + lockDuration * 60 * 1000);
        await this.userRepo.lockAccount(user.id, lockedUntil);
      } else {
        await this.db
          .execute(`UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = ${user.id}` as any);
      }

      eventBus.emit(Events.USER_LOGIN_FAILED, { userId: user.id, email: user.email });
      await this.audit.record({
        action: 'login_failed',
        entityType: 'user',
        entityId: user.id,
        ipAddress: ip,
        result: 'failure',
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    // Successful login
    await this.userRepo.resetFailedLoginCount(user.id);
    await this.db.update(users).set({ lastLoginAt: new Date(), lastLoginIp: ip }).where(eq(users.id, user.id));

    const tokens = await this.session.create(user.id, user.isFounder, { ip, userAgent });

    await this.audit.record({ actorId: user.id, action: 'login', entityType: 'user', entityId: user.id, ipAddress: ip });
    eventBus.emit(Events.USER_LOGGED_IN, { userId: user.id });

    return { user: this.sanitize(user), ...tokens };
  }

  async refresh(rawRefreshToken: string) {
    // We need isFounder to re-issue the access token
    // We derive it from the session — simplified: always false unless resolved
    // A full implementation would look up the user by session; this is sufficient for Wave A
    return this.session.rotateRefreshToken(rawRefreshToken, false);
  }

  async logout(sessionId: bigint, userId: bigint) {
    await this.session.revokeSession(sessionId);
    await this.audit.record({ actorId: userId, action: 'logout', entityType: 'user', entityId: userId });
    eventBus.emit(Events.USER_LOGGED_OUT, { userId, sessionId });
  }

  async me(userId: bigint) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    return this.sanitize(user);
  }

  private sanitize(user: User) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}

// ─────────────────────────────────────────────
// UserService
// ─────────────────────────────────────────────
export class UserService {
  private readonly pwd = new PasswordService();
  private readonly audit: AuditService;
  private readonly activity: ActivityService;
  private readonly userRepo: UserRepository;
  private readonly roleRepo: RoleRepository;

  constructor(private readonly db: DbClient) {
    this.audit = new AuditService(db);
    this.activity = new ActivityService(db);
    this.userRepo = new UserRepository(db, this.audit);
    this.roleRepo = new RoleRepository(db, this.audit);
  }

  async list(page: number, perPage: number) {
    const offset = (page - 1) * perPage;
    return this.userRepo.list(offset, perPage);
  }

  async getById(id: bigint) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User', id);
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async create(dto: CreateUserDto, actorId?: bigint) {
    const passwordHash = await this.pwd.hash(dto.password);
    const user = await this.userRepo.create(
      {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        displayName: dto.displayName,
        phone: dto.phone,
        locale: dto.locale,
        timezone: dto.timezone,
        status: 'invited',
        isFounder: false,
      },
      actorId,
    );

    // Assign requested roles
    if (dto.roleKeys.length > 0) {
      for (const key of dto.roleKeys) {
        const role = await this.roleRepo.findByKey(key);
        if (role) await this.userRepo.assignRole(user.id, role.id, actorId);
      }
    }

    eventBus.emit(Events.USER_CREATED, { userId: user.id });
    await this.activity.log({
      verb: 'created',
      actorId,
      entityType: 'user',
      entityId: user.id,
      description: `User ${user.email} was created`,
    });

    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async update(id: bigint, dto: UpdateUserDto, actorId?: bigint) {
    const user = await this.userRepo.update(id, dto, actorId);
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async activate(id: bigint, actorId?: bigint) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User', id);
    assertUserTransition(user.status as any, 'active');
    return this.userRepo.update(id, { status: 'active' }, actorId);
  }

  async suspend(id: bigint, actorId?: bigint) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User', id);
    if (user.isFounder) throw new ForbiddenError('Cannot suspend the founder');
    assertUserTransition(user.status as any, 'suspended');
    return this.userRepo.update(id, { status: 'suspended' }, actorId);
  }

  async deactivate(id: bigint, actorId?: bigint, isActorFounder = false) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User', id);
    if (user.isFounder && !isActorFounder) {
      throw new ForbiddenError('Only the founder can deactivate the founder account');
    }
    assertUserTransition(user.status as any, 'deactivated');
    return this.userRepo.update(id, { status: 'deactivated' }, actorId);
  }

  async delete(id: bigint, actorId?: bigint) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User', id);
    if (user.isFounder) throw new ForbiddenError('Cannot delete the founder');
    await this.userRepo.softDelete(id, actorId);
  }

  async assignRoles(id: bigint, dto: AssignRolesDto, actorId?: bigint) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError('User', id);

    for (const key of dto.roleKeys) {
      const role = await this.roleRepo.findByKey(key);
      if (!role) throw new NotFoundError('Role', key);
      await this.userRepo.assignRole(id, role.id, actorId);
      eventBus.emit(Events.USER_ROLE_ASSIGNED, { userId: id, roleKey: key });
    }
  }

  async getUserRoles(id: bigint) {
    return this.userRepo.getUserRoles(id);
  }
}

// ─────────────────────────────────────────────
// RoleService
// ─────────────────────────────────────────────
export class RoleService {
  private readonly audit: AuditService;
  private readonly roleRepo: RoleRepository;
  private readonly permRepo: PermissionRepository;

  constructor(private readonly db: DbClient) {
    this.audit = new AuditService(db);
    this.roleRepo = new RoleRepository(db, this.audit);
    this.permRepo = new PermissionRepository(db);
  }

  async list() {
    return this.roleRepo.list();
  }

  async getById(id: bigint) {
    const role = await this.roleRepo.findById(id);
    if (!role) throw new NotFoundError('Role', id);
    return role;
  }

  async create(dto: CreateRoleDto, actorId?: bigint) {
    const role = await this.roleRepo.create(
      { key: dto.key, name: dto.name, description: dto.description, priority: dto.priority, isSystem: false },
      actorId,
    );
    if (dto.permissionKeys.length > 0) {
      await this.roleRepo.replacePermissions(role.id, dto.permissionKeys, actorId);
    }
    eventBus.emit(Events.ROLE_CREATED, { roleId: role.id });
    return role;
  }

  async update(id: bigint, dto: UpdateRoleDto, actorId?: bigint) {
    return this.roleRepo.update(id, dto, actorId);
  }

  async delete(id: bigint, actorId?: bigint) {
    const role = await this.roleRepo.findById(id);
    if (!role) throw new NotFoundError('Role', id);
    if (role.isSystem) throw new BusinessRuleError('System roles cannot be deleted');
    await this.roleRepo.softDelete(id, actorId);
    eventBus.emit(Events.ROLE_DELETED, { roleId: id });
  }

  async replacePermissions(id: bigint, dto: ReplaceRolePermissionsDto, actorId?: bigint) {
    await this.roleRepo.replacePermissions(id, dto.permissionKeys, actorId);
    eventBus.emit(Events.PERMISSION_GRANTED, { roleId: id, keys: dto.permissionKeys });
  }
}

// ─────────────────────────────────────────────
// PermissionService
// ─────────────────────────────────────────────
export class PermissionService {
  private readonly permRepo: PermissionRepository;
  constructor(private readonly db: DbClient) {
    this.permRepo = new PermissionRepository(db);
  }
  async list() {
    return this.permRepo.list();
  }
}
