// Odds conversions. Decimal is the canonical internal representation.
import { Result, ok, err } from './result';
import { isFiniteNumber } from './math-utils';

export type OddsFormat = 'american' | 'decimal' | 'fractional';

/** Validate decimal odds (must be a finite number > 1 for a real bet). */
export function validateDecimal(d: number): Result<number> {
  if (!isFiniteNumber(d)) {
    return err('INVALID_DECIMAL_ODDS', 'Enter a valid number for decimal odds.', 'odds');
  }
  if (d <= 1) {
    return err('INVALID_DECIMAL_ODDS', 'Decimal odds must be greater than 1.', 'odds');
  }
  return ok(d);
}

/**
 * American → decimal.
 * Valid American prices satisfy |A| >= 100. +100 and -100 both equal decimal 2.0.
 */
export function americanToDecimal(a: number): Result<number> {
  if (!isFiniteNumber(a)) {
    return err('INVALID_AMERICAN_ODDS', 'Enter a valid American price.', 'odds');
  }
  if (a === 0 || (a > -100 && a < 100)) {
    return err(
      'INVALID_AMERICAN_ODDS',
      'American odds must be +100 or greater, or -100 or lower.',
      'odds',
    );
  }
  const d = a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a);
  return ok(d);
}

/** Decimal → American. d=2.0 maps to +100. */
export function decimalToAmerican(d: number): Result<number> {
  const v = validateDecimal(d);
  if (!v.ok) return v;
  const a = d >= 2 ? (d - 1) * 100 : -100 / (d - 1);
  return ok(a);
}

/** Fractional (num/den) → decimal. Both parts must be positive finite numbers. */
export function fractionalToDecimal(num: number, den: number): Result<number> {
  if (!isFiniteNumber(num) || !isFiniteNumber(den)) {
    return err('INVALID_FRACTIONAL_ODDS', 'Enter a valid fraction like 5/2.', 'odds');
  }
  if (num <= 0 || den <= 0) {
    return err('INVALID_FRACTIONAL_ODDS', 'Both parts of the fraction must be positive.', 'odds');
  }
  return ok(num / den + 1);
}

/** Parse a fractional string like "5/2" or "5-2" into decimal. */
export function parseFractional(s: string): Result<number> {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*[/\-:]\s*(\d+(?:\.\d+)?)$/);
  if (!m) {
    return err('INVALID_FRACTIONAL_ODDS', 'Enter a fraction like 5/2.', 'odds');
  }
  return fractionalToDecimal(Number(m[1]), Number(m[2]));
}

/** Reduce a decimal odds value to a simple fraction string (approximate). */
export function decimalToFractional(d: number): Result<string> {
  const v = validateDecimal(d);
  if (!v.ok) return v;
  const value = d - 1; // net fractional value
  const den = 100;
  let num = Math.round(value * den);
  let dd = den;
  const g = gcd(num, dd);
  num /= g;
  dd /= g;
  return ok(`${num}/${dd}`);
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/**
 * Parse any-format odds input into canonical decimal.
 * `format` disambiguates; `raw` is the user string.
 */
export function parseOdds(raw: string, format: OddsFormat): Result<number> {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return err('EMPTY_INPUT', 'Enter the odds.', 'odds');
  }
  if (format === 'fractional') {
    return parseFractional(trimmed);
  }
  const n = Number(trimmed.replace('+', ''));
  if (!isFiniteNumber(n)) {
    return err('INVALID_NUMBER', 'Enter a valid number.', 'odds');
  }
  if (format === 'american') {
    // Number() drops a leading '+', so re-read sign from the raw string.
    const signed = trimmed.startsWith('-') ? -Math.abs(n) : Math.abs(n);
    return americanToDecimal(signed);
  }
  return validateDecimal(n);
}
