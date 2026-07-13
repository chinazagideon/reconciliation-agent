"use client";

import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton } from "@/components/shared/skeleton";
import { RecentRuns } from "@/components/dashboard/recent-runs";
import { PatternChart } from "@/components/dashboard/pattern-chart";
import { useDashboardMetrics } from "@/hooks";
import Link from "next/link";
import { GitCompareArrows } from "lucide-react";

// PRD Page 1: Dashboard — "Is my money accounted for?"
export default function DashboardPage() {
  const { data: metrics, isPending, isError } = useDashboardMetrics();

  const newRunButton = (
    <Link
      href="/runs/new"
      className="rounded-md bg-explained px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      + New Run
    </Link>
  );

  // Empty and error both resolve to the same invitation to act — a graceful
  // degraded state while the backend is scaffolded.
  const showEmpty = isError || (metrics && metrics.total === 0);

  if (showEmpty) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={<GitCompareArrows className="h-10 w-10" />}
          title="No reconciliation runs yet"
          description="Generate seed data or start your first run to see reconciliation metrics here."
          action={
            <div className="flex gap-3">
              <Link
                href="/settings"
                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Generate Seed Data
              </Link>
              {newRunButton}
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" action={newRunButton} />

      {/* Metric cards — PRD top row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {isPending || !metrics ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard label="Matched" value={metrics.matched.count} percentage={metrics.matched.percentage} accent="matched" />
            <MetricCard label="Unmatched" value={metrics.unmatched.count} percentage={metrics.unmatched.percentage} accent="unmatched" />
            <MetricCard label="Explained" value={metrics.explained.count} percentage={metrics.explained.percentage} accent="explained" />
            <MetricCard label="Review" value={metrics.review.count} percentage={metrics.review.percentage} accent="review" badge />
            <MetricCard label="Fraud" value={metrics.fraud.count} percentage={metrics.fraud.percentage} accent="fraud" badge />
          </>
        )}
      </div>

      {/* Recent runs + pattern chart */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <RecentRuns />
        <PatternChart />
      </div>
    </>
  );
}
