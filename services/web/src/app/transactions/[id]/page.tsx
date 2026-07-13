"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { Skeleton } from "@/components/shared/skeleton";
import { QueryBoundary } from "@/components/shared/query-boundary";
import { useTransaction, useTransactionAudit } from "@/hooks";
import Link from "next/link";

// PRD Page 5: Transaction Detail — record, audit trail, raw payload.
export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const txQuery = useTransaction(id);
  const auditQuery = useTransactionAudit(id);

  return (
    <>
      <PageHeader
        title={`Transaction ${id}`}
        description={
          <Link href="/runs" className="text-xs text-explained hover:underline">
            ← Back to Run
          </Link>
        }
      />

      {/* Record */}
      <QueryBoundary
        query={txQuery}
        skeleton={
          <div className="rounded-lg border border-border bg-surface p-5 dark:bg-surface-dark">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
        }
      >
        {(tx) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-5 dark:bg-surface-dark">
              <h3 className="text-xs font-semibold uppercase text-muted mb-3">This Record</h3>
              <dl className="space-y-2 text-sm">
                <Row label="Source"><span className="capitalize">{tx.source}</span></Row>
                <Row label="Amount"><Money amount={tx.amountMinor} currency={tx.currency} /></Row>
                <Row label="Date">{tx.occurredOn}</Row>
                <Row label="External Ref"><span className="font-mono text-xs">{tx.externalId}</span></Row>
              </dl>
            </div>

            {/* Raw payload */}
            <div className="rounded-lg border border-border bg-surface p-5 dark:bg-surface-dark">
              <h3 className="text-xs font-semibold uppercase text-muted mb-3">Raw Payload</h3>
              <pre className="overflow-x-auto rounded-md bg-gray-50 p-3 text-xs font-mono dark:bg-gray-900">
                {JSON.stringify(tx.raw, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </QueryBoundary>

      {/* Audit trail */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-3">Audit Trail</h3>
        <QueryBoundary
          query={auditQuery}
          skeleton={
            <div className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          }
          empty={
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted dark:bg-surface-dark">
              No audit history for this transaction yet.
            </div>
          }
        >
          {(entries) => (
            <div className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 text-xs">
                  <span className="w-40 font-mono text-muted">{entry.when}</span>
                  <span className="w-40 font-mono text-explained">{entry.actor}</span>
                  <span>{entry.event}</span>
                </div>
              ))}
            </div>
          )}
        </QueryBoundary>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
