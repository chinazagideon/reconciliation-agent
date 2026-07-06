// Driven adapter implementing the ReconciliationRepository PORT with Postgres.
// Data access ONLY — no business logic. Parameterised queries only (no string
// interpolation into SQL — injection guard).
import type { ReconciliationRepository } from "../../../domain/reconciliation/ports.js";
import type { ReconciliationRun } from "../../../domain/reconciliation/reconciliation-run.js";
import { type Result, ok } from "../../../domain/shared/result.js";
import { pool } from "./pool.js";

export class PgReconciliationRepository implements ReconciliationRepository {
  async save(run: ReconciliationRun): Promise<Result<void>> {
    // TODO: INSERT ... ON CONFLICT DO UPDATE using $1,$2,... placeholders.
    void run; void pool;
    return ok(undefined);
  }
  async findById(id: string): Promise<Result<ReconciliationRun | null>> {
    // TODO: SELECT ... WHERE id = $1
    void id;
    return ok(null);
  }
}
