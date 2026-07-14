import { cn } from "@/lib/utils";

// A single shimmering placeholder block.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-100 dark:bg-gray-800",
        className,
      )}
    />
  );
}

// Preset: a card-shaped skeleton, sized like a MetricCard.
export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 dark:bg-surface-dark">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-6 w-10" />
      <Skeleton className="mt-2 h-3 w-12" />
    </div>
  );
}

// Preset: N skeleton rows for a table body. `cols` sets how many cells.
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
