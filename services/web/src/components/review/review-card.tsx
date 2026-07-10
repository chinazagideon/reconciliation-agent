"use client";

import { Money } from "@/components/shared/money";
import { ConfidenceBar } from "@/components/shared/confidence-bar";

interface ReviewCardProps {
  transactionId: string;
  source: string;
  amount: number;
  currency: string;
  date: string;
  hypothesis: string;
  confidence: number;
  suggestedAction: string;
}

// PRD: each review card shows transaction, hypothesis, confidence,
// and three action buttons: Approve, Override, Dismiss.
export function ReviewCard({
  transactionId,
  source,
  amount,
  currency,
  date,
  hypothesis,
  confidence,
  suggestedAction,
}: ReviewCardProps) {
  // TODO: wire to submitReview() API
  function handleApprove() { /* TODO */ }
  function handleOverride() { /* TODO */ }
  function handleDismiss() { /* TODO */ }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 dark:bg-surface-dark">
      {/* Header: transaction identity */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{transactionId}</span>
          <span className="text-xs text-muted">· {source}</span>
          <Money amount={amount} currency={currency} className="text-sm" />
          <span className="text-xs text-muted">· {date}</span>
        </div>
      </div>

      {/* AI hypothesis */}
      <div className="mb-3">
        <p className="text-xs font-medium text-muted mb-1">AI Hypothesis:</p>
        <p className="text-sm leading-relaxed">{hypothesis}</p>
      </div>

      {/* Confidence + suggested action */}
      <div className="flex items-center justify-between mb-4">
        <ConfidenceBar confidence={confidence} />
        <span className="text-xs font-mono text-muted">
          Suggested: {suggestedAction}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          className="rounded-md bg-matched px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700"
        >
          ✓ Approve
        </button>
        <button
          onClick={handleOverride}
          className="rounded-md border border-border px-4 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          ✎ Override
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-md border border-border px-4 py-1.5 text-xs font-medium text-muted hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          ✕ Dismiss
        </button>
      </div>
    </div>
  );
}
