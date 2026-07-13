"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { useCreateRun, useUploadCsv } from "@/hooks";
import Link from "next/link";

// PRD Page 2: New Run — start a reconciliation.
// Date range + source selection + optional CSV upload with column mapping.
const CSV_FIELDS = ["external_id", "amount_minor", "currency", "occurred_at"];

export default function NewRunPage() {
  const router = useRouter();
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [sources, setSources] = useState<string[]>(["stripe", "ledger"]);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const createRun = useCreateRun();
  const uploadCsv = useUploadCsv();

  function toggleSource(source: string) {
    setSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source],
    );
  }

  async function handleSubmit() {
    if (!windowStart || !windowEnd || sources.length < 2) return;

    // If a CSV source is selected with a file, ingest it first.
    if (sources.includes("csv") && csvFile) {
      await uploadCsv.mutateAsync({ file: csvFile, mapping });
    }

    const run = await createRun.mutateAsync({
      windowStart,
      windowEnd,
      sources,
    });
    if (run) router.push(`/runs/${run.id}`);
  }

  const isSubmitting = createRun.isPending || uploadCsv.isPending;
  const canSubmit =
    !!windowStart && !!windowEnd && sources.length >= 2 && !isSubmitting;
  const error = createRun.error ?? uploadCsv.error;

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

        {/* CSV column mapping UI — shown when "csv" is selected */}
        {sources.includes("csv") && (
          <div className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark">
            <p className="mb-3 text-sm font-medium">CSV Upload &amp; Column Mapping</p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="mb-3 block text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-gray-50 file:px-3 file:py-1 file:text-xs dark:file:bg-gray-800"
            />
            <div className="space-y-2">
              {CSV_FIELDS.map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="w-32 font-mono text-xs text-muted">{field}</label>
                  <input
                    type="text"
                    placeholder="CSV column header…"
                    value={mapping[field] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value }))
                    }
                    className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm dark:bg-surface-dark"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-unmatched/30 bg-red-50 px-3 py-2 text-sm text-unmatched dark:bg-red-900/10">
            {error.message}
          </p>
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
