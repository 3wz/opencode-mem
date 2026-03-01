// Settings from ~/.claude-mem/settings.json
export interface ClaudeMemConfig {
  port: number;
  dataDir: string;
  model?: string;
  logLevel?: string;
}

// Response from GET /health
export interface WorkerHealth {
  status: "ok" | "error";
  version?: string;
}

// Response from GET /api/context/inject?project=X
export interface ContextInjectionResponse {
  context: string | null;
  projectName: string;
}

// POST body for POST /api/sessions/init
export interface SessionInitPayload {
  contentSessionId: string;
  project: string;
  prompt?: string;
}

// POST body for POST /api/sessions/observations
export interface ObservationPayload {
  contentSessionId: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: string;
  cwd?: string;
}

// POST body for POST /api/sessions/summarize
export interface SummarizePayload {
  contentSessionId: string;
  last_assistant_message?: string;
}

// POST body for POST /api/sessions/complete
export interface SessionCompletePayload {
  contentSessionId: string;
}

// Internal plugin state
export interface PluginState {
  sessionDbId?: number;
  isWorkerRunning: boolean;
  projectName: string;
  sessionId: string;
}

// Plugin initialization options
export interface OpenCodeMemOptions {
  port?: number;
  autoStart?: boolean;
  timeout?: number;
}

// Memory status for system prompt display
export interface MemoryStatus {
  connected: boolean;
  version?: string;
  workerUrl: string;
}
