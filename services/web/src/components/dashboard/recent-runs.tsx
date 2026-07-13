"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/skeleton";
import { useRuns } from "@/hooks";

export function RecentRuns() {
  const { data, isPending, isError } = useRuns(1, 5);
  const runs = data?.items ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Recent Runs</h2>
        <Link href="/runs" className="text-xs text-explained hover:underline">
          View all
        </Link>
      </div>
      <div className="rounded-lg border border-border bg-surface dark:bg-surface-dark">
        {isPending ? (
          <TableSkeleton rows={3} cols={5} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-4 py-2 text-left font-medium">Window</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Matched</th>
                <th className="px-4 py-2 text-right font-medium">Review</th>
                <th className="px-4 py-2 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    {isError ? "Couldn't load runs." : "No runs yet."}
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
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{run.matchedCount || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {run.reviewCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-review">
                          {run.reviewCount}
                          <span className="h-1.5 w-1.5 rounded-full bg-review" />
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{run.updatedAgo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
