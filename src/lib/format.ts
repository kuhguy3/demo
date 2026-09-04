// Display formatting helpers. Keep full precision internally; format only here.

export function pct(x: number | undefined, dp = 2): string {
  if (x === undefined || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(dp)}%`;
}

export function signedPct(x: number | undefined, dp = 2): string {
  if (x === undefined || !Number.isFinite(x)) return '—';
  const s = (x * 100).toFixed(dp);
  return `${x >= 0 ? '+' : ''}${s}%`;
}

export function num(x: number | undefined, dp = 2): string {
  if (x === undefined || !Number.isFinite(x)) return '—';
  return x.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function money(x: number | undefined, dp = 2): string {
  if (x === undefined || !Number.isFinite(x)) return '—';
  const sign = x < 0 ? '-' : '';
  return `${sign}$${Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

export function signedMoney(x: number | undefined, dp = 2): string {
  if (x === undefined || !Number.isFinite(x)) return '—';
  return `${x >= 0 ? '+' : '-'}$${Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

export function odds(x: number | undefined, dp = 2): string {
  if (x === undefined || !Number.isFinite(x)) return '—';
  return x.toFixed(dp);
}
