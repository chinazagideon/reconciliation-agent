// The wire envelope. Every response this service sends leaves through one of
// these, so a client never has to learn a bespoke key per endpoint:
//
//   single value → { data }
//   list         → { data, total, page, per_page }
//   failure      → { error }
//
// Controllers must not hand-roll their own envelope: that drift is exactly what
// left the client reading `data` while the server sent `entries`.
//
// These shapes mirror ApiResponse / PaginatedResponse in packages/shared, which
// is what the frontend consumes. They are redeclared rather than imported —
// core's build context (services/core) does not include packages/, so a
// cross-package import breaks both `tsc --rootDir src` and the Docker image.
// Keep the two in step; the real fix is an npm workspace with a built shared
// package, which is a bigger change than this one.
export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export function data<T>(value: T): ApiResponse<T> {
  return { data: value };
}

export function paginated<T>(
  items: T[],
  meta: { total: number; page: number; perPage: number },
): PaginatedResponse<T> {
  return {
    data: items,
    total: meta.total,
    page: meta.page,
    per_page: meta.perPage,
  };
}

export function failure(message: string): { error: string } {
  return { error: message };
}

export interface PageParams {
  page: number;
  perPage: number;
  limit: number;
  offset: number;
}

// `page`/`per_page` off the query string, clamped. Anything unparseable falls
// back to the defaults rather than reaching SQL as NaN.
export function pageParams(
  query: { page?: string | undefined; per_page?: string | undefined },
  defaultPerPage = 20,
  maxPerPage = 100,
): PageParams {
  const page = Math.max(1, Number(query.page) || 1);
  const requested = Number(query.per_page) || defaultPerPage;
  const perPage = Math.min(maxPerPage, Math.max(1, requested));
  return { page, perPage, limit: perPage, offset: (page - 1) * perPage };
}
