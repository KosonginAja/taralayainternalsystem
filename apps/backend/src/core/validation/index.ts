import { z } from 'zod';

export { Money } from './money';

/**
 * Zod schema for a prefixed public ID (e.g. "usr_123").
 */
export const PrefixedId = z.string().regex(/^[a-z]+_\d+$/, 'Invalid prefixed ID');

/**
 * Zod schema for ISO-4217 currency code.
 */
export const CurrencyCode = z.string().length(3).toUpperCase();

/**
 * Zod schema for decimal money string (e.g. "1234.56").
 */
export const MoneyAmount = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal with up to 2 decimal places');

/**
 * Zod pagination query schema.
 */
export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuery>;

/**
 * Encodes pagination meta for list responses.
 */
export function buildPaginationMeta(total: number, page: number, perPage: number) {
  return {
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    hasNext: page * perPage < total,
    hasPrev: page > 1,
  };
}
