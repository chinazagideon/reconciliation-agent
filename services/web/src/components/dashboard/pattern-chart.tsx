"use client";

// PRD: Discrepancy pattern distribution (horizontal bar chart).
import { Skeleton } from "@/components/shared/skeleton";
import { usePatternDistribution } from "@/hooks";

export function PatternChart() {
  const { data: patterns, isPending, isError } = usePatternDistribution();

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Discrepancy Patterns (last 30 days)</h2>
      <div className="rounded-lg border border-border bg-surface dark:bg-surface-dark p-4 space-y-3">
        {isPending ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))
        ) : isError || !patterns || patterns.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">
            {isError ? "Couldn't load pattern data." : "No pattern data yet."}
          </p>
        ) : (
          patterns.map(({ pattern, percentage }) => (
            <div key={pattern} className="flex items-center gap-3">
              <div className="w-28 text-xs text-muted">{pattern} ({percentage}%)</div>
              <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-3 rounded-full bg-explained/70 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
