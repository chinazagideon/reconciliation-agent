// DRY external-communication layer. ONE place that owns the mechanics of talking
// to anything over HTTP: base-URL resolution, timeouts, bounded retries with
// backoff, JSON (de)serialisation, and uniform Result-typed error mapping.
//
// Every outbound adapter that speaks raw HTTP (the agent sidecar client, and any
// future REST source) goes through here instead of hand-rolling `fetch`. That
// gives us one seam to mock in tests and one place to add logging / rate-limit
// handling. The Stripe adapter uses the official SDK (which has its own transport)
// but still surfaces failures as the same `Result` shape for a consistent core.
import { type Result, ok, err } from "../../domain/shared/result.js";

export interface HttpRequest {
  readonly path: string;                     // joined onto baseUrl
  readonly method?: "GET" | "POST" | "PUT" | "DELETE";
  readonly body?: unknown;                   // JSON-serialised if present
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;               // per-attempt deadline
}

export interface HttpServiceOptions {
  readonly baseUrl: string;
  readonly defaultTimeoutMs?: number;
  readonly retries?: number;                 // extra attempts on transient failure
  readonly defaultHeaders?: Record<string, string>;
}

/** A transport failure or a non-2xx response, carried as the Result error. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,                // HTTP status if we got a response
    readonly body?: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const isRetryable = (status?: number): boolean =>
  status === undefined || status === 408 || status === 429 || status >= 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpService {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(opts: HttpServiceOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = opts.defaultTimeoutMs ?? 10_000;
    this.retries = opts.retries ?? 2;
    this.defaultHeaders = opts.defaultHeaders ?? {};
  }

  /** Perform a request, decoding a JSON body of type T. Never throws. */
  async request<T>(req: HttpRequest): Promise<Result<T, HttpError>> {
    const url = `${this.baseUrl}/${req.path.replace(/^\/+/, "")}`;
    const method = req.method ?? "GET";
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(req.body !== undefined ? { "content-type": "application/json" } : {}),
      ...req.headers,
    };
    const payload = req.body !== undefined ? JSON.stringify(req.body) : undefined;

    let lastError: HttpError = new HttpError("request never attempted");
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? this.timeoutMs);
      try {
        const init: RequestInit = { method, headers, signal: controller.signal };
        if (payload !== undefined) init.body = payload;
        const res = await fetch(url, init);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          lastError = new HttpError(`${method} ${url} -> ${res.status}`, res.status, text);
          if (isRetryable(res.status) && attempt < this.retries) {
            await sleep(2 ** attempt * 200);   // 200ms, 400ms, 800ms...
            continue;
          }
          return err(lastError);
        }
        // 2xx: decode JSON (empty body -> undefined as T).
        const text = await res.text();
        const value = (text ? JSON.parse(text) : undefined) as T;
        return ok(value);
      } catch (e) {
        // Network error / abort / JSON parse failure. Retry the transient ones.
        lastError = new HttpError(e instanceof Error ? e.message : String(e));
        if (attempt < this.retries) {
          await sleep(2 ** attempt * 200);
          continue;
        }
        return err(lastError);
      } finally {
        clearTimeout(timer);
      }
    }
    return err(lastError);
  }
}
