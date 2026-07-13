// Dev/demo mock API — a single catch-all route handler that serves the same
// contract the real core service will (ApiResponse<T> / PaginatedResponse<T>),
// backed by the fixtures in src/lib/mock-fixtures.ts.
//
// Activate by setting NEXT_PUBLIC_API_URL=/api/mock (see .env.example). This
// lets the entire frontend run end-to-end with no backend. When the real core
// service is ready, point NEXT_PUBLIC_API_URL at it and delete nothing here —
// the hooks/components don't change.

import { NextResponse } from "next/server";
import type { PaginatedResponse } from "@resolution/shared";
import * as fx from "@/lib/mock-fixtures";

type Params = { params: Promise<{ path: string[] }> };

// ── helpers ────────────────────────────────────────────────────
function ok<T>(data: T) {
  return NextResponse.json({ data });
}

function notFound(path: string[]) {
  return NextResponse.json(
    { error: `mock: no handler for /${path.join("/")}` },
    { status: 404 },
  );
}

function paginate<T>(all: T[], url: URL): PaginatedResponse<T> {
  const page = Number(url.searchParams.get("page") ?? "1");
  const perPage = Number(url.searchParams.get("per_page") ?? "20");
  const start = (page - 1) * perPage;
  return {
    data: all.slice(start, start + perPage),
    total: all.length,
    page,
    per_page: perPage,
  };
}

// ── GET ────────────────────────────────────────────────────────
export async function GET(req: Request, { params }: Params) {
  const { path } = await params;
  const url = new URL(req.url);
  const [a, b, c] = path;

  // /dashboard/*
  if (a === "dashboard" && b === "metrics") return ok(fx.dashboardMetrics);
  if (a === "dashboard" && b === "patterns") return ok(fx.patternDistribution);

  // /reconciliations...
  if (a === "reconciliations") {
    if (!b) return NextResponse.json(paginate(fx.runs, url)); // list
    if (b && !c) {
      const run = fx.getRun(b);
      return run ? ok(run) : notFound(path);
    }
    if (c === "matches") return NextResponse.json(paginate(fx.matches.filter((m) => m.run_id === b), url));
    if (c === "explanations") return NextResponse.json(paginate(fx.explanations.filter((e) => e.run_id === b), url));
    if (c === "review") return ok(fx.reviewItems);
    if (c === "fraud") return ok(fx.fraudItems);
  }

  // /transactions/:id, /transactions/:id/audit
  if (a === "transactions" && b) {
    if (c === "audit") return ok(fx.getTransactionAudit(b));
    const tx = fx.getTransaction(b);
    return tx ? ok(tx) : notFound(path);
  }

  // /audit?page&event&actor
  if (a === "audit") {
    const event = url.searchParams.get("event");
    const actor = url.searchParams.get("actor");
    let entries = fx.auditEntries;
    if (event) entries = entries.filter((e) => e.event === event);
    if (actor) entries = entries.filter((e) => e.actor.startsWith(actor));
    return NextResponse.json(paginate(entries, url));
  }

  return notFound(path);
}

// ── POST ───────────────────────────────────────────────────────
export async function POST(req: Request, { params }: Params) {
  const { path } = await params;
  const [a, b, c] = path;

  // POST /reconciliations → create a run (echo a new done-ish run)
  if (a === "reconciliations" && !b) {
    return ok({ ...fx.runs[0], id: `run_${Date.now()}`, status: "pending" });
  }

  // POST /reconciliations/:id/review → record a decision
  if (a === "reconciliations" && b && c === "review") {
    return ok(null);
  }

  // POST /seed
  if (a === "seed") return ok({ ...fx.seedManifest, generated_at: new Date().toISOString() });

  // POST /reset
  if (a === "reset") return ok(null);

  // POST /ingest/csv
  if (a === "ingest" && b === "csv") return ok({ imported: 42, rejected: 3 });

  return notFound(path);
}
