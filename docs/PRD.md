# Resolution AI — Product Requirements Document (v1)

**Last updated:** 2026-07-06
**Author:** Chinaza Gideon Ngwu
**Status:** Draft → Review

---

## 1. Why this exists

### 1.1 The problem (real-world)

Marketplace operators reconcile three sources of financial truth by hand:
the payment processor (Stripe), their internal double-entry ledger, and
supplier/tasker payout records. Mismatches — caused by timing gaps, fee
waterfalls, partial captures, failed webhooks, and retroactive chargebacks —
are found late, investigated slowly, and resolved manually.

### 1.2 The thesis (portfolio)

"Shipping AI features that touch money without catastrophic failure modes."

Most AI demos treat accuracy as optional because being wrong costs nothing.
Financial reconciliation is the opposite: every match is an assertion about
where money went, and a wrong assertion costs real money. Resolution AI
demonstrates the discipline of keeping deterministic logic in control and
using AI only where determinism runs out — with confidence scoring, audit
trails, and human-in-the-loop routing.

### 1.3 The audience (dual)

- **Primary (demo audience):** Engineering hiring managers and interviewers
  evaluating architectural thinking, system design, and AI integration
  competence. They will see a live demo or read the code.
- **Secondary (product persona):** A marketplace operator or finance lead
  who needs to trust that money in == money out, and needs an audit trail
  when it doesn't.

---

## 2. Core concepts

These are the domain terms used throughout the product. Consistent
vocabulary matters — the UI, API, database, and this document all use
the same words for the same things.

| Term | Definition |
|---|---|
| **Transaction** | A normalised, source-agnostic record of a single money movement. Has an amount (integer minor units), currency, timestamp, source, and the raw payload from the originating system. |
| **Source** | Where a transaction came from: `stripe`, `ledger`, `payout`, or `csv`. Each source is an adapter implementing the same port. |
| **Run** | One reconciliation execution over a date window. A run is a state machine: `pending` → `matching` → `explaining` → `done` (or `failed`). |
| **Match** | A pair of transactions (one from each side) that the deterministic matcher linked together. Every match records which strategy produced it. |
| **Residue** | The transactions left over after all deterministic matchers have run. This is the only input the AI sidecar ever sees. |
| **Explanation** | The AI sidecar's hypothesis about why a residue item didn't match. Includes a confidence score (0–1) and a `needs_human` flag. An explanation is a suggestion, never an authoritative decision. |
| **Review item** | A residue transaction with a low-confidence explanation (or no explanation) that has been routed to a human for manual resolution. |
| **Audit entry** | An append-only record of something that happened: a match was created, an explanation was generated, a human approved a suggestion. Nothing is ever deleted from the audit log. |

---

## 3. Features

### 3.1 Data ingestion

Analogy: the reconciliation agent is a detective. Ingestion is how the
detective gathers evidence. Each source is a different witness — they were
all at the same event but each tells a slightly different story.

#### 3.1.0 Source-agnostic normalisation layer

All ingestion adapters produce the same output: a normalised
`Transaction` record. The normalisation logic lives behind a
`FieldMapping` interface that tells the system where to find each
required field in any JSON payload:

```typescript
interface FieldMapping {
  source_name: string;       // "stripe", "ledger", "paypal", etc.
  amount_path: string;       // JSONPath to amount field: "$.amount"
  currency_path: string;     // "$.currency" or null if fixed
  currency_fixed?: string;   // fallback fixed currency: "CAD"
  date_path: string;         // "$.created" or "$.transaction_date"
  reference_path: string;    // "$.id" or "$.reference_number"
}
```

For v1, field mappings are **hardcoded per adapter** (Stripe, Ledger,
CSV). The architecture supports adding new sources by writing a new
`FieldMapping` config — no domain or application code changes needed.

**Deferred to v1.1:** A UI-based JSON field mapper where users
interactively map fields from an arbitrary JSON upload. The backend
normalisation layer already supports this; only the frontend is
missing.

#### 3.1.1 Stripe API connector

Pull balance transactions from Stripe for a given date range. Balance
transactions (not charges) are the correct Stripe object because they
include fees, payouts, refunds, and adjustments as first-class entries.

**Acceptance criteria:**
- User provides a Stripe API key (stored in env, not in DB).
- When a run starts, the connector pages through all balance transactions
  in the date window.
- Each balance transaction is normalised via the Stripe `FieldMapping`
  config into the `Transaction` shape: amount as integer minor units,
  ISO 4217 currency, timestamp, and the full raw JSON stored in `raw`.
- Idempotency: re-ingesting the same date range does not create duplicate
  transactions (dedupe on `source` + `external_id`).

#### 3.1.2 Internal ledger query

Read from the application's own double-entry ledger table.

**Acceptance criteria:**
- Queries ledger entries in the date window.
- Normalises into `Transaction` shape.
- This is a SQL query, not an API call — the ledger is in the same database.

#### 3.1.3 CSV upload with column mapping

Upload a CSV file (bank statement, accounting export, payout report) and
map its columns to the `Transaction` shape.

**Acceptance criteria:**
- User uploads a CSV file via drag-and-drop or file picker.
- UI shows a preview of the first 5 rows.
- User maps columns: which column is `amount`, `date`, `reference/id`,
  `currency` (or set a default currency for the whole file).
- Mapped rows are normalised into `Transaction` records.
- Validation: reject rows where amount is not numeric, date is not
  parseable. Show count of accepted vs rejected rows.
- The UI does NOT require the user to understand the Transaction schema —
  the column mapper uses plain language: "Which column has the amount?",
  "Which column has the date?"

#### 3.1.4 Synthetic data seeder

Generate realistic test data with known discrepancy patterns baked in.
This is a dev/demo tool, not a user feature — but it's critical for
the portfolio demo.

Analogy: this is the answer key to a test. You write the exam (the
seeded data with known discrepancies), then run the student (the
reconciliation engine) against it, and compare the output to the
answer key. Without the answer key, the demo is "trust me, it works."
With it, the demo is "here's proof."

**Trigger:** `POST /seed` (API) or `npm run seed` (CLI).

**Output:** ~200 transactions across `stripe`, `ledger`, and `payout`
sources in the run window, plus a `seed-manifest.json` file that
records the expected outcome for each transaction.

**Data realism:** Seeded Stripe records use the **real Stripe Balance
Transaction JSON shape** (from API docs). This tests the normalisation
layer with production-shaped data, not toy objects. Example:

```json
{
  "id": "txn_1QxR2a2eZvKYlo2C",
  "object": "balance_transaction",
  "amount": 14723,
  "currency": "cad",
  "created": 1719446400,
  "available_on": 1719532800,
  "description": "Payment for move booking #MB-2026-0847",
  "fee": 457,
  "fee_details": [
    {
      "amount": 457,
      "currency": "cad",
      "description": "Stripe processing fees",
      "type": "stripe_fee"
    }
  ],
  "net": 14266,
  "reporting_category": "charge",
  "source": "ch_1QxR2a2eZvKYlo2C",
  "status": "available",
  "type": "charge"
}
```

Ledger records use a double-entry shape with debit/credit sides.
Payout records use a simplified bank statement shape.

**Discrepancy patterns and distribution:**

| # | Pattern | Count | Side A (Stripe) | Side B (Ledger) | Expected outcome |
|---|---|---|---|---|---|
| 1 | **Exact match** | ~120 (60%) | $X on day D | $X on day D | `exact_matcher` pairs them |
| 2 | **Timing mismatch** | ~20 (10%) | $X on day D | $X on day D+1 | `tolerant:timing` pairs them |
| 3 | **Fee discrepancy** | ~16 (8%) | $X on day D | $(X + stripe_fee) on day D | `tolerant:fee` pairs them |
| 4 | **Partial capture** | ~10 (5%) | $X (capture) on day D | $Y (auth, Y>X) on day D-2 | AI explains, links by payment intent |
| 5 | **Missing on one side** | ~10 (5%) | $X on day D | _(absent)_ | AI explains: "failed webhook" |
| 6 | **Refund** | ~8 (4%) | -$X on day D+30 | _(no reversal yet)_ | AI explains: "unprocessed refund" |
| 7 | **Batched payout** | ~8 (4%) | $X (single payout) | $A + $B + $C where A+B+C = X | `tolerant:batch` pairs them |
| 8 | **Rounding** | ~4 (2%) | $X on day D | $(X ± 1-2 cents) on day D | `tolerant:fee` pairs them (within tolerance) |
| 9 | **Fraud flag** | ~4 (2%) | $X (single payout) | 12+ small entries in window | Flagged: candidate set > 10 |

Total: ~200 transactions (~100 pairs/groups, since each pattern
produces records on both sides except "missing" and "refund").

**Amount ranges:** Seeded amounts should be realistic for a moving
marketplace: $50–$2,500 CAD, weighted toward $150–$500 (typical local
move). All amounts as integer minor units (cents).

**Date range:** The seeder generates data for a fixed 14-day window
(e.g. Jun 16–30, 2026). Timestamps are realistic (business hours,
no transactions at 3am) with randomised hours/minutes to prevent
every record having the same timestamp.

**Reference IDs:** Stripe records use realistic `txn_`, `ch_`, `py_`
prefixes. Ledger records use `LED-YYYYMMDD-NNN`. Payout records use
`PAY-YYYYMMDD-NNN`. The payment intent ID (`pi_`) is the link between
related records across sources (e.g. auth and capture, charge and
refund).

**Seed manifest (`seed-manifest.json`):**

```json
{
  "generated_at": "2026-07-06T10:00:00Z",
  "window": { "start": "2026-06-16", "end": "2026-06-30" },
  "total_records": 200,
  "patterns": [
    {
      "pattern": "exact_match",
      "count": 120,
      "expected_matcher": "exact",
      "records": [
        {
          "stripe_id": "txn_1QxR2a...",
          "ledger_id": "LED-20260624-001",
          "amount_minor": 15000,
          "currency": "CAD"
        }
      ]
    },
    {
      "pattern": "fraud_flag",
      "count": 4,
      "expected_outcome": "flag_fraud",
      "records": [
        {
          "payout_id": "PAY-20260628-001",
          "candidate_count": 14,
          "note": "Abnormally high candidate count"
        }
      ]
    }
  ],
  "expected_results": {
    "exact_matches": 120,
    "tolerant_matches": 48,
    "ai_explained": 28,
    "fraud_flagged": 4,
    "total_matched_pct": "84%"
  }
}
```

**Acceptance criteria:**
- `POST /seed` generates ~200 records and returns the manifest summary.
- Stripe records use real Balance Transaction JSON shapes.
- Running a full reconciliation against seeded data produces results
  that match `expected_results` within ±5% (randomised amounts
  may cause minor variance in fee-tolerance matching).
- Running `POST /seed` twice does not duplicate records (idempotency
  — the seeder clears existing seed data before inserting).
- The manifest is persisted to disk (`seed-manifest.json`) and
  returned in the API response for programmatic verification.

### 3.2 Reconciliation engine

Analogy: matchers are lenses on the same pile of records. The detective
snaps on the "exact" lens first (cheapest, most reliable), then the
"tolerant" lens for what's left, and only calls in the AI specialist
for the items that no lens could resolve.

#### 3.2.1 Exact matcher (deterministic)

The strictest, cheapest strategy. Runs first.

**Matching logic:**
- Match on: `amount_minor` AND `currency` AND `date(occurred_at)` (same
  calendar day in UTC).
- One-to-one pairing: once a record is matched, it's consumed and cannot
  match again.
- When multiple candidates exist, prefer the one with the closest
  timestamp.

**Acceptance criteria:**
- Processes all unmatched transactions in the run window.
- Produces `Match` records with `strategy: "exact"`.
- Residue (unmatched items) is passed to the next matcher.
- Performance: handles 1,000 transactions in under 2 seconds.

#### 3.2.2 Tolerant matcher (deterministic)

Second pass. Catches the common discrepancies that the exact matcher
misses.

**Matching logic — runs three sub-strategies in order:**
1. **Timing tolerance:** same amount and currency, dates differ by ≤1
   calendar day.
2. **Fee tolerance:** same currency and date, amounts differ by a known
   fee pattern (Stripe's 2.9% + $0.30, or the platform's configured
   fee percentage ± $0.02 rounding).
3. **Batch aggregation:** one record on side A matches the SUM of
   multiple records on side B (same currency, same date or date ±1,
   sum matches within $0.02). The candidate set is filtered by
   currency and date (±1 day) first, then combinations are tested.

   **Combinatorial safety cap:** If the filtered candidate set has
   more than 10 entries, skip the combinatorial search entirely and
   flag the transaction for **fraud review** — a legitimate batch
   payout rarely maps to more than 10 individual records, and an
   abnormally high candidate count is itself a signal worth
   investigating. Fraud-flagged items get `suggested_action:
   "flag_fraud"` and route directly to human review with a distinct
   UI badge, bypassing the AI sidecar (the sidecar explains
   ambiguity, not anomaly).

   Pipeline for one batch aggregation attempt:
   ```
   target = unmatched record ($450 CAD, Jun 28)
       ↓
   candidates = opposite-side records WHERE currency = target.currency
                AND date BETWEEN target.date - 1 AND target.date + 1
       ↓
   if candidates.length > 10 → flag_fraud, route to human review
       ↓
   for k in 2..candidates.length:
     for combo in combinations(candidates, k):
       if abs(sum(combo) - target) <= tolerance → MATCH
   ```

**Acceptance criteria:**
- Only runs on residue from the exact matcher (never re-evaluates
  already-matched items).
- Each match records the specific sub-strategy that produced it.
- Transactions with >10 filtered candidates are flagged as
  `flag_fraud` and routed to human review with a distinct badge.
- Residue from all three sub-strategies (minus fraud-flagged items)
  is the final residue handed to the AI sidecar.

#### 3.2.3 AI explainer (probabilistic — the sidecar)

The sidecar receives only the residue. It proposes hypotheses, never
makes decisions.

**Acceptance criteria:**
- Receives unmatched transactions as structured input.
- Calls the Anthropic Claude API with a constrained system prompt.
- Returns for each item:
  - `hypothesis`: a plain-English explanation of why it didn't match
    (e.g. "This appears to be a chargeback reversal for transaction
    X — the original was processed 45 days ago").
  - `confidence`: 0.0–1.0 (model must self-assess; prompt enforces this).
  - `suggested_action`: one of `match_with:<txn_id>`, `flag_refund`,
    `flag_chargeback`, `investigate`, `dismiss`.
  - `needs_human`: `true` if confidence < threshold.
- Confidence threshold is configured via env var
  (`AI_CONFIDENCE_THRESHOLD=0.70`). The Settings page displays it as
  read-only (runtime config lives in env, not in the database).
- Items with `needs_human: true` appear in the review queue.
- Items with `needs_human: false` are displayed as AI-resolved but still
  require no automatic writes — they're suggestions in the UI.
- The explainer NEVER creates or modifies a `Match` record directly.
  Only the human review action can promote an AI suggestion to a match.

#### 3.2.4 Graceful degradation (ADR-0006)

If the AI sidecar is unreachable (timeout, 5xx, network error), the
run completes with deterministic results only. The AI explanation step
is marked as `skipped` in the run record. The run status is `done`
(not `failed`), with a `partial: true` flag.

Analogy: if the specialist consultant doesn't answer the phone, the
detective still files the report with the evidence they have. The
report notes "specialist unavailable" — it doesn't go in the bin.

**Acceptance criteria:**
- Sidecar health check (`GET /health`) is called before sending
  residue. If unhealthy, skip immediately.
- Run completes with status `done` and `ai_skipped: true`.
- All residue items are routed to human review with a note:
  "AI explanation unavailable — routed for manual review."
- Dashboard and run detail clearly indicate the run was partial
  (e.g. "Completed without AI" label).

### 3.3 Human-in-the-loop review

The final gate. AI suggests; humans decide.

**Acceptance criteria:**
- Review queue shows all items where `needs_human: true`.
- Each item displays: the transaction, the AI hypothesis, confidence
  score, and suggested action.
- User can take one of three actions:
  1. **Approve** — accepts the AI suggestion. If the suggestion was
     `match_with:<txn_id>`, a `Match` record is created with
     `strategy: "human_approved"`.
  2. **Override** — user provides their own explanation and action.
  3. **Dismiss** — marks the item as reviewed with no action taken.
- Every action is written to the audit log with `actor: "user"`.
- The review queue count is visible from the dashboard (badge).

### 3.4 Audit trail

Everything that happens is recorded. Nothing is deleted.

**Acceptance criteria:**
- Every match, explanation, review action, and run state transition
  produces an audit entry.
- Audit entries are immutable (append-only table, no UPDATE/DELETE).
- Each entry records: timestamp, actor (`system:exact_matcher`,
  `system:tolerant_matcher`, `system:agent`, `user:<id>`), event type,
  entity ID, and a JSON detail blob.
- The audit log is viewable in the UI with filtering by event type,
  actor, and date range.
- For any transaction, a user can see its full audit history:
  "ingested → matched by exact_matcher" or "ingested → unmatched →
  explained by agent (confidence 0.45) → reviewed by user → approved."

---

## 4. UI design

### 4.1 Design direction

**Tone:** Serious but not sterile. This is a financial tool — trust and
clarity are the priorities. No playful gradients, no rounded-everything.
Think Bloomberg Terminal meets a modern SaaS dashboard.

**Palette:**
- Background: `#FAFAFA` (light) / `#0F1117` (dark mode)
- Surface: `#FFFFFF` / `#1A1D27`
- Primary accent: `#2563EB` (blue — trust, financial convention)
- Success (matched): `#16A34A`
- Warning (needs review): `#D97706`
- Danger (unmatched/failed): `#DC2626`
- Muted text: `#6B7280`
- Border: `#E5E7EB`

**Typography:** Inter for UI, JetBrains Mono for amounts and IDs.
Amounts are always monospaced and right-aligned — financial convention.

**Component library:** shadcn/ui (already in the stack). No custom
component system. Use the default shadcn theme with the palette above.

**Key design rule:** Every number on screen must be traceable. If you
see $147.23, you can click it and see where it came from, what it
matched with, and what happened to it. No dead-end data.

### 4.2 Pages

#### Page 1: Dashboard (`/`)

The home screen. One-glance answer to: "Is my money accounted for?"

```
┌─────────────────────────────────────────────────────────────────┐
│  RESOLUTION AI                              [Settings]  [User] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │MATCHED │ │UNEXPL. │ │EXPLAIN │ │ REVIEW │ │ FRAUD  │      │
│  │  342   │ │   8    │ │   8    │ │  4 ●   │ │  2 ⚠   │      │
│  │ 93.4%  │ │  2.2%  │ │  2.2%  │ │  1.1%  │ │  0.5%  │      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                                 │
│  Recent Runs                              [+ New Run]          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Jun 24–30  │ Done    │ 180 matched │ 3 review │ 2m ago │   │
│  │ Jun 17–23  │ Done    │ 162 matched │ 0 review │ 1w ago │   │
│  │ Jun 10–16  │ Failed  │ —           │ —        │ 2w ago │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Discrepancy patterns (last 30 days)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ██████████████████  Timing (42%)                        │   │
│  │ ████████████        Fee gaps (28%)                      │   │
│  │ ██████              Missing (15%)                       │   │
│  │ ████                Partial capture (10%)               │   │
│  │ ██                  Other (5%)                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Metric cards** (top row):
- **Matched** — total transactions paired by deterministic matchers.
  Green accent. Clicking navigates to the matched tab of the latest run.
- **Unmatched** — residue after all matchers and AI. Red accent.
- **Explained** — items the AI sidecar returned a hypothesis for
  with confidence ≥ threshold. Blue accent.
- **Review** — items awaiting human decision (low confidence or no
  explanation). Orange accent with badge count. This is the
  call-to-action — the number that should go to zero.
- **Fraud** — items flagged by the batch aggregation safety cap
  (>10 candidates). Red/amber accent with warning icon. These
  bypass the AI sidecar and route directly to human review with a
  distinct badge. A non-zero fraud count is always worth
  investigating.

**Recent runs table:**
- Columns: date window, status (with color indicator), matched count,
  review count, time ago.
- Click a row → navigates to Run Detail.

**Discrepancy pattern chart:**
- Horizontal bar chart showing the distribution of discrepancy types
  across recent runs.
- Insight for the persona: "Most of my mismatches are timing — maybe I
  should widen my settlement window."
- Insight for the interviewer: "This candidate built analytics on top
  of reconciliation output."

#### Page 2: New Run (`/runs/new`)

Start a reconciliation run.

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                           │
│                                                                 │
│  New Reconciliation Run                                        │
│                                                                 │
│  Date Range                                                    │
│  ┌────────────────┐  ┌────────────────┐                       │
│  │ Jun 24, 2026   │  │ Jun 30, 2026   │                       │
│  └────────────────┘  └────────────────┘                       │
│                                                                 │
│  Sources                                                       │
│  ┌─────────────────────────────────────────────┐              │
│  │ ☑ Stripe       Connected (sk_test_...x4f)  │              │
│  │ ☑ Ledger       142 entries in window        │              │
│  │ ☐ CSV Upload   Drag a file or browse        │              │
│  └─────────────────────────────────────────────┘              │
│                                                                 │
│  ┌ CSV Column Mapping (shown when CSV is uploaded) ──────┐    │
│  │                                                        │    │
│  │  Preview: first 5 rows of your file                   │    │
│  │  ┌──────────┬──────────┬──────────┬──────────┐        │    │
│  │  │ col_a    │ col_b    │ col_c    │ col_d    │        │    │
│  │  │ 2026-06… │ 14723    │ CAD      │ REF-001  │        │    │
│  │  └──────────┴──────────┴──────────┴──────────┘        │    │
│  │                                                        │    │
│  │  Amount column:    [col_b     ▼]                      │    │
│  │  Date column:      [col_a     ▼]                      │    │
│  │  Currency column:  [col_c     ▼]  or fixed: [CAD]     │    │
│  │  Reference column: [col_d     ▼]                      │    │
│  │                                                        │    │
│  │  143 rows valid  ·  2 rows rejected (non-numeric amt) │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│                                 [Start Reconciliation]         │
└─────────────────────────────────────────────────────────────────┘
```

**Behaviour:**
- Date range defaults to last 7 days.
- Stripe and Ledger are pre-checked if configured.
- CSV upload is optional — when a file is dropped, the column mapper
  appears inline.
- "Start Reconciliation" is disabled until at least two sources are
  selected (reconciliation requires two sides to compare).
- On start: navigates to Run Detail, which shows live progress.

#### Page 3: Runs list (`/runs`)

History of all reconciliation runs.

```
┌──────────────────────────────────────────────────────────────────┐
│  Reconciliation Runs                            [+ New Run]     │
│                                                                  │
│  ┌─────────┬──────────┬─────────┬──────────┬────────┬────────┐ │
│  │ Window  │ Status   │ Matched │ Residue  │ Review │ Date   │ │
│  ├─────────┼──────────┼─────────┼──────────┼────────┼────────┤ │
│  │ Jun 24… │ ● Done   │ 180     │ 3        │ 0      │ Jul 1  │ │
│  │ Jun 17… │ ● Done   │ 162     │ 5        │ 2 ●    │ Jun 24 │ │
│  │ Jun 10… │ ● Failed │ —       │ —        │ —      │ Jun 17 │ │
│  └─────────┴──────────┴─────────┴──────────┴────────┴────────┘ │
│                                                                  │
│  Showing 3 of 12 runs                       [← Prev] [Next →]  │
└──────────────────────────────────────────────────────────────────┘
```

- Status dots: green (done), yellow (in progress), red (failed).
- Review column shows orange badge if items are pending.
- Click any row → Run Detail.

#### Page 4: Run Detail (`/runs/:id`)

The main working screen. Where the operator spends most of their time.

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Runs    Run: Jun 24–30, 2026                 Status: Done   │
│                                                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ Total  │ │Matched │ │Explain │ │ Review │ │ Fraud  │      │
│  │  195   │ │  180   │ │   8    │ │  4 ●   │ │  2 ⚠   │      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                                  │
│  [Matched ✓] [Explained 🤖] [Review ●] [Fraud ⚠] [All]       │
│                                                                  │
│  ─── Currently showing: Needs Review (4) ─────────────────────  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ TXN-0847 · Stripe · $147.23 CAD · Jun 27                 │ │
│  │                                                            │ │
│  │ AI Hypothesis:                                            │ │
│  │ "This is likely the capture of a $150.00 authorization    │ │
│  │  from Jun 25 (TXN-0801). The $2.77 difference matches    │ │
│  │  a promotional discount code applied at checkout."        │ │
│  │                                                            │ │
│  │ Confidence: ██████░░░░ 0.62                               │ │
│  │ Suggested: match_with:TXN-0801                            │ │
│  │                                                            │ │
│  │           [✓ Approve]  [✎ Override]  [✕ Dismiss]          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ TXN-0852 · Ledger · $200.00 CAD · Jun 28                 │ │
│  │                                                            │ │
│  │ AI Hypothesis:                                            │ │
│  │ "No matching Stripe charge found. This may be a manual    │ │
│  │  ledger entry created for an offline payment collected    │ │
│  │  outside the platform."                                   │ │
│  │                                                            │ │
│  │ Confidence: ██░░░░░░░░ 0.23                               │ │
│  │ Suggested: investigate                                    │ │
│  │                                                            │ │
│  │           [✓ Approve]  [✎ Override]  [✕ Dismiss]          │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Tabs:**

- **Matched** — paired records. Each row shows left record, right
  record, match strategy, and a link to the transaction detail.
  Sorted by amount descending (biggest transactions first — that's
  where mistakes cost the most).
- **Explained** — items where the AI returned confidence ≥ 0.7.
  Shown as informational. User can still override.
- **Needs Review** — items where confidence < 0.7 or no explanation.
  This is the action queue. Each card shows the transaction,
  hypothesis, confidence bar, and three action buttons.
- **All** — every transaction in the run, with a status badge
  (matched / explained / review / unmatched).

**Review actions (on each card):**
- **Approve** — accepts the suggestion. Creates a match record (if
  suggestion was `match_with`) or marks as resolved. Writes to audit.
- **Override** — opens a small form: user writes their own explanation
  and selects an action. Writes to audit with `actor: "user"`.
- **Dismiss** — marks as reviewed, no action. Writes to audit.
  The item moves out of the review queue.

#### Page 5: Transaction Detail (`/transactions/:id`)

Deep dive into a single transaction's full lifecycle.

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Run                                                  │
│                                                                  │
│  Transaction TXN-0847                                           │
│                                                                  │
│  ┌─────────────────────────┬─────────────────────────┐         │
│  │ THIS RECORD             │ MATCHED WITH             │         │
│  │                         │                          │         │
│  │ Source: Stripe          │ Source: Ledger            │         │
│  │ Amount: $147.23 CAD     │ Amount: $150.00 CAD      │         │
│  │ Date: Jun 27, 2026      │ Date: Jun 25, 2026       │         │
│  │ Ref: pi_3N7x...        │ Ref: LED-20260625-042    │         │
│  │ Status: Captured        │ Status: Posted           │         │
│  │                         │                          │         │
│  │ Difference: -$2.77      │ Date gap: 2 days         │         │
│  └─────────────────────────┴─────────────────────────┘         │
│                                                                  │
│  Fee Waterfall                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Gross charge              $150.00                        │  │
│  │ Promo discount            - $2.77                        │  │
│  │ Net charge (Stripe)       $147.23                        │  │
│  │ Stripe processing fee     - $4.57                        │  │
│  │ Platform fee (15%)        - $22.08                        │  │
│  │ Tasker payout             $120.58                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Audit Trail                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Jul 1 09:14  system:stripe      ingested                │  │
│  │ Jul 1 09:14  system:exact       no match (amount diff)  │  │
│  │ Jul 1 09:15  system:tolerant    no match (>1 day gap)   │  │
│  │ Jul 1 09:15  system:agent       explained (conf: 0.62)  │  │
│  │ Jul 1 10:32  user:chinaza       approved → matched      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Raw Payload                                          [Expand] │
│  { "id": "txn_3N7x...", "amount": 14723, ... }                │
└──────────────────────────────────────────────────────────────────┘
```

**Key sections:**
- **Side-by-side comparison** — the two records that are matched (or
  the single unmatched record). Highlights differences in red.
- **Fee waterfall** — only shown when the match involves a fee
  discrepancy. Breaks down the path from gross to net.
- **Audit trail** — every event that touched this transaction, in
  chronological order. This is the "receipt" that proves every
  decision was traceable.
- **Raw payload** — collapsible JSON of the original Stripe/ledger
  record. For debugging and for interviewers who want to see data
  fidelity.

#### Page 6: Sources / Settings (`/settings`)

Manage data source connections and application configuration.

```
┌──────────────────────────────────────────────────────────────────┐
│  Settings                                                        │
│                                                                  │
│  Data Sources                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Stripe                                                    │   │
│  │ Status: ● Connected                                      │   │
│  │ Key: sk_test_...x4f              [Update Key] [Test]     │   │
│  │ Last sync: Jul 1, 2026 at 09:14                          │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ Internal Ledger                                          │   │
│  │ Status: ● Active                                         │   │
│  │ Records: 1,247 total                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Platform Configuration                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Platform fee:     [15    ] %                              │   │
│  │ Currency:         [CAD   ▼]                               │   │
│  │ Fee tolerance:    [0.02  ] (max rounding diff in $)       │   │
│  │ Timing tolerance: [1     ] day(s)                         │   │
│  │ AI confidence threshold: [0.70] (below → human review)   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Demo Tools                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [Generate Seed Data]  Creates ~200 test transactions     │   │
│  │                       with 8 discrepancy patterns.       │   │
│  │ [Reset All Data]      Clears all transactions, runs,     │   │
│  │                       and audit entries. Irreversible.   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Page 7: Audit Log (`/audit`)

Global audit log view.

```
┌──────────────────────────────────────────────────────────────────┐
│  Audit Log                                                       │
│                                                                  │
│  Filters: [All events ▼]  [All actors ▼]  [Date range]         │
│                                                                  │
│  ┌──────────┬─────────────────┬──────────────┬───────────────┐  │
│  │ Time     │ Actor           │ Event        │ Detail        │  │
│  ├──────────┼─────────────────┼──────────────┼───────────────┤  │
│  │ 10:32:14 │ user:chinaza    │ review.done  │ TXN-0847 →   │  │
│  │          │                 │              │ approved      │  │
│  │ 09:15:02 │ system:agent    │ explained    │ TXN-0847     │  │
│  │          │                 │              │ conf: 0.62   │  │
│  │ 09:14:58 │ system:tolerant │ no_match     │ TXN-0847     │  │
│  │ 09:14:55 │ system:exact    │ match.created│ TXN-0801 ↔   │  │
│  │          │                 │              │ TXN-0802     │  │
│  │ 09:14:01 │ system:stripe   │ ingested     │ 195 records  │  │
│  │ 09:14:00 │ system          │ run.started  │ Run Jun 24-30│  │
│  └──────────┴─────────────────┴──────────────┴───────────────┘  │
│                                                                  │
│  Showing 50 of 1,247 entries               [← Prev] [Next →]   │
└──────────────────────────────────────────────────────────────────┘
```

- Filterable by event type, actor, and date range.
- Each row links to the relevant transaction or run.
- Newest first by default.

### 4.3 Navigation

Sidebar navigation (desktop) / bottom nav (mobile):

1. **Dashboard** — `/`
2. **Runs** — `/runs` (with `/runs/new` and `/runs/:id`)
3. **Audit Log** — `/audit`
4. **Settings** — `/settings`

Transactions (`/transactions/:id`) are detail pages accessed from
within a run — they don't have their own nav entry.

### 4.4 Empty states

Every page has a considered empty state. Empty states are invitations
to act, not dead ends.

- **Dashboard (no runs yet):** "No reconciliation runs yet. Generate
  seed data or start your first run." Buttons: [Generate Seed Data]
  [+ New Run].
- **Run detail (run in progress):** Live status bar with the current
  step: "Matching... 142 of 195 transactions processed."
- **Review tab (all items resolved):** "All items reviewed. Nothing
  needs attention." with a checkmark.
- **Audit log (empty):** "No activity yet. Start a reconciliation
  run to see events here."

---

## 5. Success criteria for v1

### 5.1 Functional (must-have to call v1 "done")

| # | Criterion | How to verify |
|---|---|---|
| F1 | Synthetic seeder generates ~200 transactions with 9 discrepancy patterns using real Stripe JSON shapes | Run `POST /seed`, then `SELECT count(*) FROM reconciliation.transactions` returns ~200. `seed-manifest.json` lists all 9 patterns. Stripe records have real `txn_`, `ch_`, `py_` prefixes and full Balance Transaction structure. |
| F2 | Seeder is idempotent and verifiable | Running `POST /seed` twice produces the same record count (no duplicates). Reconciliation output matches `expected_results` in the manifest within ±5%. |
| F3 | Exact matcher pairs records by (amount, currency, same-day) | Run a reconciliation against seeded data. Matched count ≈ 120 (60%). Spot-check 5 matches: identical amounts, same-day timestamps. |
| F4 | Tolerant matcher catches timing (±1 day), fee, and batch discrepancies | After exact matcher, tolerant matcher resolves ≈ 48 records. Spot-check: timing matches differ by 1 day; fee matches differ by Stripe's 2.9%+$0.30; batch matches show N-to-1 summation. |
| F5 | Batch aggregation flags fraud when candidates > 10 | Seeded fraud-pattern transactions (12+ candidates) are flagged as `flag_fraud` and appear in a distinct Fraud tab with a warning badge. They do not reach the AI sidecar. |
| F6 | AI explainer returns hypothesis + confidence for residue items | Every non-fraud residue item has an explanation with `0.0 ≤ confidence ≤ 1.0`. Items below `AI_CONFIDENCE_THRESHOLD` have `needs_human: true`. |
| F7 | Graceful degradation: run completes without AI sidecar | Stop the Python sidecar. Start a run. Run completes with status `done` and `ai_skipped: true`. All residue items routed to human review with "AI unavailable" note. |
| F8 | Human review: approve, override, and dismiss all work correctly | Approve a suggestion → match record created, audit entry written. Dismiss → item leaves review queue, audit entry written. Override → user explanation saved, audit entry written. |
| F9 | Audit log captures every action | After a full run + review, audit log contains entries for: run.started, ingested, match.created, flag_fraud, explained, review.done, run.completed. |
| F10 | CSV upload with column mapping works | Upload a 50-row CSV with non-standard column names. Map columns. Verify 50 transactions created with correct amounts and dates. |
| F11 | Dashboard metrics are correct | After a run: matched + unmatched + explained + review + fraud = total. Review and fraud badge counts match actual pending items. |
| F12 | Transaction detail shows side-by-side comparison and audit trail | Click any matched transaction. Both records visible. Audit trail shows chronological lifecycle. Fraud-flagged items show the candidate count that triggered the flag. |
| F13 | Stripe connector pulls real balance transactions | Configure a Stripe test-mode key. Run reconciliation. Stripe transactions appear with correct amounts and raw JSON preserved. |

### 5.2 Non-functional (quality bar)

| # | Criterion | How to verify |
|---|---|---|
| N1 | A full run on 200 transactions completes in under 30 seconds | Time the run from start to done. Excludes AI sidecar latency (API call). |
| N2 | No floating-point arithmetic anywhere in the codebase | `grep -r "parseFloat\|toFixed\|\.toFixed\|Math\.round" services/core/src/` returns zero results in domain/application layers. |
| N3 | Every write operation has an idempotency key | Review `INSERT` statements: all use `ON CONFLICT` with idempotency key. |
| N4 | The AI sidecar never writes to the database | Review agent service code: no database imports, no SQL, no ORM. It only receives HTTP requests and returns JSON responses. |
| N5 | The app is deployable to Fly.io with one command per service | `fly deploy` from each service directory succeeds. Both services health-check green. |
| N6 | Dark mode works | Toggle dark mode. All pages readable, no white flashes, amounts remain legible. |

### 5.3 Demo script (the portfolio walkthrough)

This is the 5-minute demo that proves everything works:

1. **Open dashboard.** Empty state visible. "No runs yet."
   (10 seconds)
2. **Generate seed data.** Click the button. "200 transactions
   created with 8 discrepancy patterns." Dashboard still shows no
   runs. (15 seconds)
3. **Start a new run.** Select date range, Stripe + Ledger sources.
   Click "Start Reconciliation." (20 seconds)
4. **Watch the run execute.** Status bar moves through states:
   pending → matching → explaining → done. Dashboard metrics
   populate. (30 seconds — mostly AI sidecar latency)
5. **Review matched items.** Click the Matched tab. Show 3–4 exact
   matches. Click one → transaction detail with side-by-side view.
   Point out the audit trail. (60 seconds)
6. **Review AI explanations.** Click the Explained tab. Show a fee
   discrepancy the AI caught. Point out the confidence score and
   the fee waterfall. (45 seconds)
7. **Handle the review queue.** Click Needs Review tab. 4 items.
   Approve one (AI suggestion was correct). Override one (AI was
   wrong — provide own explanation). Dismiss one. Show the review
   queue count drop from 4 to 1. (60 seconds)
8. **Show the fraud flag.** Click the Fraud tab. 2 items with
   warning badges. Click one. Show the candidate count (14 entries
   that summed to the payout amount). "The system didn't try to
   match this combinatorially — it flagged it for investigation
   because the candidate set was abnormally large. That's a signal
   worth looking at." (30 seconds)
9. **Check the audit log.** Navigate to Audit Log. Filter by the
   transaction you just approved. Show the full lifecycle from
   ingestion to human approval. (30 seconds)
10. **Close with architecture.** "The deterministic core resolved 84%
   of transactions without any AI. The AI explained 14% with
   confidence scoring. 2% were fraud-flagged by a simple
   combinatorial safety cap. That's the thesis: boring deterministic
   logic first, safety valves in the middle, AI at the boundary,
   humans as the final gate." (30 seconds)

Total: ~5 minutes.

---

## 6. Scope boundaries

### 6.1 In scope for v1

- Source-agnostic normalisation layer (`FieldMapping` interface)
- Synthetic data seeder with 9 discrepancy patterns (incl. fraud flag)
  using real Stripe Balance Transaction JSON shapes
- Stripe API connector (balance transactions, test mode)
- Internal ledger as a record source
- CSV upload with column mapping
- Exact matcher (amount + currency + date)
- Tolerant matcher (timing ±1 day, fee ±$0.02, batch aggregation
  with >10 candidate fraud flagging)
- AI explainer via Claude API (structured output, confidence scoring,
  env-var configurable threshold)
- Graceful degradation: deterministic-only run when sidecar is down
- Human-in-the-loop review queue (approve / override / dismiss)
- Fraud review queue (distinct from AI review)
- Append-only audit log
- Dashboard with metrics, fraud count, and pattern chart
- Run management (create, view list, view detail)
- Transaction detail with side-by-side comparison and fee waterfall
- Settings page with platform config and demo tools
- Dark mode
- Deployment to Fly.io

### 6.2 Explicitly out of scope for v1

| Feature | Why it's out | Revisit when |
|---|---|---|
| Webhook ingestion | Reconciliation is batch, not real-time. API pull gives the same data without needing a publicly reachable server. | Product needs real-time alerting, not batch comparison. |
| Plaid / bank API connectors | Each bank integration is its own project. CSV covers the same need for v1. | Product has paying users who need automated bank feeds. |
| Multi-currency support | Smooov is CAD-only. Adding currency conversion multiplies test surface. | Product operates in multiple currencies. |
| User authentication / multi-tenancy | Portfolio demo is single-user. Adding auth adds nothing to the architecture story. | Product has multiple operators. |
| Scheduled / cron runs | v1 runs are manually triggered. Scheduled runs are a deployment concern, not an architecture concern. | Product needs daily automated reconciliation. |
| Email / Slack notifications | No notification infra needed for a demo. | Product has operators who need alerts on discrepancies. |
| Exportable reports (PDF/CSV) | The UI is the report for v1. | Operators need to share reconciliation results with finance teams. |
| JSON field mapper UI | Backend normalisation is source-agnostic via `FieldMapping`; the interactive UI for mapping arbitrary JSON fields is v1.1. Stripe/Ledger/CSV adapters prove the architecture. | v1.1 — first feature after v1 ships. |
| Mobile-responsive layout | Demo will be on a laptop. Responsive is nice-to-have, not a blocker. | If time permits before deployment. |

---

## 7. Technical constraints (from ADRs)

These are already decided and locked. Included here for completeness
so the PRD is self-contained.

- **ADR-0001:** Decisions are documented in `docs/decisions/`.
- **ADR-0002:** TypeScript core (Fastify) + Python sidecar (FastAPI).
- **ADR-0003:** PostgreSQL single instance. JSONB for raw payloads.
- **ADR-0004:** No vector store. Retrieval is SQL.
- **ADR-0005:** Deterministic core, AI at the boundary. The sidecar
  proposes; it never decides.

- **ADR-0006:** Graceful degradation — when the AI sidecar is
  unavailable, the run completes with deterministic results and
  marks the AI step as `skipped`. The deterministic core is
  load-bearing; the AI is additive.

Additional constraints from this PRD:
- Money is `BIGINT` minor units (cents). No floats anywhere.
- Every write has an idempotency key.
- The audit log is append-only. No `UPDATE` or `DELETE` on `audit.audit_log`.
- The AI sidecar has no database access. It receives HTTP, returns JSON.
- Matchers run in order: exact → tolerant → agent. Each only sees
  the prior stage's residue. Fraud-flagged items skip the agent.
- Ingestion normalisation is source-agnostic via `FieldMapping`.
  v1 ships hardcoded mappings; UI mapper is deferred to v1.1.
- AI confidence threshold is runtime-configurable via env var
  (`AI_CONFIDENCE_THRESHOLD`), not stored in the database.
- Batch aggregation candidate sets >10 are flagged for fraud review,
  not processed combinatorially.

---

## 8. Resolved decisions (formerly open questions)

All four open questions from the initial draft have been resolved:

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Batch aggregation candidate cap | **Max 10.** Candidate sets >10 are flagged as `flag_fraud` and routed to human review, bypassing the AI sidecar. | Legitimate batch payouts rarely map to >10 records. A high candidate count is itself an anomaly signal. Combinatorial cost grows factorially — `C(50,10)` = 10B combinations. |
| 2 | AI confidence threshold | **Env var** (`AI_CONFIDENCE_THRESHOLD=0.70`). Displayed as read-only in Settings UI. | Runtime config belongs in env, not in the database. Keeps the settings page informational without creating a config-in-two-places problem. |
| 3 | Seed data realism | **Real Stripe Balance Transaction JSON shapes.** Backend normalisation is source-agnostic via `FieldMapping` interface. UI-based JSON field mapper deferred to v1.1. | Real payloads test the normalisation layer with production-shaped data. Source-agnostic backend means adding PayPal/Square is config, not code — but the UI for that is scope creep for v1. |
| 4 | Run failure when sidecar is down | **Skip AI, complete with deterministic results** (ADR-0006). Run status = `done` with `ai_skipped: true`. All residue routed to human review. | The deterministic core is load-bearing; the AI is additive. "The system degrades gracefully" is a staff-level interview sentence. |
