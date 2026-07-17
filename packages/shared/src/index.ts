/**
 * All permission keys derived from Phase 10 permission matrix.
 * Format: <module>.<action>[.<scope>]
 */

// ─── IAM ───────────────────────────────────────
export const PERMISSIONS = {
  // User
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_MANAGE: 'user.manage',
  USER_PERMISSION_CHANGE: 'user.permission_change',
  USER_EXPORT: 'user.export',

  // Role
  ROLE_VIEW: 'role.view',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_PERMISSION_CHANGE: 'role.permission_change',

  // Permission
  PERMISSION_VIEW: 'permission.view',

  // API Key
  APIKEY_VIEW: 'apikey.view',
  APIKEY_CREATE: 'apikey.create',
  APIKEY_DELETE: 'apikey.delete',

  // ─── CRM ─────────────────────────────────────
  LEAD_VIEW: 'lead.view',
  LEAD_CREATE: 'lead.create',
  LEAD_UPDATE: 'lead.update',
  LEAD_DELETE: 'lead.delete',
  LEAD_MANAGE: 'lead.manage',
  LEAD_EXPORT: 'lead.export',

  CLIENT_VIEW: 'client.view',
  CLIENT_CREATE: 'client.create',
  CLIENT_UPDATE: 'client.update',
  CLIENT_DELETE: 'client.delete',
  CLIENT_MANAGE: 'client.manage',
  CLIENT_EXPORT: 'client.export',

  // ─── Sales ───────────────────────────────────
  PRICELIST_VIEW: 'pricelist.view',
  PRICELIST_CREATE: 'pricelist.create',
  PRICELIST_UPDATE: 'pricelist.update',
  PRICELIST_DELETE: 'pricelist.delete',

  QUOTATION_VIEW: 'quotation.view',
  QUOTATION_CREATE: 'quotation.create',
  QUOTATION_UPDATE: 'quotation.update',
  QUOTATION_DELETE: 'quotation.delete',
  QUOTATION_APPROVE: 'quotation.approve',
  QUOTATION_MANAGE: 'quotation.manage',
  QUOTATION_EXPORT: 'quotation.export',

  PROPOSAL_VIEW: 'proposal.view',
  PROPOSAL_CREATE: 'proposal.create',
  PROPOSAL_UPDATE: 'proposal.update',
  PROPOSAL_DELETE: 'proposal.delete',
  PROPOSAL_APPROVE: 'proposal.approve',

  CONTRACT_VIEW: 'contract.view',
  CONTRACT_CREATE: 'contract.create',
  CONTRACT_UPDATE: 'contract.update',
  CONTRACT_DELETE: 'contract.delete',
  CONTRACT_APPROVE: 'contract.approve',
  CONTRACT_MANAGE: 'contract.manage',

  // ─── Delivery ────────────────────────────────
  PROJECT_VIEW: 'project.view',
  PROJECT_CREATE: 'project.create',
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',
  PROJECT_MANAGE: 'project.manage',
  PROJECT_APPROVE: 'project.approve',
  PROJECT_EXPORT: 'project.export',

  TASK_VIEW: 'task.view',
  TASK_CREATE: 'task.create',
  TASK_UPDATE: 'task.update',
  TASK_DELETE: 'task.delete',
  TASK_TRANSITION: 'task.transition',

  // ─── Finance ─────────────────────────────────
  INVOICE_VIEW: 'invoice.view',
  INVOICE_CREATE: 'invoice.create',
  INVOICE_UPDATE: 'invoice.update',
  INVOICE_DELETE: 'invoice.delete',
  INVOICE_APPROVE: 'invoice.approve',
  INVOICE_MANAGE: 'invoice.manage',
  INVOICE_EXPORT: 'invoice.export',

  RECEIPT_VIEW: 'receipt.view',
  RECEIPT_CREATE: 'receipt.create',
  RECEIPT_UPDATE: 'receipt.update',
  RECEIPT_DELETE: 'receipt.delete',

  EXPENSE_VIEW: 'expense.view',
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_UPDATE: 'expense.update',
  EXPENSE_DELETE: 'expense.delete',
  EXPENSE_APPROVE: 'expense.approve',

  INCOME_VIEW: 'income.view',
  INCOME_CREATE: 'income.create',
  INCOME_UPDATE: 'income.update',
  INCOME_DELETE: 'income.delete',

  // ─── Subscription ────────────────────────────
  PLAN_VIEW: 'plan.view',
  PLAN_CREATE: 'plan.create',
  PLAN_UPDATE: 'plan.update',
  PLAN_DELETE: 'plan.delete',

  SUBSCRIPTION_VIEW: 'subscription.view',
  SUBSCRIPTION_CREATE: 'subscription.create',
  SUBSCRIPTION_UPDATE: 'subscription.update',
  SUBSCRIPTION_DELETE: 'subscription.delete',
  SUBSCRIPTION_MANAGE: 'subscription.manage',

  MCO_VIEW: 'mco.view',
  MCO_CREATE: 'mco.create',
  MCO_UPDATE: 'mco.update',
  MCO_APPROVE: 'mco.approve',
  MCO_MANAGE: 'mco.manage',

  // ─── Payroll ─────────────────────────────────
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_CREATE: 'payroll.create',
  PAYROLL_UPDATE: 'payroll.update',
  PAYROLL_APPROVE: 'payroll.approve',
  PAYROLL_DELETE: 'payroll.delete',
  PAYROLL_MANAGE: 'payroll.manage',
  PAYROLL_EXPORT: 'payroll.export',
  PAYROLL_POST: 'payroll.post',

  // ─── Asset & Maintenance ─────────────────────
  ASSET_VIEW: 'asset.view',
  ASSET_CREATE: 'asset.create',
  ASSET_UPDATE: 'asset.update',
  ASSET_DELETE: 'asset.delete',
  ASSET_MANAGE: 'asset.manage',

  MAINTENANCE_VIEW: 'maintenance.view',
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_UPDATE: 'maintenance.update',
  MAINTENANCE_DELETE: 'maintenance.delete',
  MAINTENANCE_APPROVE: 'maintenance.approve',

  // ─── Notifications ───────────────────────────
  NOTIFICATION_VIEW: 'notification.view',
  NOTIFICATION_CREATE: 'notification.create',
  NOTIFICATION_MANAGE: 'notification.manage',

  // ─── Knowledge ───────────────────────────────
  ARTICLE_VIEW: 'article.view',
  ARTICLE_CREATE: 'article.create',
  ARTICLE_UPDATE: 'article.update',
  ARTICLE_DELETE: 'article.delete',
  ARTICLE_APPROVE: 'article.approve',

  // ─── Audit ───────────────────────────────────
  AUDIT_VIEW: 'audit.view',
  AUDIT_EXPORT: 'audit.export',

  // ─── Activity ────────────────────────────────
  ACTIVITY_VIEW: 'activity.view',

  // ─── Platform ────────────────────────────────
  TAG_VIEW: 'tag.view',
  TAG_CREATE: 'tag.create',
  TAG_UPDATE: 'tag.update',
  TAG_DELETE: 'tag.delete',

  REMINDER_VIEW: 'reminder.view',
  REMINDER_CREATE: 'reminder.create',
  REMINDER_UPDATE: 'reminder.update',

  ATTACHMENT_VIEW: 'attachment.view',
  ATTACHMENT_CREATE: 'attachment.create',
  ATTACHMENT_DELETE: 'attachment.delete',

  COMMENT_VIEW: 'comment.view',
  COMMENT_CREATE: 'comment.create',
  COMMENT_UPDATE: 'comment.update',
  COMMENT_DELETE: 'comment.delete',

  SETTING_VIEW: 'setting.view',
  SETTING_MANAGE: 'setting.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role keys (default seed roles per Phase 10 §10.2)
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SALES: 'sales',
  FINANCE: 'finance',
  HR: 'hr',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

/**
 * User status values
 */
export const USER_STATUS = {
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DEACTIVATED: 'deactivated',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

/**
 * Document number prefixes per Phase 18 §18.6
 */
export const NUMBER_SEQUENCE_PREFIXES = {
  INVOICE: 'INV',
  RECEIPT: 'RCT',
  DOWN_PAYMENT: 'DP',
  EXPENSE: 'EXP',
  INCOME: 'INC',
  QUOTATION: 'QUO',
  PROPOSAL: 'PROP',
  CONTRACT: 'CTR',
  PROJECT: 'PRJ',
  TASK: 'TASK',
  MAINTENANCE: 'MNT',
  LEAD: 'LEAD',
  CLIENT: 'CL',
  SUBSCRIPTION: 'SUB',
  MCO: 'MCO',
  PAYROLL: 'PAY',
} as const;

export type NumberSequencePrefix =
  (typeof NUMBER_SEQUENCE_PREFIXES)[keyof typeof NUMBER_SEQUENCE_PREFIXES];
