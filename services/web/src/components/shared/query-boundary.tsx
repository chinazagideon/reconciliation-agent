import type { ReactNode } from "react";

// One wrapper for the four states every data view has: loading, error, empty,
// and ready. Keeps skeleton/error/empty handling out of the pages themselves.
//
// Usage:
//   <QueryBoundary query={q} skeleton={<TableSkeleton/>} empty={<EmptyState.../>}>
//     {(data) => <List items={data} />}
//   </QueryBoundary>

interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

interface QueryBoundaryProps<T> {
  query: QueryLike<T>;
  skeleton: ReactNode;
  empty?: ReactNode;
  // Decide whether `data` counts as empty. Defaults to handling arrays and
  // { items: [] } pages.
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}

function defaultIsEmpty(data: unknown): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (data && typeof data === "object" && "items" in data) {
    return (data as { items: unknown[] }).items.length === 0;
  }
  return data == null;
}

export function QueryBoundary<T>({
  query,
  skeleton,
  empty,
  isEmpty = defaultIsEmpty,
  children,
}: QueryBoundaryProps<T>) {
  if (query.isPending) return <>{skeleton}</>;

  if (query.isError) {
    return (
      <div className="rounded-lg border border-unmatched/30 bg-red-50 p-4 text-sm text-unmatched dark:bg-red-900/10">
        <p className="font-medium">Couldn&apos;t load this data.</p>
        <p className="mt-1 text-xs opacity-80">
          {query.error?.message ?? "Unknown error"}
        </p>
      </div>
    );
  }

  const data = query.data as T;
  if (empty && isEmpty(data)) return <>{empty}</>;

  return <>{children(data)}</>;
}
