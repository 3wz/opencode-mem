import { describe, it, expect } from "bun:test";
import type {
  ClaudeMemConfig,
  WorkerHealth,
  ContextInjectionResponse,
  SessionInitPayload,
  ObservationPayload,
  SummarizePayload,
  SessionCompletePayload,
  PluginState,
  OpenCodeMemOptions,
} from "./types.js";

describe("types", () => {
  it("ClaudeMemConfig has required fields", () => {
    const config: ClaudeMemConfig = { port: 37777, dataDir: "~/.claude-mem" };
    expect(config.port).toBe(37777);
  });

  it("WorkerHealth has status field", () => {
    const health: WorkerHealth = { status: "ok" };
    expect(health.status).toBe("ok");
  });

  it("PluginState has required fields", () => {
    const state: PluginState = {
      isWorkerRunning: false,
      projectName: "test",
      sessionId: "sess_123",
      promptNumber: 0,
      lastUserMessage: "",
      lastAssistantMessage: "",
    };
    expect(state.isWorkerRunning).toBe(false);
  });
});
