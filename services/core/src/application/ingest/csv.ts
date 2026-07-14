// CSV ingestion with column mapping (PRD §3.1.3, F10 backend half). The user
// tells us which column holds the amount / date / reference / currency; we
// normalise each row into a Transaction. Rows with a non-numeric amount or an
// unparseable date are rejected and counted, never silently dropped.
import type { Transaction } from "../../domain/reconciliation/transaction.js";
import { money, currency } from "../../domain/shared/branded.js";
import { type Result, ok, err } from "../../domain/shared/result.js";

export interface CsvColumnMapping {
  amountColumn: string;
  dateColumn: string;
  referenceColumn: string;
  currencyColumn?: string;   // if omitted, currencyFixed is used
  currencyFixed?: string;    // e.g. "CAD"
  amountIsMinorUnits?: boolean; // true: already cents; false/undefined: dollars string
}

export interface CsvIngestResult {
  transactions: Transaction[];
  accepted: number;
  rejected: number;
  rejectedRows: { row: number; reason: string }[];
}

/** Minimal RFC-4180-ish parser: handles quoted fields, escaped quotes, commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Parse a money string to integer minor units WITHOUT floats (N2). Accepts
// "147.23", "-1,200.5", "89". Returns null if not a valid decimal amount.
export function parseMoneyToMinor(raw: string): number | null {
  const s = raw.trim().replace(/,/g, "");
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const whole = Number.parseInt(m[2] ?? "0", 10);
  const cents = m[3] ? Number.parseInt(m[3].padEnd(2, "0"), 10) : 0;
  return sign * (whole * 100 + cents);
}

export function ingestCsv(
  text: string,
  mapping: CsvColumnMapping,
): Result<CsvIngestResult> {
  const rows = parseCsv(text);
  if (rows.length < 2) return err(new Error("CSV needs a header row and at least one data row"));

  const header = (rows[0] ?? []).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const ai = idx(mapping.amountColumn);
  const di = idx(mapping.dateColumn);
  const ri = idx(mapping.referenceColumn);
  const ci = mapping.currencyColumn ? idx(mapping.currencyColumn) : -1;
  if (ai < 0 || di < 0 || ri < 0) {
    return err(new Error("amount/date/reference column not found in header"));
  }

  const transactions: Transaction[] = [];
  const rejectedRows: { row: number; reason: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    const amountCell = (cells[ai] ?? "").trim();
    const amountMinor = mapping.amountIsMinorUnits
      ? (/^-?\d+$/.test(amountCell) ? Number.parseInt(amountCell, 10) : null)
      : parseMoneyToMinor(amountCell);
    if (amountMinor === null) {
      rejectedRows.push({ row: r, reason: `non-numeric amount "${amountCell}"` });
      continue;
    }
    const dateCell = (cells[di] ?? "").trim();
    const when = new Date(dateCell);
    if (Number.isNaN(when.getTime())) {
      rejectedRows.push({ row: r, reason: `unparseable date "${dateCell}"` });
      continue;
    }
    const cur = (ci >= 0 ? cells[ci] ?? "" : mapping.currencyFixed ?? "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) {
      rejectedRows.push({ row: r, reason: `invalid currency "${cur}"` });
      continue;
    }
    const reference = (cells[ri] ?? "").trim();
    if (reference === "") {
      rejectedRows.push({ row: r, reason: "empty reference" });
      continue;
    }
    transactions.push({
      source: "csv",
      externalId: reference,
      amount: money(amountMinor),
      currency: currency(cur),
      occurredAt: when,
      raw: Object.fromEntries(header.map((h, c) => [h, cells[c] ?? ""])),
    });
  }

  return ok({
    transactions,
    accepted: transactions.length,
    rejected: rejectedRows.length,
    rejectedRows,
  });
}
