import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: number;
  percentage?: string;
  accent: "matched" | "unmatched" | "explained" | "review" | "fraud";
  badge?: boolean; // show a notification dot for actionable counts
}

const accentClasses: Record<string, string> = {
  matched: "border-l-matched",
  unmatched: "border-l-unmatched",
  explained: "border-l-explained",
  review: "border-l-review",
  fraud: "border-l-unmatched",
};

export function MetricCard({ label, value, percentage, accent, badge }: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-surface dark:bg-surface-dark p-4 border-l-4",
        accentClasses[accent],
      )}
    >
      {/* Notification dot for actionable items */}
      {badge && value > 0 && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-review" />
      )}

      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {percentage && (
        <p className="mt-0.5 text-xs text-muted">{percentage}</p>
      )}
    </div>
  );
}
