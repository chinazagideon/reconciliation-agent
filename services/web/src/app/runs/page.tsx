import { PageHeader } from "@/components/shared/page-header";
import { RunTable } from "@/components/runs/run-table";
import Link from "next/link";

// PRD Page 3: Runs list — history of all reconciliation runs.
export default function RunsPage() {
  return (
    <>
      <PageHeader
        title="Reconciliation Runs"
        action={
          <Link
            href="/runs/new"
            className="rounded-md bg-explained px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Run
          </Link>
        }
      />
      <RunTable />
    </>
  );
}
