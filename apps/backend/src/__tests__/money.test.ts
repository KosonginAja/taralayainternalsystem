import { describe, it, expect } from '@jest/globals';
import { Money } from '../core/validation/money';

describe('Money VO', () => {
  it('creates from string', () => {
    const m = Money.of('1234.56', 'IDR');
    expect(m.toString()).toBe('1234.56');
    expect(m.currency).toBe('IDR');
  });

  it('creates zero', () => {
    const m = Money.zero('USD');
    expect(m.isZero()).toBe(true);
    expect(m.toString()).toBe('0.00');
  });

  it('adds correctly', () => {
    const a = Money.of('100.00', 'USD');
    const b = Money.of('50.50', 'USD');
    expect(a.add(b).toString()).toBe('150.50');
  });

  it('subtracts correctly', () => {
    const a = Money.of('200.00', 'USD');
    const b = Money.of('75.25', 'USD');
    expect(a.subtract(b).toString()).toBe('124.75');
  });

  it('computes percentage correctly', () => {
    const m = Money.of('1000.00', 'USD');
    const tax = m.percent(11);
    expect(tax.toString()).toBe('110.00');
  });

  it('throws on cross-currency add', () => {
    const usd = Money.of('100.00', 'USD');
    const eur = Money.of('100.00', 'EUR');
    expect(() => usd.add(eur)).toThrow('Cross-currency arithmetic');
  });

  it('throws on cross-currency compare', () => {
    const usd = Money.of('100.00', 'USD');
    const eur = Money.of('50.00', 'EUR');
    expect(() => usd.isGreaterThan(eur)).toThrow('Cross-currency arithmetic');
  });

  it('sums array of money', () => {
    const items = [
      Money.of('100.00', 'IDR'),
      Money.of('200.00', 'IDR'),
      Money.of('300.00', 'IDR'),
    ];
    expect(Money.sum(items, 'IDR').toString()).toBe('600.00');
  });

  it('detects negative', () => {
    const a = Money.of('50.00', 'USD');
    const b = Money.of('100.00', 'USD');
    expect(a.subtract(b).isNegative()).toBe(true);
  });

  it('equals', () => {
    const a = Money.of('99.99', 'USD');
    const b = Money.of('99.99', 'USD');
    expect(a.equals(b)).toBe(true);
  });
});
