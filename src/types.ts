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

// POST body for POST /sessions/{id}/init
export interface SessionInitPayload {
  claudeSessionId: string;
  projectName: string;
  initialPrompt?: string;
}

// POST body for POST /api/sessions/observations
export interface ObservationPayload {
  claudeSessionId: string;
  toolName: string;
  toolInput: string;
  toolResult: string;
  cwd?: string;
}

// POST body for POST /api/sessions/summarize
export interface SummarizePayload {
  claudeSessionId: string;
  projectName: string;
}

// POST body for POST /api/sessions/complete
export interface SessionCompletePayload {
  claudeSessionId: string;
  projectName: string;
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
