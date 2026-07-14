// Shared, pure helpers for the matchers. All arithmetic is on integer minor
// units (N2: no floats in the matching path). Dates are bucketed by UTC calendar
// day so "same day" is unambiguous across timezones.
import type { MatchCandidate } from "../../../domain/reconciliation/match.js";

/** UTC calendar day, e.g. "2026-06-24". */
export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Days between two dates as an integer count of UTC calendar days. */
export function dayGap(a: Date, b: Date): number {
  const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const db = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor(Math.abs(da - db) / 86_400_000 + 0.5);
}

/** Exact-match key: amount|currency|day. */
export function exactKey(c: MatchCandidate): string {
  return `${c.amount}|${c.currency}|${utcDay(c.occurredAt)}`;
}
