import type {
  ClaudeMemConfig,
  MemoryStatus,
  WorkerHealth,
  ContextInjectionResponse,
  SessionInitPayload,
  ObservationPayload,
  SummarizePayload,
  SessionCompletePayload,
} from "./types.js";

type LogFn = (msg: string) => void;

const DEFAULT_TIMEOUT_MS = 2000;
const STATUS_TIMEOUT_MS = 500;

function normalizeHost(host: string | undefined): string {
  const value = (host ?? "localhost").trim();
  const withoutProtocol = value.replace(/^https?:\/\//, "");
  return withoutProtocol.replace(/\/+$/, "") || "localhost";
}

export class ClaudeMemClient {
  private baseUrl: string;
  private timeout: number;
  private log: LogFn;

  constructor(port = 37777, timeout = DEFAULT_TIMEOUT_MS, log: LogFn = () => {}, host?: string) {
    const resolvedHost = normalizeHost(host ?? process.env.CLAUDE_MEM_WORKER_HOST);
    this.baseUrl = `http://${resolvedHost}:${port}`;
    this.timeout = timeout;
    this.log = log;
  }

  /** Health check with up to 3 retries, 1s delay between attempts */
  async healthCheck(retries = 3): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
        if (res.ok) {
          const payload = (await res.json()) as WorkerHealth;
          return payload.status === "ok";
        }
      } catch {
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } finally {
        clearTimeout(timer);
      }
    }

    return false;
  }

  /** Fetch context for a project. Returns null if unavailable. */
  async getContext(projectName: string): Promise<ContextInjectionResponse | null> {
    return this.safeGet<ContextInjectionResponse>(
      `/api/context/inject?project=${encodeURIComponent(projectName)}`,
    );
  }

  /** Initialize a session. Fire-and-forget. */
  async initSession(payload: SessionInitPayload): Promise<void> {
    await this.safePost("/api/sessions/init", payload);
  }

  /** Send an observation. Fire-and-forget. */
  async sendObservation(payload: ObservationPayload): Promise<void> {
    await this.safePost("/api/sessions/observations", payload);
  }

  /** Send a summary request. Fire-and-forget. */
  async sendSummary(payload: SummarizePayload): Promise<void> {
    await this.safePost("/api/sessions/summarize", payload);
  }

  /** Mark session complete. Fire-and-forget. */
  async completeSession(payload: SessionCompletePayload): Promise<void> {
    await this.safePost("/api/sessions/complete", payload);
  }

  /** Get memory system status (health check + version). Never throws. */
  async getMemoryStatus(): Promise<MemoryStatus> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      if (res.ok) {
        const payload = (await res.json()) as WorkerHealth;
        if (payload.status === "ok") {
          return { connected: true, version: payload.version, workerUrl: this.baseUrl };
        }
      }
      return { connected: false, workerUrl: this.baseUrl };
    } catch {
      return { connected: false, workerUrl: this.baseUrl };
    } finally {
      clearTimeout(timer);
    }
  }

  private async safeGet<T>(path: string): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { signal: controller.signal });
      if (!res.ok) {
        return null;
      }

      return res.json() as Promise<T>;
    } catch (err) {
      this.log(`[claude-mem] GET ${path} failed: ${err}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async safePost(path: string, body: unknown): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      this.log(`[claude-mem] POST ${path} failed: ${err}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

export type { ClaudeMemConfig };
