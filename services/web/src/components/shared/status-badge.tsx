import { cn, statusColor } from "@/lib/utils";
import type { RunStatus } from "@resolution/shared";

interface StatusBadgeProps {
  status: RunStatus | "fraud" | "review";
}

const dotColorMap: Record<string, string> = {
  done: "bg-matched",
  pending: "bg-muted",
  ingesting: "bg-explained",
  matching: "bg-explained",
  explaining: "bg-explained",
  failed: "bg-unmatched",
  fraud: "bg-unmatched",
  review: "bg-review",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", statusColor(status))}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dotColorMap[status])} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
