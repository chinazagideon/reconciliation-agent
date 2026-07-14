"use client";

// Client boundary that owns the TanStack Query cache for the whole app.
// Wrapped around {children} in the root layout. The QueryClient is created
// once per browser session via useState's lazy initializer (never re-created
// on re-render).
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
