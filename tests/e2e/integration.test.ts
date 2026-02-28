import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { OpenCodeMem } from "../../src/index.js";
import { ClaudeMemClient } from "../../src/client.js";
import { createPluginWithDependencies } from "../../src/plugin.js";
import { createCapturePromptHook } from "../../src/hooks/capture-prompt.js";
import { createSaveObservationHook } from "../../src/hooks/save-observation.js";
import { createSummaryHandler } from "../../src/hooks/summary.js";
import { createContextInjectionHook } from "../../src/hooks/context-inject.js";
import { createCompactionHook } from "../../src/hooks/compaction.js";
import { generateInstallInstructions, generateMcpConfig } from "../../src/mcp-config.js";
import type { PluginState } from "../../src/types.js";

type RecordedRequest = {
  method: string;
  path: string;
  body: unknown;
};

type HookSet = {
  event: (input: { event: any }) => Promise<void>;
  chat: {
    message: (input: { sessionID: string }, output: { message: any; parts: unknown[] }) => Promise<void>;
  };
  tool: {
    execute: {
      after: (input: { tool: string; sessionID: string; callID: string; args: any }, output: { title: string; output: string; metadata: any }) => Promise<void>;
    };
  };
  experimental: {
    chat: {
      system: {
        transform: (input: { sessionID?: string }, output: { system: string[] }) => Promise<void>;
      };
    };
    session: {
      compacting: (input: { sessionID: string }, output: { context: string[]; prompt?: string }) => Promise<void>;
    };
  };
};

const MOCK_PORT = 37910;
const NO_SERVER_PORT = 39999;

let mockServer: ReturnType<typeof Bun.serve>;
let recordedRequests: RecordedRequest[] = [];
let mockContextResponse: unknown = { context: "past memory", projectName: "test" };
let mockContextStatus = 200;

function waitForFireAndForget(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetServerCapture(): void {
  recordedRequests = [];
  mockContextResponse = { context: "past memory", projectName: "test" };
  mockContextStatus = 200;
}

function createMockInput(projectPath = "/test/project") {
  return {
    client: {
      app: {
        log: mock(() => ({ data: null, error: null, response: new Response() })),
      },
    },
    project: { path: projectPath },
    directory: "/test/project",
    worktree: "/test/project",
    serverUrl: new URL("http://localhost:3000"),
    $: {},
  };
}

async function createIntegratedHooks(port: number, workerRunning: boolean): Promise<HookSet> {
  const memClient = new ClaudeMemClient(port, 250);
  const state: PluginState = {
    isWorkerRunning: workerRunning,
    projectName: "test-project",
    sessionId: "",
  };

  // Mock autoSetup to avoid making real requests during tests
  const mockAutoSetup = async () => ({
    binary: { status: "success" as const, message: "" },
    install: { status: "skipped" as const, message: "" },
    mcp: { status: "skipped" as const, message: "" },
    skills: { status: "skipped" as const, message: "" },
    worker: { status: workerRunning ? ("skipped" as const) : ("success" as const), message: "" },
  });

  const plugin = createPluginWithDependencies(
    () => memClient,
    async () => ({
      installed: workerRunning,
      workerRunning,
      port,
      dataDir: "/tmp/.claude-mem",
    }),
    () => port,
    mockAutoSetup,
  );

  const baseHooks = await plugin(createMockInput() as any);
  const capturePrompt = createCapturePromptHook(memClient, state);
  const saveObservation = createSaveObservationHook(memClient, state, "/test/project");
  const sendSummary = createSummaryHandler(memClient, state);
  const injectContext = createContextInjectionHook(memClient, state.projectName, port);
  const injectCompactionContext = createCompactionHook(memClient, state.projectName);

  return {
    event: async (input) => {
      if (input.event.type === "session.created") {
        state.sessionId = input.event.properties?.info?.id ?? "";
      }
      await baseHooks.event?.(input as any);
      await sendSummary(input);
    },
    chat: {
      message: capturePrompt,
    },
    tool: {
      execute: {
        after: saveObservation,
      },
    },
    experimental: {
      chat: {
        system: {
          transform: injectContext,
        },
      },
      session: {
        compacting: injectCompactionContext,
      },
    },
  };
}

beforeAll(() => {
  mockServer = Bun.serve({
    port: MOCK_PORT,
    async fetch(req) {
      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname === "/api/context/inject") {
        return new Response(JSON.stringify(mockContextResponse), {
          status: mockContextStatus,
          headers: { "Content-Type": "application/json" },
        });
      }

      const body = await req.json().catch(() => null);
      recordedRequests.push({ method: req.method, path: url.pathname, body });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
});

afterAll(() => {
  mockServer.stop();
});

describe("E2E integration", () => {
  it("loads plugin without errors and exposes lifecycle-capable hooks", async () => {
    const pluginHooks = await OpenCodeMem(createMockInput() as any);
    expect(pluginHooks).toBeDefined();
    expect(typeof pluginHooks.event).toBe("function");

    const integratedHooks = await createIntegratedHooks(MOCK_PORT, true);
    expect(typeof integratedHooks.event).toBe("function");
    expect(typeof integratedHooks.chat.message).toBe("function");
    expect(typeof integratedHooks.tool.execute.after).toBe("function");
    expect(typeof integratedHooks.experimental.chat.system.transform).toBe("function");
    expect(typeof integratedHooks.experimental.session.compacting).toBe("function");
  });

  it("runs full lifecycle: init, prompt, tool, idle summary, cleanup", async () => {
    resetServerCapture();
    const hooks = await createIntegratedHooks(MOCK_PORT, true);

    await hooks.event({
      event: {
        type: "session.created",
        properties: { info: { id: "sess_e2e" } },
      },
    });

    await hooks.chat.message(
      { sessionID: "sess_e2e" },
      { message: { content: "hello from e2e" }, parts: [] },
    );

    await hooks.tool.execute.after(
      {
        tool: "bash",
        sessionID: "sess_e2e",
        callID: "call_1",
        args: { command: "ls" },
      },
      { title: "bash", output: "done", metadata: {} },
    );

    await hooks.event({
      event: { type: "session.idle", properties: { sessionID: "sess_e2e" } },
    });

    await hooks.event({
      event: {
        type: "session.deleted",
        properties: { info: { id: "sess_e2e" } },
      },
    });

    await waitForFireAndForget();

    expect(recordedRequests.some((req) => req.path === "/api/sessions/init")).toBe(true);
    expect(recordedRequests.some((req) => req.path === "/api/sessions/observations")).toBe(true);
    expect(recordedRequests.some((req) => req.path === "/api/sessions/summarize")).toBe(true);
    expect(recordedRequests.some((req) => req.path === "/api/sessions/complete")).toBe(true);
  });

  it("injects context into experimental chat system transform", async () => {
    resetServerCapture();
    mockContextResponse = { context: "past memory", projectName: "test" };

    const hooks = await createIntegratedHooks(MOCK_PORT, true);
    const output = { system: ["base system"] };

    await hooks.experimental.chat.system.transform({ sessionID: "sess_ctx" }, output);

    expect(output.system.length).toBe(2);
    expect(output.system[1]).toContain("past memory");
  });

  it("injects memory into compaction context", async () => {
    resetServerCapture();
    mockContextResponse = { context: "memory for compaction", projectName: "test" };

    const hooks = await createIntegratedHooks(MOCK_PORT, true);
    const output = { context: [] as string[] };

    await hooks.experimental.session.compacting({ sessionID: "sess_compact" }, output);

    expect(output.context.length).toBe(1);
    expect(output.context[0]).toContain("memory for compaction");
  });

  it("returns valid MCP config and install instructions", () => {
    const config = generateMcpConfig(37777);
    expect(config["claude-mem"].type).toBe("remote");
    expect(config["claude-mem"].url).toBe("http://localhost:37777/mcp");

    const instructions = generateInstallInstructions();
    expect(typeof instructions).toBe("string");
    expect(instructions).toContain("opencode.json");
  });

  it("gracefully degrades when worker is unavailable", async () => {
    const hooks = await createIntegratedHooks(NO_SERVER_PORT, true);

    await expect(
      hooks.event({
        event: {
          type: "session.created",
          properties: { info: { id: "sess_down" } },
        },
      }),
    ).resolves.toBeUndefined();

    await expect(
      hooks.chat.message(
        { sessionID: "sess_down" },
        { message: { content: "still works" }, parts: [] },
      ),
    ).resolves.toBeUndefined();

    await expect(
      hooks.tool.execute.after(
        {
          tool: "bash",
          sessionID: "sess_down",
          callID: "call_1",
          args: { command: "pwd" },
        },
        { title: "bash", output: "ok", metadata: {} },
      ),
    ).resolves.toBeUndefined();

    await expect(
      hooks.event({ event: { type: "session.idle", properties: { sessionID: "sess_down" } } }),
    ).resolves.toBeUndefined();

    await expect(
      hooks.event({
        event: {
          type: "session.deleted",
          properties: { info: { id: "sess_down" } },
        },
      }),
    ).resolves.toBeUndefined();

    expect(typeof hooks.event).toBe("function");
    expect(typeof hooks.chat.message).toBe("function");
    expect(typeof hooks.tool.execute.after).toBe("function");
  });

  it("strips privacy and context tags before sending lifecycle payloads", async () => {
    resetServerCapture();
    const hooks = await createIntegratedHooks(MOCK_PORT, true);

    await hooks.tool.execute.after(
      {
        tool: "bash",
        sessionID: "sess_private",
        callID: "call_private",
        args: { command: "echo <private>secret data</private>" },
      },
      {
        title: "bash",
        output: "ok <private>secret data</private>",
        metadata: {},
      },
    );

    await hooks.chat.message(
      { sessionID: "sess_private" },
      {
        message: {
          content: "hello <claude-mem-context>context</claude-mem-context> world",
        },
        parts: [],
      },
    );

    await waitForFireAndForget();

    const observationRequest = recordedRequests.find(
      (req) => req.path === "/api/sessions/observations",
    );
    const initRequest = recordedRequests
      .filter((req) => req.path === "/api/sessions/init")
      .at(-1);

    expect(observationRequest).toBeDefined();
    const observationBody = observationRequest?.body as {
      tool_input?: Record<string, unknown>;
      tool_response?: string;
    };
    expect(JSON.stringify(observationBody.tool_input)).not.toContain("<private>");
    expect(JSON.stringify(observationBody.tool_input)).not.toContain("secret data");
    expect(observationBody.tool_response).not.toContain("<private>");
    expect(observationBody.tool_response).not.toContain("secret data");

    expect(initRequest).toBeDefined();
    const initBody = initRequest?.body as { prompt?: string };
    expect(initBody.prompt).not.toContain("<claude-mem-context>");
    expect(initBody.prompt).not.toContain("context");
    expect(initBody.prompt).toContain("hello");
    expect(initBody.prompt).toContain("world");
  });
});
