import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { RecentRuns } from "@/components/dashboard/recent-runs";
import { PatternChart } from "@/components/dashboard/pattern-chart";
import Link from "next/link";
import { GitCompareArrows } from "lucide-react";

// PRD Page 1: Dashboard — "Is my money accounted for?"
// TODO: fetch real data from API. Static placeholder for scaffold.
export default function DashboardPage() {
  // Placeholder metrics — will come from fetchDashboardMetrics()
  const hasRuns = false;

  if (!hasRuns) {
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
              <Link
                href="/runs/new"
                className="rounded-md bg-explained px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + New Run
              </Link>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        action={
          <Link
            href="/runs/new"
            className="rounded-md bg-explained px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Run
          </Link>
        }
      />

      {/* Metric cards — PRD top row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Matched" value={342} percentage="93.4%" accent="matched" />
        <MetricCard label="Unmatched" value={8} percentage="2.2%" accent="unmatched" />
        <MetricCard label="Explained" value={8} percentage="2.2%" accent="explained" />
        <MetricCard label="Review" value={4} percentage="1.1%" accent="review" badge />
        <MetricCard label="Fraud" value={2} percentage="0.5%" accent="fraud" badge />
      </div>

      {/* Recent runs + pattern chart */}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <RecentRuns />
        <PatternChart />
      </div>
    </>
  );
}
