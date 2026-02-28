import type {
  ClaudeMemConfig,
  WorkerHealth,
  ContextInjectionResponse,
  SessionInitPayload,
  ObservationPayload,
  SummarizePayload,
  SessionCompletePayload,
} from "./types.js";

type LogFn = (msg: string) => void;

export class ClaudeMemClient {
  private baseUrl: string;
  private timeout: number;
  private log: LogFn;

  constructor(port = 37777, timeout = 2000, log: LogFn = () => {}) {
    this.baseUrl = `http://localhost:${port}`;
    this.timeout = timeout;
    this.log = log;
  }

  /** Health check with up to 3 retries, 1s delay between attempts */
  async healthCheck(retries = 3): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);
        const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const payload = (await res.json()) as WorkerHealth;
          return payload.status === "ok";
        }
      } catch {
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
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

  private async safeGet<T>(path: string): Promise<T | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      const res = await fetch(`${this.baseUrl}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        return null;
      }

      return res.json() as Promise<T>;
    } catch (err) {
      this.log(`[claude-mem] GET ${path} failed: ${err}`);
      return null;
    }
  }

  private async safePost(path: string, body: unknown): Promise<void> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      this.log(`[claude-mem] POST ${path} failed: ${err}`);
    }
  }
}

export type { ClaudeMemConfig };