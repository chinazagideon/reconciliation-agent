// Fee math, pure and integer-only (N2: no floating-point money arithmetic).
// Shared by the seeder (to CREATE fee discrepancies) and the tolerant matcher
// (to RECOGNISE them), so the two can never drift apart.

/** Stripe's standard fee: 2.9% + $0.30, in integer minor units, round-half-up.
 *  floor((gross*29 + 500) / 1000) is 2.9% rounded to the nearest cent. */
export function stripeFeeMinor(grossMinor: number): number {
  const pct = Math.floor((Math.abs(grossMinor) * 29 + 500) / 1000);
  return pct + 30;
}

/** Rounding tolerance in minor units (PRD: ±$0.02). */
export const ROUNDING_TOLERANCE_MINOR = 2;

/** True if two same-currency amounts differ by a known fee pattern or by a
 *  sub-cent rounding wobble. Direction-agnostic (either side may be gross). */
export function withinFeeTolerance(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const diff = hi - lo;
  if (diff <= ROUNDING_TOLERANCE_MINOR) return true;         // rounding
  const expectedFee = stripeFeeMinor(hi);                     // hi = gross, lo = net
  return Math.abs(diff - expectedFee) <= ROUNDING_TOLERANCE_MINOR;
}
