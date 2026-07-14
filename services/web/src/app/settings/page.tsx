"use client";

import { PageHeader } from "@/components/shared/page-header";
import { useGenerateSeedData, useResetAllData } from "@/hooks";

// PRD Page 6: Settings — data sources, platform config, demo tools.
export default function SettingsPage() {
  const seed = useGenerateSeedData();
  const reset = useResetAllData();
  const manifest = seed.data;

  function handleSeed() {
    seed.mutate();
  }

  function handleReset() {
    if (!confirm("This will delete all transactions, runs, and audit entries. This cannot be undone.")) return;
    reset.mutate();
  }

  return (
    <>
      <PageHeader title="Settings" />

      <div className="max-w-2xl space-y-8">
        {/* Data Sources */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Data Sources</h2>
          <div className="rounded-lg border border-border bg-surface dark:bg-surface-dark divide-y divide-border">
            {/* Stripe */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Stripe</p>
                  <p className="text-xs text-muted mt-0.5">
                    Status: <span className="text-matched">● Connected</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-md border border-border px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
                    Update Key
                  </button>
                  <button className="rounded-md border border-border px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
                    Test
                  </button>
                </div>
              </div>
            </div>

            {/* Ledger */}
            <div className="p-4">
              <p className="text-sm font-medium">Ledger (ingested)</p>
              <p className="text-xs text-muted mt-0.5">
                Last import: — · 0 records
              </p>
              <div className="flex gap-2 mt-2">
                <button className="rounded-md border border-border px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
                  Import CSV
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Configuration */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Platform Configuration</h2>
          <div className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark space-y-3">
            {[
              { label: "Platform fee", value: "15", suffix: "%" },
              { label: "Currency", value: "CAD" },
              { label: "Fee tolerance", value: "0.02", suffix: "$ (max rounding diff)" },
              { label: "Timing tolerance", value: "1", suffix: "day(s)" },
              { label: "AI confidence threshold", value: "0.70", suffix: "(env: AI_CONFIDENCE_THRESHOLD)", readOnly: true },
            ].map(({ label, value, suffix, readOnly }) => (
              <div key={label} className="flex items-center gap-3">
                <label className="w-44 text-sm text-muted">{label}</label>
                <input
                  type="text"
                  defaultValue={value}
                  readOnly={readOnly}
                  className={`w-20 rounded-md border border-border px-2 py-1 text-sm font-mono ${
                    readOnly ? "bg-gray-50 text-muted cursor-not-allowed dark:bg-gray-900" : "bg-surface dark:bg-surface-dark"
                  }`}
                />
                {suffix && <span className="text-xs text-muted">{suffix}</span>}
              </div>
            ))}
          </div>
        </section>

        {/* Demo Tools */}
        <section>
          <h2 className="text-sm font-semibold mb-3">Demo Tools</h2>
          <div className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Generate Seed Data</p>
                <p className="text-xs text-muted">
                  Creates ~200 test transactions with 9 discrepancy patterns.
                </p>
              </div>
              <button
                onClick={handleSeed}
                disabled={seed.isPending}
                className="rounded-md bg-explained px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {seed.isPending ? "Generating..." : "Generate"}
              </button>
            </div>

            {/* Seed manifest summary (after a successful generate) */}
            {manifest && (
              <div className="rounded-md border border-border bg-gray-50 p-3 text-xs dark:bg-gray-900">
                <p className="font-medium text-matched">
                  Generated {manifest.totalRecords} records · {manifest.windowLabel}
                </p>
                <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-muted">
                  <li>Exact matches: {manifest.expected.exactMatches}</li>
                  <li>Tolerant matches: {manifest.expected.tolerantMatches}</li>
                  <li>AI explained: {manifest.expected.aiExplained}</li>
                  <li>Fraud flagged: {manifest.expected.fraudFlagged}</li>
                  <li className="col-span-2">Total matched: {manifest.expected.totalMatchedPct}</li>
                </ul>
              </div>
            )}
            {seed.isError && (
              <p className="text-xs text-unmatched">{seed.error.message}</p>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium text-unmatched">Reset All Data</p>
                <p className="text-xs text-muted">
                  Clears all transactions, runs, and audit entries. Irreversible.
                </p>
              </div>
              <button
                onClick={handleReset}
                disabled={reset.isPending}
                className="rounded-md border border-unmatched px-4 py-1.5 text-xs font-medium text-unmatched hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
              >
                {reset.isPending ? "Resetting..." : "Reset"}
              </button>
            </div>
            {reset.isError && (
              <p className="text-xs text-unmatched">{reset.error.message}</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
