import { eq, and, isNull, inArray } from 'drizzle-orm';
import {
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  sessions,
  refreshTokens,
  apiKeys,
  passwordResetTokens,
} from '@taralaya/db';
import type { DbClient, User, NewUser, Role, Permission } from '@taralaya/db';
import { NotFoundError, ConflictError } from '../../../core/errors';
import { AuditService } from '../../../core/audit';

/**
 * UserRepository — all CUD ops go through AuditService for auto-audit.
 */
export class UserRepository {
  constructor(
    private readonly db: DbClient,
    private readonly audit: AuditService,
  ) {}

  async findById(id: bigint): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  }

  async list(offset: number, limit: number): Promise<{ items: User[]; total: number }> {
    const items = await this.db
      .select()
      .from(users)
      .where(isNull(users.deletedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: this.db.$count(users) })
      .from(users)
      .where(isNull(users.deletedAt));

    return { items, total: Number(count) };
  }

  async create(data: NewUser, actorId?: bigint): Promise<User> {
    const existing = await this.findByEmail(data.email!);
    if (existing) throw new ConflictError(`Email '${data.email}' is already taken`);

    const [result] = await this.db.insert(users).values(data);
    const id = BigInt(result.insertId);
    const created = (await this.findById(id))!;

    await this.audit.record({
      actorId,
      action: 'insert',
      entityType: 'user',
      entityId: id,
      after: { ...created, passwordHash: '[REDACTED]' },
    });

    return created;
  }

  async update(id: bigint, data: Partial<User>, actorId?: bigint): Promise<User> {
    const before = await this.findById(id);
    if (!before) throw new NotFoundError('User', id);

    await this.db.update(users).set(data).where(eq(users.id, id));
    const after = (await this.findById(id))!;

    await this.audit.record({
      actorId,
      action: 'update',
      entityType: 'user',
      entityId: id,
      before: { ...before, passwordHash: '[REDACTED]' },
      after: { ...after, passwordHash: '[REDACTED]' },
    });

    return after;
  }

  async softDelete(id: bigint, actorId?: bigint): Promise<void> {
    const before = await this.findById(id);
    if (!before) throw new NotFoundError('User', id);

    await this.db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, id));

    await this.audit.record({
      actorId,
      action: 'delete',
      entityType: 'user',
      entityId: id,
      before: { id: before.id, email: before.email },
    });
  }

  async incrementFailedLoginCount(id: bigint): Promise<void> {
    await this.db
      .update(users)
      .set({
        failedLoginCount: this.db.$count(users) as any, // raw increment below
      });
    // Use raw SQL for atomic increment
    await this.db.execute(
      `UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = ${id}`,
    );
  }

  async lockAccount(id: bigint, until: Date): Promise<void> {
    await this.db.update(users).set({ lockedUntil: until }).where(eq(users.id, id));
  }

  async resetFailedLoginCount(id: bigint): Promise<void> {
    await this.db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: undefined })
      .where(eq(users.id, id));
  }

  async getUserRoles(userId: bigint): Promise<Role[]> {
    return this.db
      .select({ id: roles.id, key: roles.key, name: roles.name, description: roles.description, isSystem: roles.isSystem, priority: roles.priority, createdAt: roles.createdAt, updatedAt: roles.updatedAt, createdBy: roles.createdBy, updatedBy: roles.updatedBy, deletedAt: roles.deletedAt })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
  }

  async assignRole(userId: bigint, roleId: bigint, assignedBy?: bigint): Promise<void> {
    await this.db
      .insert(userRoles)
      .values({ userId, roleId, assignedBy })
      .onDuplicateKeyUpdate({ set: { userId } });

    await this.audit.record({
      actorId: assignedBy,
      action: 'role_assign',
      entityType: 'user',
      entityId: userId,
      after: { roleId: roleId.toString() },
    });
  }

  async revokeRole(userId: bigint, roleId: bigint, actorId?: bigint): Promise<void> {
    await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));

    await this.audit.record({
      actorId,
      action: 'role_assign',
      entityType: 'user',
      entityId: userId,
      before: { roleId: roleId.toString() },
    });
  }
}

/**
 * RoleRepository
 */
export class RoleRepository {
  constructor(
    private readonly db: DbClient,
    private readonly audit: AuditService,
  ) {}

  async findById(id: bigint): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
      .limit(1);
    return role ?? null;
  }

  async findByKey(key: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.key, key), isNull(roles.deletedAt)))
      .limit(1);
    return role ?? null;
  }

  async list(): Promise<Role[]> {
    return this.db.select().from(roles).where(isNull(roles.deletedAt));
  }

  async create(data: Partial<Role>, actorId?: bigint): Promise<Role> {
    const [result] = await this.db.insert(roles).values(data as any);
    const id = BigInt(result.insertId);
    const created = (await this.findById(id))!;
    await this.audit.record({ actorId, action: 'insert', entityType: 'role', entityId: id, after: created });
    return created;
  }

  async update(id: bigint, data: Partial<Role>, actorId?: bigint): Promise<Role> {
    const before = await this.findById(id);
    if (!before) throw new NotFoundError('Role', id);
    await this.db.update(roles).set(data).where(eq(roles.id, id));
    const after = (await this.findById(id))!;
    await this.audit.record({ actorId, action: 'update', entityType: 'role', entityId: id, before, after });
    return after;
  }

  async softDelete(id: bigint, actorId?: bigint): Promise<void> {
    const role = await this.findById(id);
    if (!role) throw new NotFoundError('Role', id);
    if (role.isSystem) throw new Error('Cannot delete a system role');
    await this.db.update(roles).set({ deletedAt: new Date() }).where(eq(roles.id, id));
    await this.audit.record({ actorId, action: 'delete', entityType: 'role', entityId: id, before: role });
  }

  async replacePermissions(
    roleId: bigint,
    permissionKeys: string[],
    actorId?: bigint,
  ): Promise<void> {
    // Fetch permission IDs for the given keys
    const permRows = await this.db
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.key, permissionKeys));

    const permIds = permRows.map((r) => r.id);

    await this.db.transaction(async (tx) => {
      // Delete all existing grants for this role
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      // Insert new grants
      if (permIds.length > 0) {
        await tx.insert(rolePermissions).values(
          permIds.map((permissionId) => ({ roleId, permissionId })),
        );
      }
    });

    await this.audit.record({
      actorId,
      action: 'permission_change',
      entityType: 'role',
      entityId: roleId,
      after: { permissionKeys },
    });
  }
}

/**
 * PermissionRepository (read-only — catalog is seeded, not user-managed)
 */
export class PermissionRepository {
  constructor(private readonly db: DbClient) {}

  async list(): Promise<Permission[]> {
    return this.db.select().from(permissions);
  }

  async findByKey(key: string): Promise<Permission | null> {
    const [p] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.key, key))
      .limit(1);
    return p ?? null;
  }
}
