"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

// TODO: fetch from fetchRuns() API. Pagination via page query param.
export function RunTable() {
  return (
    <div className="rounded-lg border border-border bg-surface dark:bg-surface-dark">
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
          {/* TODO: map over fetched runs */}
          <tr className="text-center text-muted">
            <td colSpan={7} className="px-4 py-12">
              No runs yet. Start your first reconciliation.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
