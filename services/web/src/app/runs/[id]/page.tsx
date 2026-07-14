"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton, TableSkeleton } from "@/components/shared/skeleton";
import { QueryBoundary } from "@/components/shared/query-boundary";
import { RunTabs } from "@/components/runs/run-tabs";
import { ReviewCard } from "@/components/review/review-card";
import { Money } from "@/components/shared/money";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import {
  useRun,
  useMatches,
  useExplanations,
  useReviewItems,
  useFraudItems,
} from "@/hooks";

// PRD Page 4: Run Detail — the main working screen.
// Tabs: Matched | Explained | Review | Fraud | All
type TabId = "matched" | "explained" | "review" | "fraud" | "all";

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("review");

  const { data: run, isPending: runPending, isError: runError } = useRun(id);

  // All four tabs come back inside the run detail payload, so these are four
  // projections of one cached request — not four fetches. Switching tabs costs
  // nothing, which is why none of them are gated on `activeTab` any more.
  const matches = useMatches(id);
  const explanations = useExplanations(id);
  const review = useReviewItems(id);
  const fraud = useFraudItems(id);

  return (
    <>
      <PageHeader
        title={run ? `Run: ${run.windowLabel}` : "Run"}
        description={
          <span className="flex items-center gap-2">
            {run && <StatusBadge status={run.status} />}
            <span className="text-xs text-muted">· Run ID: {id}</span>
          </span>
        }
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {runPending || !run ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="mt-3 h-6 w-10" />
            </div>
          ))
        ) : (
          <>
            <MetricCard label="Total" value={run.totalCount} accent="explained" />
            <MetricCard label="Matched" value={run.matchedCount} accent="matched" />
            <MetricCard label="Explained" value={run.explainedCount} accent="explained" />
            <MetricCard label="Review" value={run.reviewCount} accent="review" badge />
            <MetricCard label="Fraud" value={run.fraudCount} accent="fraud" badge />
          </>
        )}
      </div>

      {/* Tabs */}
      <RunTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={
          run
            ? {
                matched: run.matchedCount,
                explained: run.explainedCount,
                review: run.reviewCount,
                fraud: run.fraudCount,
              }
            : undefined
        }
      />

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "matched" && (
          <QueryBoundary
            query={matches}
            skeleton={<CardBox><TableSkeleton rows={3} cols={3} /></CardBox>}
            empty={<Muted>No matched pairs in this run.</Muted>}
          >
            {(items) => (
              <div className="space-y-3">
                {items.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark">
                    <div className="mb-2 text-xs font-mono text-muted">strategy: {m.strategy}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {[m.left, m.right].map((side, i) => (
                        <div key={i}>
                          <div className="text-xs uppercase text-muted">{i === 0 ? "Left" : "Right"}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="font-mono">{side.externalId}</span>
                            <span className="text-xs text-muted">· {side.source}</span>
                            <Money amount={side.amountMinor} currency={side.currency} className="text-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </QueryBoundary>
        )}

        {activeTab === "explained" && (
          <QueryBoundary
            query={explanations}
            skeleton={<CardBox><TableSkeleton rows={3} cols={2} /></CardBox>}
            empty={<Muted>No AI-explained items in this run.</Muted>}
          >
            {(items) => (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark">
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <span className="font-mono">{item.transaction.externalId}</span>
                      <Money
                        amount={item.transaction.amountMinor}
                        currency={item.transaction.currency}
                        className="text-sm"
                      />
                    </div>
                    {item.explanation ? (
                      <>
                        <p className="text-sm leading-relaxed">{item.explanation.hypothesis}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <ConfidenceBar confidence={item.explanation.confidence} />
                          <span className="text-xs font-mono text-muted">
                            → {item.explanation.suggestedAction}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted">AI produced no hypothesis for this item.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </QueryBoundary>
        )}

        {activeTab === "review" && (
          <QueryBoundary
            query={review}
            skeleton={<CardBox><TableSkeleton rows={2} cols={1} /></CardBox>}
            empty={
              <EmptyState
                title="Nothing to review"
                description="Every discrepancy in this run has been resolved."
              />
            }
          >
            {(items) => (
              <div className="space-y-4">
                {items.map((item) => (
                  <ReviewCard key={item.id} item={item} runId={id} />
                ))}
              </div>
            )}
          </QueryBoundary>
        )}

        {activeTab === "fraud" && (
          <QueryBoundary
            query={fraud}
            skeleton={<CardBox><TableSkeleton rows={2} cols={1} /></CardBox>}
            empty={<Muted>No fraud-flagged items in this run.</Muted>}
          >
            {(items) => (
              <div className="space-y-4">
                {items.map((item) => (
                  <ReviewCard key={item.id} item={item} runId={id} />
                ))}
              </div>
            )}
          </QueryBoundary>
        )}

        {activeTab === "all" && (
          <Muted>
            {runError
              ? "Couldn't load this run."
              : "Switch to a category tab (Matched, Explained, Review, Fraud) to inspect transactions."}
          </Muted>
        )}
      </div>
    </>
  );
}

// Small presentational wrappers reused across tabs.
function CardBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-surface dark:bg-surface-dark">{children}</div>;
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted dark:bg-surface-dark">
      {children}
    </div>
  );
}
