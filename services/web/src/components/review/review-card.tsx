"use client";

import { useState } from "react";
import { Money } from "@/components/shared/money";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import { useSubmitReview } from "@/hooks";
import type { ReviewItemVM } from "@/lib/view-models";
import type { ReviewAction } from "@resolution/shared";

interface ReviewCardProps {
  item: ReviewItemVM;
  runId: string;
}

// PRD: each review card shows transaction, hypothesis, confidence,
// and three action buttons: Approve, Override, Dismiss.
export function ReviewCard({ item, runId }: ReviewCardProps) {
  const { transaction: tx, explanation } = item;
  const { mutate, isPending } = useSubmitReview(runId);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideText, setOverrideText] = useState("");

  // The action addresses the review item, not the transaction it points at.
  function act(action: ReviewAction) {
    mutate({ reviewItemId: item.id, action });
  }

  function handleApprove() {
    act({ action: "approve" });
  }

  function handleOverride() {
    if (!showOverride) {
      setShowOverride(true);
      return;
    }
    // The operator's rationale is the note — it lands in the audit log.
    act({ action: "override", note: overrideText });
  }

  function handleDismiss() {
    act({ action: "dismiss" });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 dark:bg-surface-dark">
      {/* Header: transaction identity */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium">{tx.id}</span>
          <span className="text-xs text-muted">· {tx.source}</span>
          <Money amount={tx.amountMinor} currency={tx.currency} className="text-sm" />
          <span className="text-xs text-muted">· {tx.occurredOn}</span>
        </div>
        {item.flagReason && (
          <span className="text-xs font-medium text-review">
            {item.flagReason.replace("_", " ")}
          </span>
        )}
      </div>

      {/* AI hypothesis */}
      {explanation ? (
        <>
          <div className="mb-3">
            <p className="text-xs font-medium text-muted mb-1">AI Hypothesis:</p>
            <p className="text-sm leading-relaxed">{explanation.hypothesis}</p>
          </div>

          {/* Confidence + suggested action */}
          <div className="flex items-center justify-between mb-4">
            <ConfidenceBar confidence={explanation.confidence} />
            <span className="text-xs font-mono text-muted">
              Suggested: {explanation.suggestedAction}
            </span>
          </div>
        </>
      ) : (
        <p className="mb-4 text-sm text-muted">
          No AI hypothesis{" "}
          {item.candidateCount != null && `· ${item.candidateCount} match candidates`}.
        </p>
      )}

      {/* Override editor */}
      {showOverride && (
        <textarea
          value={overrideText}
          onChange={(e) => setOverrideText(e.target.value)}
          placeholder="Explain your override decision…"
          rows={2}
          className="mb-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm dark:bg-surface-dark"
        />
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="rounded-md bg-matched px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          ✓ Approve
        </button>
        <button
          onClick={handleOverride}
          disabled={isPending || (showOverride && !overrideText.trim())}
          className="rounded-md border border-border px-4 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          ✎ {showOverride ? "Submit Override" : "Override"}
        </button>
        <button
          onClick={handleDismiss}
          disabled={isPending}
          className="rounded-md border border-border px-4 py-1.5 text-xs font-medium text-muted hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-800"
        >
          ✕ Dismiss
        </button>
      </div>
    </div>
  );
}
