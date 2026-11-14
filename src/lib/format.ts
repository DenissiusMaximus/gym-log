export const MAX_WEIGHT = 999.99;

/** Rounds to two decimal places (weights are stored with at most 2). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Weight with a decimal point and no trailing zeros: "40", "42.5", "42.25". */
export function formatWeight(value: number): string {
  return String(round2(value));
}

/**
 * Parses user input accepting both "." and "," as the decimal separator.
 * Returns null for empty, malformed, negative or out-of-range input.
 */
export function parseWeight(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value > MAX_WEIGHT) return null;
  return round2(value);
}
