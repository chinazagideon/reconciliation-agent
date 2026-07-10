"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatTimeAgo } from "@/lib/utils";

// TODO: fetch from fetchRuns() API. Static placeholder for scaffold.
const PLACEHOLDER_RUNS = [
  { id: "1", window: "Jun 24–30", status: "done" as const, matched: 180, review: 0, updated: "2026-07-01T09:14:00Z" },
  { id: "2", window: "Jun 17–23", status: "done" as const, matched: 162, review: 2, updated: "2026-06-24T10:00:00Z" },
  { id: "3", window: "Jun 10–16", status: "failed" as const, matched: 0, review: 0, updated: "2026-06-17T08:00:00Z" },
];

export function RecentRuns() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Recent Runs</h2>
        <Link href="/runs" className="text-xs text-explained hover:underline">
          View all
        </Link>
      </div>
      <div className="rounded-lg border border-border bg-surface dark:bg-surface-dark">
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
            {PLACEHOLDER_RUNS.map((run) => (
              <tr key={run.id} className="border-b border-border last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <Link href={`/runs/${run.id}`} className="hover:text-explained">
                    {run.window}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-right font-mono">{run.matched || "—"}</td>
                <td className="px-4 py-3 text-right">
                  {run.review > 0 ? (
                    <span className="inline-flex items-center gap-1 text-review">
                      {run.review}
                      <span className="h-1.5 w-1.5 rounded-full bg-review" />
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right text-muted">{formatTimeAgo(run.updated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
