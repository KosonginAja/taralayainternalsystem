import { sql } from 'drizzle-orm';
import { permissions } from '../schema/iam';
import { PERMISSIONS } from '@taralaya/shared';
import type { DbClient } from '../client';

const MODULE_MAP: Record<string, string> = {
  user: 'iam',
  role: 'iam',
  permission: 'iam',
  apikey: 'iam',
  lead: 'crm',
  client: 'crm',
  pricelist: 'sales',
  quotation: 'sales',
  proposal: 'sales',
  contract: 'sales',
  project: 'delivery',
  task: 'delivery',
  invoice: 'finance',
  receipt: 'finance',
  expense: 'finance',
  income: 'finance',
  plan: 'subscription',
  subscription: 'subscription',
  mco: 'subscription',
  payroll: 'payroll',
  asset: 'asset',
  maintenance: 'asset',
  notification: 'notification',
  article: 'knowledge',
  audit: 'audit',
  activity: 'audit',
  tag: 'platform',
  reminder: 'platform',
  attachment: 'platform',
  comment: 'platform',
  setting: 'platform',
};

export async function seedPermissions(db: DbClient) {
  console.log('  → Seeding permissions...');
  const rows = Object.values(PERMISSIONS).map((key) => {
    const [module, action] = key.split('.');
    return {
      key,
      module: MODULE_MAP[module] ?? module,
      action: action ?? 'custom',
      description: `Permission: ${key}`,
      isSystem: true,
    };
  });

  for (const row of rows) {
    await db
      .insert(permissions)
      .values(row)
      .onDuplicateKeyUpdate({ set: { module: row.module, action: row.action } });
  }
  console.log(`     ✓ ${rows.length} permissions seeded`);
}
