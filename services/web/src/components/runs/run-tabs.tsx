import { cn } from "@/lib/utils";

type TabId = "matched" | "explained" | "review" | "fraud" | "all";

interface RunTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  counts?: Partial<Record<TabId, number>>;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "matched", label: "Matched", icon: "✓" },
  { id: "explained", label: "Explained", icon: "🤖" },
  { id: "review", label: "Review", icon: "●" },
  { id: "fraud", label: "Fraud", icon: "⚠" },
  { id: "all", label: "All", icon: "" },
];

export function RunTabs({ activeTab, onTabChange, counts }: RunTabsProps) {
  return (
    <div className="mt-6 flex gap-1 border-b border-border">
      {TABS.map(({ id, label, icon }) => {
        const count = counts?.[id];
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === id
                ? "border-explained text-explained"
                : "border-transparent text-muted hover:text-gray-900 dark:hover:text-gray-100",
            )}
          >
            {icon && <span className="mr-1">{icon}</span>}
            {label}
            {count != null && count > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-muted dark:bg-gray-800">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
