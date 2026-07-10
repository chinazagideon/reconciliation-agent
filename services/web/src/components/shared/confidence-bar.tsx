import { cn, confidenceLabel } from "@/lib/utils";

interface ConfidenceBarProps {
  confidence: number; // 0.0 – 1.0
}

export function ConfidenceBar({ confidence }: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.7 ? "bg-matched" :
    confidence >= 0.4 ? "bg-review" :
    "bg-unmatched";

  return (
    <div className="flex items-center gap-2">
      {/* Bar */}
      <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn("h-2 rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Label */}
      <span className="text-xs font-mono text-muted">
        {confidence.toFixed(2)} · {confidenceLabel(confidence)}
      </span>
    </div>
  );
}
