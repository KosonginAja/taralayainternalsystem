import { eq, inArray } from 'drizzle-orm';
import { users, userRoles, roles, rolePermissions, permissions } from '@taralaya/db';
import type { DbClient } from '@taralaya/db';
import type { PermissionKey } from '@taralaya/shared';
import { ForbiddenError, UnauthorizedError } from '../errors';

interface CacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * PermissionResolver — resolves and caches the merged permission set for a user.
 *
 * Algorithm (Phase 10 §10.4):
 * 1. Founder → bypass (allow all).
 * 2. Fetch user roles → fetch all granted permissions → merge (union).
 * 3. Expand wildcards: `<module>.manage` implies view/create/update/delete/approve/export.
 * 4. Cache for TTL_MS; invalidate on role/permission change.
 */
export class PermissionResolver {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly db: DbClient) {}

  /**
   * Returns the resolved, expanded permission set for the user.
   */
  async resolve(userId: bigint, isFounder: boolean): Promise<Set<string>> {
    if (isFounder) return new Set(['*']);

    const cacheKey = userId.toString();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    // Fetch roles for user
    const userRoleRows = await this.db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));

    if (userRoleRows.length === 0) {
      const empty = new Set<string>();
      this.setCache(cacheKey, empty);
      return empty;
    }

    const roleIds = userRoleRows.map((r) => r.roleId);

    // Fetch permissions for those roles
    const permRows = await this.db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds));

    const permSet = new Set(permRows.map((r) => r.key));
    const expanded = this.expand(permSet);

    this.setCache(cacheKey, expanded);
    return expanded;
  }

  /**
   * Checks if a user has a specific permission key.
   * Throws ForbiddenError if not.
   */
  async require(
    userId: bigint,
    isFounder: boolean,
    key: PermissionKey,
  ): Promise<void> {
    const perms = await this.resolve(userId, isFounder);
    if (!this.has(perms, key)) {
      throw new ForbiddenError(`Missing permission: ${key}`);
    }
  }

  /**
   * Returns true if the permission set grants the given key
   * (including wildcard/manage expansion).
   */
  private has(perms: Set<string>, key: string): boolean {
    if (perms.has('*')) return true;
    if (perms.has(key)) return true;
    // Check module.manage wildcard
    const [module] = key.split('.');
    if (perms.has(`${module}.manage`)) return true;
    return false;
  }

  /**
   * Expands `<module>.manage` to imply the standard action set.
   */
  private expand(perms: Set<string>): Set<string> {
    const expanded = new Set(perms);
    const IMPLIED_ACTIONS = ['view', 'create', 'update', 'delete', 'approve', 'export'];

    for (const perm of perms) {
      if (perm.endsWith('.manage')) {
        const module = perm.replace('.manage', '');
        for (const action of IMPLIED_ACTIONS) {
          expanded.add(`${module}.${action}`);
        }
      }
    }
    return expanded;
  }

  private setCache(key: string, perms: Set<string>): void {
    this.cache.set(key, {
      permissions: perms,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /**
   * Invalidates the cache for a specific user.
   * Call on role assignment/revocation or permission changes.
   */
  invalidate(userId: bigint): void {
    this.cache.delete(userId.toString());
  }

  /**
   * Invalidates the entire cache (e.g., after bulk permission changes).
   */
  invalidateAll(): void {
    this.cache.clear();
  }
}
