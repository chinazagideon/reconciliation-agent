// Single shared pg Pool. One instance per process (ADR-0003).
import { Pool } from "pg";
import { config } from "../../../infrastructure/config.js";

export const pool = new Pool({ connectionString: config.databaseUrl });
