// HTTP server wiring (Fastify). Kept thin; real composition is in container.ts.
import Fastify from "fastify";

export function buildServer() {
  const app = Fastify({ logger: true });
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}
