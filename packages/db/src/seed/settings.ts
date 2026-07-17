import { settings } from '../schema/platform';
import type { DbClient } from '../client';

const DEFAULT_SETTINGS = [
  // General
  { key: 'app.name', value: 'Taralaya OS', type: 'string', category: 'general', isPublic: true },
  { key: 'app.timezone', value: 'UTC', type: 'string', category: 'general', isPublic: true },
  { key: 'app.default_currency', value: 'IDR', type: 'string', category: 'general', isPublic: true },
  { key: 'app.default_locale', value: 'id', type: 'string', category: 'general', isPublic: true },

  // Auth
  { key: 'auth.max_failed_attempts', value: '5', type: 'number', category: 'auth' },
  { key: 'auth.lockout_duration_minutes', value: '15', type: 'number', category: 'auth' },
  { key: 'auth.session_ttl_days', value: '30', type: 'number', category: 'auth' },

  // Finance
  { key: 'finance.invoice_due_days', value: '30', type: 'number', category: 'finance' },
  { key: 'finance.expense_approval_threshold', value: '1000000', type: 'number', category: 'finance' },
  { key: 'finance.default_tax_rate', value: '11', type: 'number', category: 'finance' },

  // Payroll
  { key: 'payroll.run_day', value: '25', type: 'number', category: 'payroll', description: 'Day of month to run payroll' },

  // Notifications
  { key: 'notification.invoice_overdue_reminder_days', value: '3,7,14', type: 'string', category: 'notification' },
];

export async function seedSettings(db: DbClient) {
  console.log('  → Seeding settings...');
  for (const setting of DEFAULT_SETTINGS) {
    await db
      .insert(settings)
      .values(setting)
      .onDuplicateKeyUpdate({ set: { value: setting.value } });
  }
  console.log(`     ✓ ${DEFAULT_SETTINGS.length} settings seeded`);
}
