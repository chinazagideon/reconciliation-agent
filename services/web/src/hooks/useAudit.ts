"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchAuditLog } from "@/lib/api";
import { toAuditEntryVM, toPage } from "@/lib/mappers";
import type { AuditEntryVM, Page } from "@/lib/view-models";
import { qk } from "./query-keys";

export interface AuditFilters {
  page?: number;
  event?: string;
  actor?: string;
}

// Filterable, paginated audit log → Page<AuditEntryVM>.
export function useAuditLog(filters: AuditFilters) {
  return useQuery({
    queryKey: qk.audit.list(filters),
    queryFn: () => fetchAuditLog(filters),
    placeholderData: keepPreviousData,
    select: (res): Page<AuditEntryVM> => toPage(res, toAuditEntryVM),
  });
}
