import { roles } from '../schema/iam';
import { ROLES } from '@taralaya/shared';
import type { DbClient } from '../client';

const DEFAULT_ROLES = [
  {
    key: ROLES.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'Founder/system. Implicit all-permissions bypass.',
    isSystem: true,
    priority: 1000,
  },
  {
    key: ROLES.ADMIN,
    name: 'Admin',
    description: 'Full operational access, no security-sensitive IAM changes.',
    isSystem: true,
    priority: 900,
  },
  {
    key: ROLES.MANAGER,
    name: 'Manager',
    description: 'Project/delivery manager + reporting.',
    isSystem: true,
    priority: 700,
  },
  {
    key: ROLES.SALES,
    name: 'Sales',
    description: 'CRM + Sales modules.',
    isSystem: true,
    priority: 600,
  },
  {
    key: ROLES.FINANCE,
    name: 'Finance',
    description: 'Finance + Payroll.',
    isSystem: true,
    priority: 600,
  },
  {
    key: ROLES.HR,
    name: 'HR',
    description: 'Payroll + IAM (users).',
    isSystem: true,
    priority: 500,
  },
  {
    key: ROLES.DEVELOPER,
    name: 'Developer',
    description: 'Delivery (own tasks/projects) + KB.',
    isSystem: true,
    priority: 400,
  },
  {
    key: ROLES.VIEWER,
    name: 'Viewer',
    description: 'Read-only across non-sensitive modules.',
    isSystem: true,
    priority: 100,
  },
];

export async function seedRoles(db: DbClient) {
  console.log('  → Seeding roles...');
  for (const role of DEFAULT_ROLES) {
    await db
      .insert(roles)
      .values(role)
      .onDuplicateKeyUpdate({ set: { name: role.name, description: role.description } });
  }
  console.log(`     ✓ ${DEFAULT_ROLES.length} roles seeded`);
}
