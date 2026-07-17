import { z } from 'zod';

// ─── Auth DTOs ──────────────────────────────────
export const LoginDto = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginDto>;

export const RefreshDto = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshDto = z.infer<typeof RefreshDto>;

export const ForgotPasswordDto = z.object({
  email: z.string().email().toLowerCase().trim(),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>;

export const ResetPasswordDto = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>;

// ─── User DTOs ──────────────────────────────────
export const CreateUserDto = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(150),
  displayName: z.string().max(150).optional(),
  phone: z.string().max(32).optional(),
  locale: z.string().max(8).default('en'),
  timezone: z.string().max(64).default('UTC'),
  roleKeys: z.array(z.string()).default([]),
});
export type CreateUserDto = z.infer<typeof CreateUserDto>;

export const UpdateUserDto = z.object({
  fullName: z.string().min(1).max(150).optional(),
  displayName: z.string().max(150).optional(),
  phone: z.string().max(32).optional(),
  locale: z.string().max(8).optional(),
  timezone: z.string().max(64).optional(),
  avatarUrl: z.string().url().optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserDto>;

export const AssignRolesDto = z.object({
  roleKeys: z.array(z.string()).min(1),
});
export type AssignRolesDto = z.infer<typeof AssignRolesDto>;

// ─── Role DTOs ──────────────────────────────────
export const CreateRoleDto = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z_]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  priority: z.number().int().default(0),
  permissionKeys: z.array(z.string()).default([]),
});
export type CreateRoleDto = z.infer<typeof CreateRoleDto>;

export const UpdateRoleDto = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  priority: z.number().int().optional(),
});
export type UpdateRoleDto = z.infer<typeof UpdateRoleDto>;

export const ReplaceRolePermissionsDto = z.object({
  permissionKeys: z.array(z.string()),
});
export type ReplaceRolePermissionsDto = z.infer<typeof ReplaceRolePermissionsDto>;

// ─── API Key DTOs ───────────────────────────────
export const CreateApiKeyDto = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
});
export type CreateApiKeyDto = z.infer<typeof CreateApiKeyDto>;
