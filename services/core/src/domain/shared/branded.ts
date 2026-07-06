// Branded types — make illegal states unrepresentable at compile time.
//
// Analogy: a raw `number` is a loose banknote anyone can pass off as anything.
// A `Money` brand is that note sealed in a tamper-evident envelope — the compiler
// refuses to let a plain number, or a cents value where dollars were meant, slip
// through. Kills the classic reconciliation bug: mixing a Stripe id with a
// ledger id, or minor units with major units.

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

/** Integer MINOR units (cents). Money is never stored or passed as a float. */
export type Money = Brand<number, "Money">;
export type CurrencyCode = Brand<string, "CurrencyCode">; // ISO 4217, e.g. "CAD"
export type StripeTxnId = Brand<string, "StripeTxnId">;
export type LedgerEntryId = Brand<string, "LedgerEntryId">;

// Smart constructors: validate ONCE at the boundary, then the brand travels
// through the system as a proof-of-validity. (DIP-friendly, DRY.)
export function money(minorUnits: number): Money {
  if (!Number.isInteger(minorUnits)) {
    throw new Error(`Money must be integer minor units (cents); got ${minorUnits}`);
  }
  return minorUnits as Money;
}

export function currency(code: string): CurrencyCode {
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error(`CurrencyCode must be ISO 4217 (3 upper letters); got "${code}"`);
  }
  return code as CurrencyCode;
}
