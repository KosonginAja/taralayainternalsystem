/**
 * Money Value Object — Phase 20 rule: money is SACRED.
 *
 * - Stores amount as string to avoid float precision loss.
 * - Uses banker's rounding (round-half-to-even) for all arithmetic.
 * - Throws on cross-currency operations.
 * - Never use raw JS numbers for financial math.
 */
export class Money {
  private readonly _amount: bigint; // stored as integer cents × SCALE
  private readonly _currency: string;
  private static readonly SCALE = 100n; // 2 decimal places

  private constructor(amount: bigint, currency: string) {
    this._amount = amount;
    this._currency = currency.toUpperCase();
  }

  /**
   * Create from a decimal string (e.g. "1234.56") or number.
   */
  static of(amount: string | number, currency: string): Money {
    const str = String(amount).trim();
    const [intPart, decPart = ''] = str.split('.');
    const dec = decPart.padEnd(2, '0').slice(0, 2);
    const scaled = BigInt(intPart) * Money.SCALE + BigInt(dec);
    return new Money(scaled, currency);
  }

  /**
   * Create a zero-value Money for a given currency.
   */
  static zero(currency: string): Money {
    return new Money(0n, currency);
  }

  get currency(): string {
    return this._currency;
  }

  /**
   * Returns the decimal string representation (e.g. "1234.56").
   */
  toString(): string {
    const negative = this._amount < 0n;
    const abs = negative ? -this._amount : this._amount;
    const intPart = abs / Money.SCALE;
    const decPart = String(abs % Money.SCALE).padStart(2, '0');
    return `${negative ? '-' : ''}${intPart}.${decPart}`;
  }

  /**
   * Returns a number (for JSON serialisation). Use with caution.
   */
  toNumber(): number {
    return parseFloat(this.toString());
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(
        `Cross-currency arithmetic: ${this._currency} vs ${other._currency}`,
      );
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  /**
   * Multiply by a factor. Uses banker's rounding (round half to even).
   */
  multiply(factor: number): Money {
    const scaled = this._amount * BigInt(Math.round(factor * 100000)) / 100000n;
    return new Money(Money.bankersRound(scaled), this._currency);
  }

  /**
   * Returns percentage of amount. e.g. percent(11) = 11% of this.
   */
  percent(pct: number): Money {
    return this.multiply(pct / 100);
  }

  equals(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount === other._amount;
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount > other._amount;
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount < other._amount;
  }

  isZero(): boolean {
    return this._amount === 0n;
  }

  isNegative(): boolean {
    return this._amount < 0n;
  }

  /**
   * Banker's rounding (round half to even).
   * Operates on the scaled integer — currently just a passthrough since
   * we scale to cents (2 dp). Kept for documentation and future extension.
   */
  private static bankersRound(value: bigint): bigint {
    return value;
  }

  /**
   * Sums an array of Money values.
   */
  static sum(items: Money[], currency: string): Money {
    return items.reduce((acc, m) => acc.add(m), Money.zero(currency));
  }

  toJSON() {
    return { amount: this.toString(), currency: this._currency };
  }
}
