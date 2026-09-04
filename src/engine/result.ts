// Discriminated result envelope. Engine functions NEVER throw on domain errors
// and NEVER return NaN/Infinity to callers — they return a Result.

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; error: EngineError };
export type Result<T> = Ok<T> | Err;

export interface EngineError {
  code: ErrorCode;
  message: string;
  field?: string;
}

export type ErrorCode =
  | 'INVALID_PROBABILITY'
  | 'INVALID_DECIMAL_ODDS'
  | 'INVALID_AMERICAN_ODDS'
  | 'INVALID_FRACTIONAL_ODDS'
  | 'INVALID_STAKE'
  | 'INVALID_NUMBER'
  | 'OUT_OF_RANGE'
  | 'TOO_MANY_LEGS'
  | 'EMPTY_INPUT'
  | 'NON_FINITE_RESULT';

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(code: ErrorCode, message: string, field?: string): Err {
  return { ok: false, error: { code, message, field } };
}

/** Unwrap a Result, throwing in tests/dev where a value is expected. */
export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.value;
}
