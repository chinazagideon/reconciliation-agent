import type { Metadata } from "next";
import "@/styles/globals.css";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata: Metadata = {
  title: "Resolution AI",
  description: "Financial reconciliation agent for two-sided marketplaces",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar navigation — fixed left */}
          <Sidebar />

          {/* Main content area — scrollable */}
          <main className="flex-1 overflow-y-auto bg-background p-6 lg:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
