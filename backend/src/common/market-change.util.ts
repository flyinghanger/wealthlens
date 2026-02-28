export function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Convert a 24h percentage move to absolute value move based on current value.
 *
 * percentage = (current - previous) / previous * 100
 * deltaValue = current - previous = current - current / (1 + percentage/100)
 */
export function calculate24hChangeValue(
  currentValue: number,
  changePercent: number,
): number {
  const current = toFiniteNumber(currentValue, 0);
  const pct = toFiniteNumber(changePercent, 0);

  if (current <= 0 || pct === 0) {
    return 0;
  }

  const ratio = pct / 100;
  const denominator = 1 + ratio;
  if (Math.abs(denominator) < 1e-9) {
    return 0;
  }

  const previous = current / denominator;
  if (!Number.isFinite(previous) || previous < 0) {
    return 0;
  }

  return current - previous;
}
