"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { formatDateTime } from "@/lib/utils";

// PRD Page 7: Audit Log — filterable, append-only event timeline.
export default function AuditPage() {
  const [eventFilter, setEventFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");

  // TODO: fetch from fetchAuditLog() API with filters
  const PLACEHOLDER_ENTRIES = [
    { time: "2026-07-01T10:32:14Z", actor: "user:chinaza", event: "review.approved", detail: "TXN-0847 → approved" },
    { time: "2026-07-01T09:15:02Z", actor: "system:agent", event: "explained", detail: "TXN-0847 conf: 0.62" },
    { time: "2026-07-01T09:14:58Z", actor: "system:tolerant", event: "no_match", detail: "TXN-0847" },
    { time: "2026-07-01T09:14:55Z", actor: "system:exact", event: "match.created", detail: "TXN-0801 ↔ TXN-0802" },
    { time: "2026-07-01T09:14:01Z", actor: "system:stripe", event: "ingested", detail: "195 records" },
    { time: "2026-07-01T09:14:00Z", actor: "system", event: "run.started", detail: "Run Jun 24–30" },
  ];

  return (
    <>
      <PageHeader title="Audit Log" />

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
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
          onChange={(e) => setActorFilter(e.target.value)}
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
            {PLACEHOLDER_ENTRIES.map((entry, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-mono text-xs text-muted">
                  {formatDateTime(entry.time)}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-explained">
                  {entry.actor}
                </td>
                <td className="px-4 py-2.5 text-xs">{entry.event}</td>
                <td className="px-4 py-2.5 text-xs text-muted">{entry.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-muted">
        {/* TODO: real pagination */}
        Showing 6 entries
      </div>
    </>
  );
}
