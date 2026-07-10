import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ── Class name merge (shadcn/ui convention) ────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Money formatting ───────────────────────────────────────────
// Amounts are integer minor units (cents). Display as dollars with
// exactly 2 decimal places. Always monospaced + right-aligned in UI.
export function formatMoney(minorUnits: number, currency = "CAD"): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

// ── Date formatting ────────────────────────────────────────────
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTimeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

// ── Status colours ─────────────────────────────────────────────
// Maps run status / item category to Tailwind colour classes.
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    // Run statuses
    done: "text-matched",
    pending: "text-muted",
    ingesting: "text-explained",
    matching: "text-explained",
    explaining: "text-explained",
    failed: "text-unmatched",
    // Item categories
    matched: "text-matched",
    explained: "text-explained",
    review: "text-review",
    fraud: "text-unmatched",
    unmatched: "text-unmatched",
  };
  return map[status] ?? "text-muted";
}

// ── Confidence level label ─────────────────────────────────────
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return "Very high";
  if (confidence >= 0.7) return "High";
  if (confidence >= 0.5) return "Medium";
  if (confidence >= 0.3) return "Low";
  return "Very low";
}
