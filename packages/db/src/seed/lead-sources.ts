import { leadSources } from '../schema/crm';
import type { DbClient } from '../client';

const DEFAULT_SOURCES = [
  'Website',
  'Referral',
  'Cold Outreach',
  'Social Media',
  'Event / Conference',
  'Partner',
  'Direct',
  'Other',
];

export async function seedLeadSources(db: DbClient) {
  console.log('  → Seeding lead sources...');
  for (const name of DEFAULT_SOURCES) {
    await db
      .insert(leadSources)
      .values({ name, isActive: true })
      .onDuplicateKeyUpdate({ set: { isActive: true } });
  }
  console.log(`     ✓ ${DEFAULT_SOURCES.length} lead sources seeded`);
}
