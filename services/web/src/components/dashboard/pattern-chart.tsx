"use client";

// PRD: Discrepancy pattern distribution (horizontal bar chart).
// TODO: replace with recharts once real data is available.
const PLACEHOLDER_PATTERNS = [
  { pattern: "Timing", percentage: 42 },
  { pattern: "Fee gaps", percentage: 28 },
  { pattern: "Missing", percentage: 15 },
  { pattern: "Partial capture", percentage: 10 },
  { pattern: "Other", percentage: 5 },
];

export function PatternChart() {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold">Discrepancy Patterns (last 30 days)</h2>
      <div className="rounded-lg border border-border bg-surface dark:bg-surface-dark p-4 space-y-3">
        {PLACEHOLDER_PATTERNS.map(({ pattern, percentage }) => (
          <div key={pattern} className="flex items-center gap-3">
            <div className="w-28 text-xs text-muted">{pattern} ({percentage}%)</div>
            <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-3 rounded-full bg-explained/70 transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
