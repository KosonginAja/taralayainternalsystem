import { enumValues } from '../schema/platform';
import type { DbClient } from '../client';

const ENUM_DATA: Array<{
  group: string;
  value: string;
  label: string;
  color?: string;
  position: number;
  isSystem?: boolean;
}> = [
  // audit.action vocabulary
  { group: 'audit.action', value: 'insert', label: 'Created', position: 1, isSystem: true },
  { group: 'audit.action', value: 'update', label: 'Updated', position: 2, isSystem: true },
  { group: 'audit.action', value: 'delete', label: 'Deleted', position: 3, isSystem: true },
  { group: 'audit.action', value: 'restore', label: 'Restored', position: 4, isSystem: true },
  { group: 'audit.action', value: 'login', label: 'Login', position: 5, isSystem: true },
  { group: 'audit.action', value: 'logout', label: 'Logout', position: 6, isSystem: true },
  { group: 'audit.action', value: 'login_failed', label: 'Login Failed', position: 7, isSystem: true },
  { group: 'audit.action', value: 'permission_change', label: 'Permission Changed', position: 8, isSystem: true },
  { group: 'audit.action', value: 'export', label: 'Export', position: 9, isSystem: true },
  { group: 'audit.action', value: 'view_sensitive', label: 'Sensitive View', position: 10, isSystem: true },
  { group: 'audit.action', value: 'role_assign', label: 'Role Assigned', position: 11, isSystem: true },
  { group: 'audit.action', value: 'role_revoke', label: 'Role Revoked', position: 12, isSystem: true },
  { group: 'audit.action', value: 'status_transition', label: 'Status Transition', position: 13, isSystem: true },
  { group: 'audit.action', value: 'money_mutation', label: 'Money Mutation', position: 14, isSystem: true },

  // activity.verb vocabulary
  { group: 'activity.verb', value: 'created', label: 'created', position: 1, isSystem: true },
  { group: 'activity.verb', value: 'updated', label: 'updated', position: 2, isSystem: true },
  { group: 'activity.verb', value: 'deleted', label: 'deleted', position: 3, isSystem: true },
  { group: 'activity.verb', value: 'restored', label: 'restored', position: 4, isSystem: true },
  { group: 'activity.verb', value: 'assigned', label: 'assigned', position: 5, isSystem: true },
  { group: 'activity.verb', value: 'unassigned', label: 'unassigned', position: 6, isSystem: true },
  { group: 'activity.verb', value: 'commented', label: 'commented on', position: 7, isSystem: true },
  { group: 'activity.verb', value: 'transitioned', label: 'moved', position: 8, isSystem: true },
  { group: 'activity.verb', value: 'converted', label: 'converted', position: 9, isSystem: true },
  { group: 'activity.verb', value: 'issued', label: 'issued', position: 10, isSystem: true },
  { group: 'activity.verb', value: 'paid', label: 'paid', position: 11, isSystem: true },
  { group: 'activity.verb', value: 'voided', label: 'voided', position: 12, isSystem: true },
  { group: 'activity.verb', value: 'approved', label: 'approved', position: 13, isSystem: true },
  { group: 'activity.verb', value: 'rejected', label: 'rejected', position: 14, isSystem: true },
  { group: 'activity.verb', value: 'logged_in', label: 'logged in', position: 15, isSystem: true },

  // polymorphic.types — all entity types used for polymorphic relations
  { group: 'polymorphic.types', value: 'task', label: 'Task', position: 1, isSystem: true },
  { group: 'polymorphic.types', value: 'project', label: 'Project', position: 2, isSystem: true },
  { group: 'polymorphic.types', value: 'lead', label: 'Lead', position: 3, isSystem: true },
  { group: 'polymorphic.types', value: 'client', label: 'Client', position: 4, isSystem: true },
  { group: 'polymorphic.types', value: 'invoice', label: 'Invoice', position: 5, isSystem: true },
  { group: 'polymorphic.types', value: 'contract', label: 'Contract', position: 6, isSystem: true },
  { group: 'polymorphic.types', value: 'quotation', label: 'Quotation', position: 7, isSystem: true },
  { group: 'polymorphic.types', value: 'receipt', label: 'Receipt', position: 8, isSystem: true },
  { group: 'polymorphic.types', value: 'user', label: 'User', position: 9, isSystem: true },
  { group: 'polymorphic.types', value: 'article', label: 'Article', position: 10, isSystem: true },
  { group: 'polymorphic.types', value: 'maintenance_ticket', label: 'Maintenance Ticket', position: 11, isSystem: true },
  { group: 'polymorphic.types', value: 'asset', label: 'Asset', position: 12, isSystem: true },
];

export async function seedEnumValues(db: DbClient) {
  console.log('  → Seeding enum values...');
  for (const ev of ENUM_DATA) {
    await db
      .insert(enumValues)
      .values({
        group: ev.group,
        value: ev.value,
        label: ev.label,
        color: ev.color,
        position: ev.position,
        isSystem: ev.isSystem ?? false,
      })
      .onDuplicateKeyUpdate({ set: { label: ev.label, position: ev.position } });
  }
  console.log(`     ✓ ${ENUM_DATA.length} enum values seeded`);
}
