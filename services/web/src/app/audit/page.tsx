"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeleton";
import { useAuditLog } from "@/hooks";

const PER_PAGE = 20;

// PRD Page 7: Audit Log — filterable, append-only event timeline.
export default function AuditPage() {
  const [eventFilter, setEventFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, isPlaceholderData } = useAuditLog({
    page,
    event: eventFilter === "all" ? undefined : eventFilter,
    actor: actorFilter === "all" ? undefined : actorFilter,
  });

  const entries = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Filter changes should reset to the first page.
  function onFilterChange(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <>
      <PageHeader title="Audit Log" />

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <select
          value={eventFilter}
          onChange={(e) => onFilterChange(setEventFilter, e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm dark:bg-surface-dark"
        >
          <option value="all">All events</option>
          <option value="match.created">Matches</option>
          <option value="explained">Explanations</option>
          <option value="review.approved">Reviews</option>
          <option value="flag_fraud">Fraud flags</option>
          <option value="run.started">Run lifecycle</option>
        </select>
        <select
          value={actorFilter}
          onChange={(e) => onFilterChange(setActorFilter, e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm dark:bg-surface-dark"
        >
          <option value="all">All actors</option>
          <option value="system:exact">Exact matcher</option>
          <option value="system:tolerant">Tolerant matcher</option>
          <option value="system:agent">AI agent</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Audit table */}
      <div className="rounded-lg border border-border bg-surface dark:bg-surface-dark">
        {isPending ? (
          <TableSkeleton rows={6} cols={4} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-4 py-2 text-left font-medium w-40">Time</th>
                <th className="px-4 py-2 text-left font-medium w-40">Actor</th>
                <th className="px-4 py-2 text-left font-medium w-36">Event</th>
                <th className="px-4 py-2 text-left font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted">
                    {isError ? "Couldn't load the audit log." : "No audit entries match these filters."}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{entry.when}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-explained">{entry.actor}</td>
                    <td className="px-4 py-2.5 text-xs">{entry.event}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{entry.detailSummary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{total > 0 ? `Showing ${entries.length} of ${total} entries` : "No entries"}</span>
        {total > PER_PAGE && (
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-border px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-gray-800"
            >
              Previous
            </button>
            <span className="self-center">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
              disabled={page >= totalPages || isPlaceholderData}
              className="rounded-md border border-border px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-gray-800"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
