// Config from environment only. No secrets in source (ADR-0001). Validated once.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  databaseUrl: required("DATABASE_URL"),
  agentBaseUrl: process.env.AGENT_BASE_URL ?? "http://localhost:8000",
  stripeApiKey: process.env.STRIPE_API_KEY,
  port: Number(process.env.PORT ?? 3000),
  // Runtime config lives in env, not the DB (PRD §8, decision 2). The Settings
  // page shows this read-only. Below this confidence, an AI item needs a human.
  aiConfidenceThreshold: Number(process.env.AI_CONFIDENCE_THRESHOLD ?? 0.7),
  // Which sources form each side of the comparison. Stripe vs the internal ledger
  // by default; payout records ride the ledger side for batch aggregation.
  leftSources: (process.env.LEFT_SOURCES ?? "stripe").split(","),
  rightSources: (process.env.RIGHT_SOURCES ?? "ledger,payout").split(","),
} as const;
