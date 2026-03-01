export interface ClaudeMemConfig {
  port: number;
  dataDir: string;
  host?: string;
  model?: string;
  logLevel?: string;
}

export interface WorkerHealth {
  status: "ok" | "error";
  version?: string;
}

export interface ContextInjectionResponse {
  context: string | null;
  projectName: string;
}

export interface SessionInitPayload {
  contentSessionId: string;
  project: string;
  prompt?: string;
}

export interface ObservationPayload {
  contentSessionId: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: string;
  cwd?: string;
  last_user_message?: string;
  last_assistant_message?: string;
  prompt_number?: number;
}

export interface SummarizePayload {
  contentSessionId: string;
  last_assistant_message?: string;
}

export interface SessionCompletePayload {
  contentSessionId: string;
}

export interface PluginState {

  isWorkerRunning: boolean;
  projectName: string;
  sessionId: string;
  promptNumber: number;
  lastUserMessage: string;
  lastAssistantMessage: string;
  summarySent: boolean;
}

export interface OpenCodeMemOptions {
  port?: number;
  autoStart?: boolean;
  timeout?: number;
}

export interface MemoryStatus {
  connected: boolean;
  version?: string;
  workerUrl: string;
}
