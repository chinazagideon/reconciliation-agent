// Config from environment only. No secrets in source (ADR-0001). Validated once.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  databaseUrl: required("DATABASE_URL"),
  agentBaseUrl: process.env.AGENT_BASE_URL ?? "http://localhost:8000",
  port: Number(process.env.PORT ?? 3000),
} as const;
