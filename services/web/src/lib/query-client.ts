// TanStack Query client factory.
// One place to tune caching/retry defaults. The backend is scaffolded (many
// endpoints 404 today), so keep retries low to avoid hammering, and don't
// refetch on window focus — this is an internal ops tool, not a live feed.
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // 30s — data is fresh enough between navigations
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
