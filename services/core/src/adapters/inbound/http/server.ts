// HTTP server wiring (Fastify). Kept thin; real composition is in container.ts.
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "../../../infrastructure/config.js";

export function buildServer() {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: config.corsOrigin });
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}
