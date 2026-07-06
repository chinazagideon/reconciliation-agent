// pg-boss: job queue backed by the SAME Postgres (no Redis — ADR scope).
// Heavy/slow work (Stripe pagination, agent calls) runs here, off the request path.
// TODO: init pg-boss with config.databaseUrl; register a 'reconcile' worker.
export {};
