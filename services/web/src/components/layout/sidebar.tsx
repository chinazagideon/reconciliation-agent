"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  GitCompareArrows,
  ScrollText,
  Settings,
} from "lucide-react";

// Navigation items matching PRD section 4.3
const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/runs", label: "Runs", icon: GitCompareArrows },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-surface dark:bg-surface-dark">
      {/* Logo / app name */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="h-7 w-7 rounded-md bg-explained flex items-center justify-center">
          <span className="text-white text-xs font-bold">R</span>
        </div>
        <span className="font-semibold text-sm tracking-tight">
          Resolution AI
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          // Active when path matches exactly or starts with the href
          // (except "/" which should only match exactly)
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-explained/10 text-explained font-medium"
                  : "text-muted hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <p className="text-xs text-muted">
          Resolution AI v0.1.0
        </p>
      </div>
    </aside>
  );
}
