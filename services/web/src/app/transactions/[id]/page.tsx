import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import Link from "next/link";

// PRD Page 5: Transaction Detail — side-by-side comparison, fee
// waterfall, audit trail, raw payload.
// TODO: fetch transaction, match, and audit data from API.
export default function TransactionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <>
      <PageHeader
        title={`Transaction ${params.id}`}
        description={
          <Link href="/runs" className="text-xs text-explained hover:underline">
            ← Back to Run
          </Link>
        }
      />

      {/* Side-by-side comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5 dark:bg-surface-dark">
          <h3 className="text-xs font-semibold uppercase text-muted mb-3">This Record</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Source</dt><dd>Stripe</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd><Money amount={14723} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Date</dt><dd>Jun 27, 2026</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Ref</dt><dd className="font-mono text-xs">pi_3N7x...</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 dark:bg-surface-dark">
          <h3 className="text-xs font-semibold uppercase text-muted mb-3">Matched With</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Source</dt><dd>Ledger</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Amount</dt><dd><Money amount={15000} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted">Date</dt><dd>Jun 25, 2026</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Ref</dt><dd className="font-mono text-xs">LED-20260625-042</dd></div>
          </dl>
        </div>
      </div>

      {/* Differences summary */}
      <div className="mt-4 flex gap-6 text-sm text-muted">
        <span>Difference: <Money amount={-277} className="text-unmatched" /></span>
        <span>Date gap: 2 days</span>
      </div>

      {/* Fee waterfall — only shown for fee discrepancies */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-3">Fee Waterfall</h3>
        <div className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Gross charge", 15000],
                ["Promo discount", -277],
                ["Net charge (Stripe)", 14723],
                ["Stripe processing fee", -457],
                ["Platform fee (15%)", -2208],
                ["Tasker payout", 12058],
              ].map(([label, amount]) => (
                <tr key={String(label)} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 text-muted">{label}</td>
                  <td className="py-1.5 text-right">
                    <Money amount={amount as number} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit trail */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-3">Audit Trail</h3>
        <div className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark space-y-2">
          {/* TODO: fetch from fetchTransactionAudit() */}
          {[
            { time: "Jul 1 09:14", actor: "system:stripe", event: "ingested" },
            { time: "Jul 1 09:14", actor: "system:exact", event: "no match (amount diff)" },
            { time: "Jul 1 09:15", actor: "system:tolerant", event: "no match (>1 day gap)" },
            { time: "Jul 1 09:15", actor: "system:agent", event: "explained (conf: 0.62)" },
            { time: "Jul 1 10:32", actor: "user:chinaza", event: "approved → matched" },
          ].map((entry, i) => (
            <div key={i} className="flex items-center gap-4 text-xs">
              <span className="w-24 font-mono text-muted">{entry.time}</span>
              <span className="w-32 font-mono text-explained">{entry.actor}</span>
              <span>{entry.event}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Raw payload (collapsible) */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold">Raw Payload</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-gray-50 p-4 text-xs font-mono dark:bg-gray-900">
{`{
  "id": "txn_3N7x...",
  "amount": 14723,
  "currency": "cad",
  "created": 1719446400,
  "description": "Payment for move booking #MB-2026-0847",
  "fee": 457,
  "net": 14266,
  "type": "charge"
}`}
        </pre>
      </details>
    </>
  );
}
