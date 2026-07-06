// Ledger entry — the internal double-entry record. Pure data shape.
import type { Money, CurrencyCode, LedgerEntryId } from "../shared/branded.js";

export interface LedgerEntry {
  readonly id: LedgerEntryId;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly postedAt: Date;
  readonly reference: string; // links to a booking/payout in the source system
}
