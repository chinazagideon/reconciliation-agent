"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/skeleton";
import { useRuns } from "@/hooks";

const PER_PAGE = 20;

export function RunTable() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isPlaceholderData } = useRuns(page, PER_PAGE);

  const runs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface dark:bg-surface-dark">
        {isPending ? (
          <TableSkeleton rows={6} cols={7} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-4 py-3 text-left font-medium">Window</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Matched</th>
                <th className="px-4 py-3 text-right font-medium">Residue</th>
                <th className="px-4 py-3 text-right font-medium">Review</th>
                <th className="px-4 py-3 text-right font-medium">Fraud</th>
                <th className="px-4 py-3 text-right font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr className="text-center text-muted">
                  <td colSpan={7} className="px-4 py-12">
                    {isError
                      ? "Couldn't load runs."
                      : "No runs yet. Start your first reconciliation."}
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <Link href={`/runs/${run.id}`} className="hover:text-explained">
                        {run.windowLabel}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                    <td className="px-4 py-3 text-right font-mono">{run.matchedCount || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{run.unmatchedCount || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{run.reviewCount || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{run.fraudCount || "—"}</td>
                    <td className="px-4 py-3 text-right text-muted">{run.createdAgo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pager */}
      {total > PER_PAGE && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Page {page} of {totalPages} · {total} runs
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-border px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-gray-800"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
              disabled={page >= totalPages || isPlaceholderData}
              className="rounded-md border border-border px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-gray-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
