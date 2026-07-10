"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { RunTabs } from "@/components/runs/run-tabs";
import { ReviewCard } from "@/components/review/review-card";
import Link from "next/link";

// PRD Page 4: Run Detail — the main working screen.
// Tabs: Matched | Explained | Review | Fraud | All
type TabId = "matched" | "explained" | "review" | "fraud" | "all";

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("review");

  // TODO: fetch run, matches, explanations, review items from API
  // const { data: run } = useSWR(`/reconciliations/${id}`, fetchRun);

  return (
    <>
      <PageHeader
        title={`Run: Jun 24–30, 2026`}
        description={
          <span className="flex items-center gap-2">
            <StatusBadge status="done" />
            <span className="text-xs text-muted">· Run ID: {id}</span>
          </span>
        }
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Total" value={195} accent="explained" />
        <MetricCard label="Matched" value={180} accent="matched" />
        <MetricCard label="Explained" value={8} accent="explained" />
        <MetricCard label="Review" value={4} accent="review" badge />
        <MetricCard label="Fraud" value={2} accent="fraud" badge />
      </div>

      {/* Tabs */}
      <RunTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "matched" && (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted dark:bg-surface-dark">
            {/* TODO: render Match rows with side-by-side transaction pairs */}
            Matched transactions — to be implemented. Each row shows two paired records and the strategy that linked them.
          </div>
        )}

        {activeTab === "explained" && (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted dark:bg-surface-dark">
            {/* TODO: render AI explanations with confidence bars */}
            AI-explained items — to be implemented. High-confidence hypotheses shown as informational cards.
          </div>
        )}

        {activeTab === "review" && (
          <div className="space-y-4">
            {/* TODO: map over fetchReviewItems() results */}
            <ReviewCard
              transactionId="TXN-0847"
              source="stripe"
              amount={14723}
              currency="CAD"
              date="Jun 27, 2026"
              hypothesis="This is likely the capture of a $150.00 authorization from Jun 25 (TXN-0801). The $2.77 difference matches a promotional discount code applied at checkout."
              confidence={0.62}
              suggestedAction="match_with:TXN-0801"
            />
            <ReviewCard
              transactionId="TXN-0852"
              source="ledger"
              amount={20000}
              currency="CAD"
              date="Jun 28, 2026"
              hypothesis="No matching Stripe charge found. This may be a manual ledger entry created for an offline payment collected outside the platform."
              confidence={0.23}
              suggestedAction="investigate"
            />
          </div>
        )}

        {activeTab === "fraud" && (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted dark:bg-surface-dark">
            {/* TODO: render fraud-flagged items with candidate counts */}
            Fraud-flagged items — to be implemented. Transactions where the batch aggregation candidate set exceeded 10.
          </div>
        )}

        {activeTab === "all" && (
          <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted dark:bg-surface-dark">
            {/* TODO: render all transactions with status badges */}
            All transactions in this run — to be implemented. Sortable by amount, status, date.
          </div>
        )}
      </div>
    </>
  );
}
