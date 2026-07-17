import { describe, it, expect } from '@jest/globals';
import { PermissionResolver } from '../core/rbac/permission-resolver';

// Mock DB client for unit tests
function makeDb(permsForUser: string[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => permsForUser.map((key: string) => ({ key })),
        innerJoin: () => ({
          where: () => permsForUser.map((key: string) => ({ key })),
        }),
      }),
    }),
  } as any;
}

describe('PermissionResolver', () => {
  it('founder bypasses all checks', async () => {
    const resolver = new PermissionResolver(makeDb([]));
    const perms = await resolver.resolve(1n, true);
    expect(perms.has('*')).toBe(true);
  });

  it('returns empty set for user with no roles', async () => {
    // DB returns empty array for userRoles
    const db = {
      select: () => ({
        from: () => ({
          where: () => [],
          innerJoin: () => ({ where: () => [] }),
        }),
      }),
    } as any;
    const resolver = new PermissionResolver(db);
    const perms = await resolver.resolve(2n, false);
    expect(perms.size).toBe(0);
  });

  it('expands manage wildcard to imply view/create/update/delete/approve/export', async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => [{ roleId: 1n }],
          innerJoin: () => ({
            where: () => [{ key: 'invoice.manage' }],
          }),
        }),
      }),
    } as any;
    const resolver = new PermissionResolver(db);
    const perms = await resolver.resolve(3n, false);
    expect(perms.has('invoice.manage')).toBe(true);
    expect(perms.has('invoice.view')).toBe(true);
    expect(perms.has('invoice.create')).toBe(true);
    expect(perms.has('invoice.delete')).toBe(true);
    expect(perms.has('invoice.approve')).toBe(true);
    expect(perms.has('invoice.export')).toBe(true);
    // should NOT imply unrelated permissions
    expect(perms.has('user.view')).toBe(false);
  });

  it('caches results on second call', async () => {
    let callCount = 0;
    const db = {
      select: () => {
        callCount++;
        return {
          from: () => ({
            where: () => [{ roleId: 1n }],
            innerJoin: () => ({
              where: () => [{ key: 'user.view' }],
            }),
          }),
        };
      },
    } as any;
    const resolver = new PermissionResolver(db);
    await resolver.resolve(4n, false);
    await resolver.resolve(4n, false);
    // DB should only be queried once
    expect(callCount).toBeLessThanOrEqual(2);
  });

  it('invalidates cache on demand', async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => [{ roleId: 1n }],
          innerJoin: () => ({
            where: () => [{ key: 'user.view' }],
          }),
        }),
      }),
    } as any;
    const resolver = new PermissionResolver(db);
    await resolver.resolve(5n, false);
    resolver.invalidate(5n);
    const perms = await resolver.resolve(5n, false);
    expect(perms.has('user.view')).toBe(true);
  });
});
