import { leadStages } from '../schema/crm';
import type { DbClient } from '../client';

const DEFAULT_STAGES = [
  { key: 'new', name: 'New', position: 1, isDefault: true },
  { key: 'contacted', name: 'Contacted', position: 2 },
  { key: 'qualified', name: 'Qualified', position: 3 },
  { key: 'proposal', name: 'Proposal Sent', position: 4 },
  { key: 'negotiation', name: 'Negotiation', position: 5 },
  { key: 'won', name: 'Won', position: 6, isWon: true },
  { key: 'lost', name: 'Lost', position: 7, isLost: true },
];

export async function seedLeadStages(db: DbClient) {
  console.log('  → Seeding lead stages...');
  for (const stage of DEFAULT_STAGES) {
    await db
      .insert(leadStages)
      .values({
        key: stage.key,
        name: stage.name,
        position: stage.position,
        isWon: stage.isWon ?? false,
        isLost: stage.isLost ?? false,
        isDefault: stage.isDefault ?? false,
      })
      .onDuplicateKeyUpdate({ set: { name: stage.name, position: stage.position } });
  }
  console.log(`     ✓ ${DEFAULT_STAGES.length} lead stages seeded`);
}
