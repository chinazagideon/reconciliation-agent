// Turn any raw JSON payload into a normalised Transaction using a FieldMapping.
// This is the ONE boundary where untrusted, source-shaped data becomes the
// branded domain shape — validate once here, and the brands travel as proof.
import type { FieldMapping } from "./field-mapping.js";
import type { Transaction } from "../../domain/reconciliation/transaction.js";
import { money, currency } from "../../domain/shared/branded.js";
import { type Result, ok, err } from "../../domain/shared/result.js";

/** Minimal JSONPath: supports "$.a.b" and "$.a[0].b". No wildcards/filters. */
export function resolvePath(payload: unknown, path: string): unknown {
  const cleaned = path.replace(/^\$\.?/, "");
  if (cleaned === "") return payload;
  const segments = cleaned
    .replace(/\[(\d+)\]/g, ".$1") // a[0].b -> a.0.b
    .split(".")
    .filter((s) => s.length > 0);
  let cur: unknown = payload;
  for (const seg of segments) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function parseDate(value: unknown, format: FieldMapping["dateFormat"]): Date | null {
  if (format === "unix_seconds") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return null;
    return new Date(n * 1000);
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalise(raw: unknown, mapping: FieldMapping): Result<Transaction> {
  const amountRaw = resolvePath(raw, mapping.amountPath);
  const amountNum = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
  if (!Number.isInteger(amountNum)) {
    return err(new Error(`amount at ${mapping.amountPath} is not integer minor units: ${String(amountRaw)}`));
  }

  const currencyStr = mapping.currencyPath
    ? String(resolvePath(raw, mapping.currencyPath) ?? mapping.currencyFixed ?? "")
    : (mapping.currencyFixed ?? "");
  const currencyUpper = currencyStr.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyUpper)) {
    return err(new Error(`currency is not ISO 4217: "${currencyStr}"`));
  }

  const occurredAt = parseDate(resolvePath(raw, mapping.datePath), mapping.dateFormat);
  if (!occurredAt) {
    return err(new Error(`date at ${mapping.datePath} is not parseable`));
  }

  const externalId = String(resolvePath(raw, mapping.referencePath) ?? "");
  if (externalId === "") {
    return err(new Error(`reference at ${mapping.referencePath} is empty`));
  }

  return ok({
    source: mapping.source,
    externalId,
    amount: money(amountNum),
    currency: currency(currencyUpper),
    occurredAt,
    raw,
  });
}
