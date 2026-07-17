import 'dotenv/config';
import { createClient } from '../client';
import { seedPermissions } from './permissions';
import { seedRoles } from './roles';
import { seedRolePermissions } from './role-permissions';
import { seedFounder } from './founder';
import { seedNumberSequences } from './number-sequences';
import { seedLeadStages } from './lead-stages';
import { seedLeadSources } from './lead-sources';
import { seedSettings } from './settings';
import { seedEnumValues } from './enum-values';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const db = createClient(url);

  console.log('🌱 Starting seed...');
  await seedPermissions(db);
  await seedRoles(db);
  await seedRolePermissions(db);
  await seedFounder(db);
  await seedNumberSequences(db);
  await seedLeadStages(db);
  await seedLeadSources(db);
  await seedSettings(db);
  await seedEnumValues(db);
  console.log('✅ Seed complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
