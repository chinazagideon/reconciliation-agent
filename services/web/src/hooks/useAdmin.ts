"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateSeedData, resetAllData, uploadCsv } from "@/lib/api";
import { toSeedManifestVM } from "@/lib/mappers";
import { qk } from "./query-keys";

// Generate demo seed data → SeedManifestVM. Invalidates everything so the app
// reflects the freshly-seeded world.
export function useGenerateSeedData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generateSeedData().then((res) => toSeedManifestVM(res.data)),
    onSuccess: () => invalidateWorld(qc),
  });
}

// Wipe all data. Invalidates everything.
export function useResetAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resetAllData(),
    onSuccess: () => invalidateWorld(qc),
  });
}

// Upload a CSV with a column mapping → { imported, rejected }.
export function useUploadCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { file: File; mapping: Record<string, string> }) =>
      uploadCsv(args.file, args.mapping).then((res) => res.data),
    onSuccess: () => invalidateWorld(qc),
  });
}

function invalidateWorld(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.runs.all });
  qc.invalidateQueries({ queryKey: qk.dashboard.all });
  qc.invalidateQueries({ queryKey: qk.audit.all });
  qc.invalidateQueries({ queryKey: qk.tx.all });
}
