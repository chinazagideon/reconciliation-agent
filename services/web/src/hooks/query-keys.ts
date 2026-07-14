// Central query-key factory.
//
// Every cache entry is keyed through `qk`, so invalidation is declarative and
// impossible to typo: a mutation invalidates `qk.runs.review(id)` rather than a
// hand-written array that might drift from the query hook. Partial keys (e.g.
// `["runs"]`) match every nested key for broad invalidation.

export const qk = {
  dashboard: {
    all: ["dashboard"] as const,
    metrics: () => ["dashboard", "metrics"] as const,
    patterns: () => ["dashboard", "patterns"] as const,
  },
  runs: {
    all: ["runs"] as const,
    list: (page: number, perPage: number) =>
      ["runs", "list", page, perPage] as const,
    detail: (id: string) => ["runs", "detail", id] as const,
    matches: (id: string, page: number) =>
      ["runs", id, "matches", page] as const,
    explanations: (id: string, page: number) =>
      ["runs", id, "explanations", page] as const,
    review: (id: string) => ["runs", id, "review"] as const,
    fraud: (id: string) => ["runs", id, "fraud"] as const,
  },
  tx: {
    all: ["tx"] as const,
    detail: (id: string) => ["tx", "detail", id] as const,
    audit: (id: string) => ["tx", "audit", id] as const,
  },
  audit: {
    all: ["audit"] as const,
    list: (filters: { page?: number; event?: string; actor?: string }) =>
      ["audit", "list", filters] as const,
  },
} as const;
