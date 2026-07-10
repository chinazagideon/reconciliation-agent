"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import Link from "next/link";

// PRD Page 2: New Run — start a reconciliation.
// Date range + source selection + optional CSV upload with column mapping.
export default function NewRunPage() {
  const router = useRouter();
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [sources, setSources] = useState<string[]>(["stripe", "ledger"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle a source checkbox
  function toggleSource(source: string) {
    setSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source],
    );
  }

  async function handleSubmit() {
    if (!windowStart || !windowEnd || sources.length < 2) return;
    setIsSubmitting(true);
    // TODO: call createRun() API, then navigate to run detail
    // const { data } = await createRun({ window_start: windowStart, window_end: windowEnd, sources });
    // router.push(`/runs/${data.id}`);
    setIsSubmitting(false);
  }

  // At least 2 sources required (reconciliation needs two sides to compare)
  const canSubmit = windowStart && windowEnd && sources.length >= 2 && !isSubmitting;

  return (
    <>
      <PageHeader title="New Reconciliation Run" />

      <div className="max-w-2xl space-y-6">
        {/* Date range */}
        <div>
          <label className="block text-sm font-medium mb-2">Date Range</label>
          <div className="flex gap-4">
            <input
              type="date"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm dark:bg-surface-dark"
            />
            <span className="self-center text-muted">to</span>
            <input
              type="date"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm dark:bg-surface-dark"
            />
          </div>
        </div>

        {/* Sources */}
        <div>
          <label className="block text-sm font-medium mb-2">Sources</label>
          <div className="space-y-2 rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark">
            {[
              { id: "stripe", label: "Stripe", detail: "Pull balance transactions via API" },
              { id: "ledger", label: "Ledger", detail: "Ingested ledger records" },
              { id: "csv", label: "CSV Upload", detail: "Upload a file and map columns" },
            ].map(({ id, label, detail }) => (
              <label key={id} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sources.includes(id)}
                  onChange={() => toggleSource(id)}
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <span className="text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted">{detail}</span>
                </div>
              </label>
            ))}
          </div>
          {sources.length < 2 && (
            <p className="mt-1 text-xs text-review">
              Select at least 2 sources (reconciliation needs two sides to compare).
            </p>
          )}
        </div>

        {/* TODO: CSV column mapping UI (shown when "csv" is selected) */}
        {sources.includes("csv") && (
          <div className="rounded-lg border border-dashed border-border bg-gray-50 p-8 text-center dark:bg-gray-900">
            <p className="text-sm text-muted">
              CSV upload and column mapping — to be implemented.
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Link
            href="/runs"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-explained px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Starting..." : "Start Reconciliation"}
          </button>
        </div>
      </div>
    </>
  );
}
