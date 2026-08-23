import { db } from '../db/connection.js';
import { numberingSequences } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

export async function generateNextNumber(docType: 'quotation' | 'invoice'): Promise<string> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  return await db.transaction(async (tx) => {
    // 1. Fetch sequence by docType (unique constraint or single configuration per docType)
    const [seq] = await tx
      .select()
      .from(numberingSequences)
      .where(eq(numberingSequences.docType, docType))
      .for('update');

    if (!seq) {
      throw new Error(`Numbering sequence config for docType "${docType}" not found`);
    }

    let nextSeq = seq.currentSeq + 1;

    // 2. Check reset condition (resets seq to 1 when year changes)
    if (seq.year !== currentYear) {
      nextSeq = 1;
    }

    // 3. Format the pattern (e.g. {PREFIX}/{YEAR}/{MONTH}/{SEQ})
    const year4 = String(currentYear);
    const month2 = String(currentMonth).padStart(2, '0');
    const paddedSeq = String(nextSeq).padStart(4, '0'); // default 4-digit sequence padding

    const formattedNumber = seq.format
      .replace('{PREFIX}', seq.prefix)
      .replace('{YEAR}', year4)
      .replace('{MONTH}', month2)
      .replace('{SEQ}', paddedSeq);

    // 4. Update numbering sequence record
    await tx
      .update(numberingSequences)
      .set({
        currentSeq: nextSeq,
        year: currentYear,
      })
      .where(eq(numberingSequences.id, seq.id));

    return formattedNumber;
  });
}
