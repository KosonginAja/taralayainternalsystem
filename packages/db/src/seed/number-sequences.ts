import { numberSequences } from '../schema/platform';
import { NUMBER_SEQUENCE_PREFIXES } from '@taralaya/shared';
import type { DbClient } from '../client';

const SEQUENCES = [
  { entityType: 'invoice', prefix: NUMBER_SEQUENCE_PREFIXES.INVOICE },
  { entityType: 'receipt', prefix: NUMBER_SEQUENCE_PREFIXES.RECEIPT },
  { entityType: 'down_payment', prefix: NUMBER_SEQUENCE_PREFIXES.DOWN_PAYMENT },
  { entityType: 'expense', prefix: NUMBER_SEQUENCE_PREFIXES.EXPENSE },
  { entityType: 'income', prefix: NUMBER_SEQUENCE_PREFIXES.INCOME },
  { entityType: 'quotation', prefix: NUMBER_SEQUENCE_PREFIXES.QUOTATION },
  { entityType: 'proposal', prefix: NUMBER_SEQUENCE_PREFIXES.PROPOSAL },
  { entityType: 'contract', prefix: NUMBER_SEQUENCE_PREFIXES.CONTRACT },
  { entityType: 'project', prefix: NUMBER_SEQUENCE_PREFIXES.PROJECT },
  { entityType: 'task', prefix: NUMBER_SEQUENCE_PREFIXES.TASK },
  { entityType: 'maintenance', prefix: NUMBER_SEQUENCE_PREFIXES.MAINTENANCE },
  { entityType: 'lead', prefix: NUMBER_SEQUENCE_PREFIXES.LEAD },
  { entityType: 'client', prefix: NUMBER_SEQUENCE_PREFIXES.CLIENT },
  { entityType: 'subscription', prefix: NUMBER_SEQUENCE_PREFIXES.SUBSCRIPTION },
  { entityType: 'mco', prefix: NUMBER_SEQUENCE_PREFIXES.MCO },
  { entityType: 'payroll', prefix: NUMBER_SEQUENCE_PREFIXES.PAYROLL },
];

export async function seedNumberSequences(db: DbClient) {
  console.log('  → Seeding number sequences...');
  const year = new Date().getFullYear();

  for (const seq of SEQUENCES) {
    await db
      .insert(numberSequences)
      .values({
        entityType: seq.entityType,
        prefix: seq.prefix,
        nextValue: 1n,
        padding: 5,
        resetFrequency: 'yearly',
        currentYear: year,
        isActive: true,
      })
      .onDuplicateKeyUpdate({ set: { isActive: true } });
  }
  console.log(`     ✓ ${SEQUENCES.length} number sequences seeded`);
}
