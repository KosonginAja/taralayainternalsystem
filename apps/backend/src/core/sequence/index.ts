import { eq, sql } from 'drizzle-orm';
import { numberSequences } from '@taralaya/db';
import type { DbClient } from '@taralaya/db';

/**
 * Generates a gapless, per-year, per-prefix document number.
 *
 * Format: PREFIX-YYYY-NNNNN (e.g. INV-2026-00001)
 *
 * Uses a SELECT ... FOR UPDATE row-lock on the number_sequences row
 * to guarantee gapless sequences under concurrent load, per Phase 18 §18.6.
 */
export class NumberSequenceService {
  constructor(private readonly db: DbClient) {}

  async next(entityType: string): Promise<string> {
    return this.db.transaction(async (tx) => {
      // Row-lock the sequence row for this entity type
      const rows = await tx.execute(
        sql`SELECT id, prefix, next_value, padding, reset_frequency, current_year
            FROM number_sequences
            WHERE entity_type = ${entityType} AND is_active = 1
            LIMIT 1
            FOR UPDATE`,
      );

      const row = (rows[0] as any[])[0] as {
        id: number;
        prefix: string;
        next_value: string;
        padding: number;
        reset_frequency: string;
        current_year: number | null;
      } | undefined;

      if (!row) {
        throw new Error(`No active number sequence for entity type: ${entityType}`);
      }

      const currentYear = new Date().getFullYear();
      let nextValue = BigInt(row.next_value);

      // Yearly reset: if year has rolled over, reset to 1
      if (
        row.reset_frequency === 'yearly' &&
        row.current_year !== null &&
        row.current_year < currentYear
      ) {
        nextValue = 1n;
        await tx.execute(
          sql`UPDATE number_sequences
              SET next_value = 2, current_year = ${currentYear}
              WHERE id = ${row.id}`,
        );
      } else {
        await tx.execute(
          sql`UPDATE number_sequences
              SET next_value = next_value + 1, current_year = ${currentYear}
              WHERE id = ${row.id}`,
        );
      }

      const paddedNum = String(nextValue).padStart(row.padding, '0');
      return `${row.prefix}-${currentYear}-${paddedNum}`;
    });
  }
}
