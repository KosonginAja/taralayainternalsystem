import {
  bigint,
  boolean,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { id, auditColumns, softDelete } from './_helpers';

// ─────────────────────────────────────────────
// users
// ─────────────────────────────────────────────
export const users = mysqlTable(
  'users',
  {
    id: id(),
    email: varchar('email', { length: 255 }).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { mode: 'date', fsp: 0 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    passwordAlgo: varchar('password_algo', { length: 32 })
      .notNull()
      .default('argon2id'),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    displayName: varchar('display_name', { length: 150 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    phone: varchar('phone', { length: 32 }),
    locale: varchar('locale', { length: 8 }).notNull().default('en'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
    status: varchar('status', { length: 32 }).notNull().default('invited'),
    lastLoginAt: timestamp('last_login_at', { mode: 'date', fsp: 0 }),
    lastLoginIp: varchar('last_login_ip', { length: 45 }),
    failedLoginCount: int('failed_login_count', { unsigned: true })
      .notNull()
      .default(0),
    lockedUntil: timestamp('locked_until', { mode: 'date', fsp: 0 }),
    isFounder: boolean('is_founder').notNull().default(false),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    uqEmail: uniqueIndex('uq_users_email').on(t.email),
    idxStatus: index('idx_users_status').on(t.status),
    idxDeletedAt: index('idx_users_deleted_at').on(t.deletedAt),
  }),
);

// ─────────────────────────────────────────────
// roles
// ─────────────────────────────────────────────
export const roles = mysqlTable(
  'roles',
  {
    id: id(),
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
    priority: int('priority').notNull().default(0),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    uqKey: uniqueIndex('uq_roles_key').on(t.key),
    idxDeletedAt: index('idx_roles_deleted_at').on(t.deletedAt),
  }),
);

// ─────────────────────────────────────────────
// permissions
// ─────────────────────────────────────────────
export const permissions = mysqlTable(
  'permissions',
  {
    id: id(),
    key: varchar('key', { length: 96 }).notNull(),
    module: varchar('module', { length: 32 }).notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    description: varchar('description', { length: 255 }),
    isSystem: boolean('is_system').notNull().default(true),
  },
  (t) => ({
    uqKey: uniqueIndex('uq_permissions_key').on(t.key),
    idxModule: index('idx_permissions_module').on(t.module),
  }),
);

// ─────────────────────────────────────────────
// role_permissions
// ─────────────────────────────────────────────
export const rolePermissions = mysqlTable(
  'role_permissions',
  {
    id: id(),
    roleId: bigint('role_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: bigint('permission_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    uqRolePerm: uniqueIndex('uq_role_perm').on(t.roleId, t.permissionId),
    idxRole: index('idx_rp_role').on(t.roleId),
    idxPerm: index('idx_rp_perm').on(t.permissionId),
  }),
);

// ─────────────────────────────────────────────
// user_roles
// ─────────────────────────────────────────────
export const userRoles = mysqlTable(
  'user_roles',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: bigint('role_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    assignedAt: timestamp('assigned_at', { mode: 'date', fsp: 0 })
      .notNull()
      .defaultNow(),
    assignedBy: bigint('assigned_by', { mode: 'bigint', unsigned: true }),
    ...auditColumns(),
  },
  (t) => ({
    uqUserRole: uniqueIndex('uq_user_role').on(t.userId, t.roleId),
    idxUser: index('idx_ur_user').on(t.userId),
    idxRole: index('idx_ur_role').on(t.roleId),
  }),
);

// ─────────────────────────────────────────────
// sessions
// ─────────────────────────────────────────────
export const sessions = mysqlTable(
  'sessions',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    issuedAt: timestamp('issued_at', { mode: 'date', fsp: 0 })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { mode: 'date', fsp: 0 }).notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date', fsp: 0 }),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 0 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uqTokenHash: uniqueIndex('uq_sessions_token').on(t.tokenHash),
    idxUser: index('idx_sessions_user').on(t.userId, t.expiresAt),
    idxExpires: index('idx_sessions_expires').on(t.expiresAt),
  }),
);

// ─────────────────────────────────────────────
// refresh_tokens
// ─────────────────────────────────────────────
export const refreshTokens = mysqlTable(
  'refresh_tokens',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: bigint('session_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date', fsp: 0 }).notNull(),
    usedAt: timestamp('used_at', { mode: 'date', fsp: 0 }),
    rotatedTo: bigint('rotated_to', { mode: 'bigint', unsigned: true }),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 0 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uqTokenHash: uniqueIndex('uq_rt_token').on(t.tokenHash),
    idxUser: index('idx_rt_user').on(t.userId),
    idxSession: index('idx_rt_session').on(t.sessionId),
  }),
);

// ─────────────────────────────────────────────
// api_keys
// ─────────────────────────────────────────────
export const apiKeys = mysqlTable(
  'api_keys',
  {
    id: id(),
    name: varchar('name', { length: 120 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull(),
    scopes: text('scopes').notNull().default('[]'), // JSON array of permission keys
    ownerId: bigint('owner_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    lastUsedAt: timestamp('last_used_at', { mode: 'date', fsp: 0 }),
    expiresAt: timestamp('expires_at', { mode: 'date', fsp: 0 }),
    revokedAt: timestamp('revoked_at', { mode: 'date', fsp: 0 }),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    uqKeyHash: uniqueIndex('uq_apikeys_hash').on(t.keyHash),
    idxPrefix: index('idx_apikeys_prefix').on(t.keyPrefix),
  }),
);

// ─────────────────────────────────────────────
// password_reset_tokens
// ─────────────────────────────────────────────
export const passwordResetTokens = mysqlTable(
  'password_reset_tokens',
  {
    id: id(),
    userId: bigint('user_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date', fsp: 0 }).notNull(),
    usedAt: timestamp('used_at', { mode: 'date', fsp: 0 }),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 0 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uqTokenHash: uniqueIndex('uq_prt_token').on(t.tokenHash),
    idxUser: index('idx_prt_user').on(t.userId),
  }),
);

// ─────────────────────────────────────────────
// audit_logs
// ─────────────────────────────────────────────
export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: id(),
    actorId: bigint('actor_id', { mode: 'bigint', unsigned: true }),
    action: varchar('action', { length: 48 }).notNull(),
    entityType: varchar('entity_type', { length: 60 }).notNull(),
    entityId: bigint('entity_id', { mode: 'bigint', unsigned: true }),
    before: text('before'), // JSON
    after: text('after'), // JSON
    diff: text('diff'), // JSON
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    route: varchar('route', { length: 255 }),
    method: varchar('method', { length: 10 }),
    result: varchar('result', { length: 16 }).notNull().default('success'),
    error: text('error'),
    occurredAt: timestamp('occurred_at', { mode: 'date', fsp: 0 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxActorTime: index('idx_audit_actor_time').on(t.actorId, t.occurredAt),
    idxEntity: index('idx_audit_entity').on(
      t.entityType,
      t.entityId,
      t.occurredAt,
    ),
    idxActionTime: index('idx_audit_action_time').on(t.action, t.occurredAt),
    idxTime: index('idx_audit_time').on(t.occurredAt),
  }),
);

// ─────────────────────────────────────────────
// activity_timeline
// ─────────────────────────────────────────────
export const activityTimeline = mysqlTable(
  'activity_timeline',
  {
    id: id(),
    actorId: bigint('actor_id', { mode: 'bigint', unsigned: true }),
    verb: varchar('verb', { length: 64 }).notNull(),
    verbSubject: varchar('verb_subject', { length: 64 }),
    entityType: varchar('entity_type', { length: 60 }).notNull(),
    entityId: bigint('entity_id', { mode: 'bigint', unsigned: true }).notNull(),
    projectId: bigint('project_id', { mode: 'bigint', unsigned: true }),
    clientId: bigint('client_id', { mode: 'bigint', unsigned: true }),
    description: varchar('description', { length: 500 }).notNull(),
    metadata: text('metadata'), // JSON
    isPublic: boolean('is_public').notNull().default(false),
    occurredAt: timestamp('occurred_at', { mode: 'date', fsp: 0 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    idxProjectTime: index('idx_act_project_time').on(t.projectId, t.occurredAt),
    idxClientTime: index('idx_act_client_time').on(t.clientId, t.occurredAt),
    idxEntity: index('idx_act_entity').on(t.entityType, t.entityId),
    idxActor: index('idx_act_actor').on(t.actorId, t.occurredAt),
    idxTime: index('idx_act_time').on(t.occurredAt),
  }),
);

// ─────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  sessions: many(sessions),
  refreshTokens: many(refreshTokens),
  apiKeys: many(apiKeys),
  passwordResetTokens: many(passwordResetTokens),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
    permission: one(permissions, {
      fields: [rolePermissions.permissionId],
      references: [permissions.id],
    }),
  }),
);

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
  session: one(sessions, {
    fields: [refreshTokens.sessionId],
    references: [sessions.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  owner: one(users, { fields: [apiKeys.ownerId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

// Exported types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ActivityEntry = typeof activityTimeline.$inferSelect;
export type NewActivityEntry = typeof activityTimeline.$inferInsert;
