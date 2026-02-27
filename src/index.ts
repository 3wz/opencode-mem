export { OpenCodeMem, default } from "./plugin.js";
export { ClaudeMemClient } from "./client.js";
export type { PluginState } from "./plugin.js";
export { autoSetup } from "./setup/auto-setup.js";
export type {
  ClaudeMemConfig,
  WorkerHealth,
  ContextInjectionResponse,
  SessionInitPayload,
  ObservationPayload,
  SummarizePayload,
  SessionCompletePayload,
  OpenCodeMemOptions,
} from "./types.js";
export type { SetupDeps, SetupResult, SetupStepResult } from "./setup/types.js";
export { generateMcpConfig, generateInstallInstructions } from "./mcp-config.js";
export type { McpConfig, OpenCodeMcpConfig } from "./mcp-config.js";
