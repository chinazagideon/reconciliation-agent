"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTransaction, fetchTransactionAudit } from "@/lib/api";
import { toTransactionVM, toAuditEntryVM } from "@/lib/mappers";
import type { TransactionVM, AuditEntryVM } from "@/lib/view-models";
import { qk } from "./query-keys";

// A single transaction → TransactionVM.
export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: qk.tx.detail(id ?? "—"),
    queryFn: () => fetchTransaction(id as string),
    enabled: !!id,
    select: (res): TransactionVM => toTransactionVM(res.data),
  });
}

// The audit trail for one transaction → AuditEntryVM[].
export function useTransactionAudit(id: string | undefined) {
  return useQuery({
    queryKey: qk.tx.audit(id ?? "—"),
    queryFn: () => fetchTransactionAudit(id as string),
    enabled: !!id,
    select: (res): AuditEntryVM[] => res.data.map(toAuditEntryVM),
  });
}
