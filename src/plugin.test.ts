import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockInitSession = mock(async (_payload: unknown) => {});
const mockCompleteSession = mock(async (_payload: unknown) => {});
const mockSendObservation = mock(async (_payload: unknown) => {});
const mockSendSummary = mock(async (_payload: unknown) => {});
const mockGetContext = mock(async (_projectName: string) => ({ context: null, projectName: "" }));
const mockGetMemoryStatus = mock(async () => ({ connected: false, workerUrl: "http://localhost:37777" } as { connected: boolean; version?: string; workerUrl: string }));

let detectInstalled = false;
let detectWorkerRunning = false;
let detectPort = 37777;

// Mock ClaudeMemClient class
class MockClaudeMemClient {
  constructor(_port?: number, _timeout?: number, _log?: (msg: string, level?: "info" | "warn" | "error") => void) {}

  async initSession(payload: unknown): Promise<void> {
    await mockInitSession(payload);
  }

  async completeSession(payload: unknown): Promise<void> {
    await mockCompleteSession(payload);
  }

  async sendObservation(payload: unknown): Promise<void> {
    await mockSendObservation(payload);
  }

  async sendSummary(payload: unknown): Promise<void> {
    await mockSendSummary(payload);
  }

  async getContext(projectName: string): Promise<{ context: string | null; projectName: string }> {
    return mockGetContext(projectName);
  }

  async getMemoryStatus(): Promise<{ connected: boolean; version?: string; workerUrl: string }> {
    return mockGetMemoryStatus();
  }
}

// Mock detect function
async function mockDetect() {
  return {
    installed: detectInstalled,
    workerRunning: detectWorkerRunning,
    port: detectPort,
    dataDir: "/tmp/.claude-mem",
  };
}

// Mock getWorkerPort function
function mockGetPort() {
  return detectPort;
}

// Import the plugin factory
const { createPluginWithDependencies } = await import("./plugin.js");

type MockInput = {
  client: { app: { log: ReturnType<typeof mock> } };
  project: { path?: string };
  directory: string;
  worktree: string;
  serverUrl: URL;
  $: unknown;
};

function createMockInput(projectPath = "/test/project"): MockInput {
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

function createSessionEvent(type: "session.created" | "session.deleted") {
  return {
    event: {
      type,
      properties: {
        info: {
          id: "sess_test123",
          projectID: "proj_1",
          directory: "/test",
          title: "test",
          version: "1",
          time: { created: 0, updated: 0 },
        },
      },
    },
  };
}

describe("OpenCodeMem plugin", () => {
  beforeEach(() => {
    detectInstalled = false;
    detectWorkerRunning = false;
    detectPort = 37777;
    mockInitSession.mockClear();
    mockCompleteSession.mockClear();
    mockSendObservation.mockClear();
    mockSendSummary.mockClear();
    mockGetContext.mockClear();
    mockGetMemoryStatus.mockClear();
  });

  it("is a function", async () => {
    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    expect(typeof OpenCodeMem).toBe("function");
  });

  it("returns a Promise when called", async () => {
    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput();
    const result = OpenCodeMem(input as any);
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeDefined();
  });

  it("returns hooks object with all expected keys", async () => {
    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput();
    const hooks = await OpenCodeMem(input as any);

    expect("event" in hooks).toBe(true);
    expect("chat.message" in hooks).toBe(true);
    expect("tool.execute.after" in hooks).toBe(true);
    expect("experimental.chat.system.transform" in hooks).toBe(true);
    expect("experimental.session.compacting" in hooks).toBe(true);
    expect("command.execute.before" in hooks).toBe(true);
    expect("experimental.text.complete" in hooks).toBe(true);
    expect(typeof hooks.event).toBe("function");
  });


  it("event handler dispatches session.idle to summary", async () => {
    detectInstalled = true;
    detectWorkerRunning = true;

    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput();
    const hooks = await OpenCodeMem(input as any);

    await hooks.event!({ event: { type: "session.idle", properties: { sessionID: "sess_idle_123" } } as any });

    expect(mockSendSummary).toHaveBeenCalledTimes(1);
    expect(mockSendSummary).toHaveBeenCalledWith({
      contentSessionId: "sess_idle_123",
      last_assistant_message: undefined,
    });
  });

  it("calls initSession on session.created when worker is running", async () => {
    detectInstalled = true;
    detectWorkerRunning = true;

    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput();
    const hooks = await OpenCodeMem(input as any);

    await expect(hooks.event!(createSessionEvent("session.created") as any)).resolves.toBeUndefined();

    expect(mockInitSession).toHaveBeenCalledTimes(1);
    expect(mockInitSession).toHaveBeenCalledWith({
      contentSessionId: "sess_test123",
      project: "/test/project",
    });
  });

  it("calls completeSession on session.deleted when worker is running", async () => {
    detectInstalled = true;
    detectWorkerRunning = true;

    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput();
    const hooks = await OpenCodeMem(input as any);

    await expect(hooks.event!(createSessionEvent("session.deleted") as any)).resolves.toBeUndefined();

    expect(mockCompleteSession).toHaveBeenCalledTimes(1);
    expect(mockCompleteSession).toHaveBeenCalledWith({
      contentSessionId: "sess_test123",
    });
  });

  it("handles unknown event type without throwing", async () => {
    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput();
    const hooks = await OpenCodeMem(input as any);

    await expect(
      hooks.event!({ event: { type: "file.edited", properties: { file: "foo.ts" } } as any }),
    ).resolves.toBeUndefined();

    expect(mockInitSession).toHaveBeenCalledTimes(0);
    expect(mockCompleteSession).toHaveBeenCalledTimes(0);
  });

  it("does not call worker methods when worker is unavailable", async () => {
    detectInstalled = false;
    detectWorkerRunning = false;

    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput();
    const hooks = await OpenCodeMem(input as any);

    await expect(hooks.event!(createSessionEvent("session.created") as any)).resolves.toBeUndefined();
    await expect(hooks.event!(createSessionEvent("session.deleted") as any)).resolves.toBeUndefined();

    expect(mockInitSession).toHaveBeenCalledTimes(0);
    expect(mockCompleteSession).toHaveBeenCalledTimes(0);
  });

  it("falls back to directory when project.path is undefined", async () => {
    detectInstalled = true;
    detectWorkerRunning = true;

    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput(undefined);
    const hooks = await OpenCodeMem(input as any);

    await hooks.event!(createSessionEvent("session.created") as any);

    expect(mockInitSession).toHaveBeenCalledWith({
      contentSessionId: "sess_test123",
      project: "/test/project",
    });
  });

  it("swallows client.app.log errors", async () => {
    detectInstalled = true;
    detectWorkerRunning = true;

    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput();
    input.client.app.log = mock(() => {
      throw new Error("log failure");
    });

    await expect(OpenCodeMem(input as any)).resolves.toBeDefined();
  });

  it("completes init when client.app.log hangs (never resolves)", async () => {
    detectInstalled = true;
    detectWorkerRunning = true;

    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
    );
    const input = createMockInput();
    input.client.app.log = mock(() => new Promise(() => {})); // never resolves

    // Must complete within 5 seconds (not hang)
    const result = await Promise.race([
      OpenCodeMem(input as any),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Plugin init timed out")), 5000)),
    ]);

    expect(result).toBeDefined();
    expect(typeof (result as any).event).toBe("function");
  });

  it("calls autoSetup when worker not running", async () => {
    detectInstalled = false;
    detectWorkerRunning = false;

    let autoSetupCalled = false;
    const mockAutoSetup = async () => {
      autoSetupCalled = true;
      return {
        binary: { status: "success" as const, message: "" },
        install: { status: "skipped" as const, message: "" },
        mcp: { status: "success" as const, message: "" },
        skills: { status: "success" as const, message: "" },
        commands: { status: "success" as const, message: "" },
        worker: { status: "success" as const, message: "" },
      };
    };

    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
      mockAutoSetup,
    );
    const input = createMockInput();
    const hooks = await OpenCodeMem(input as any);

    // Wait a bit for the fire-and-forget promise to settle
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(autoSetupCalled).toBe(true);
  });

  it("calls autoSetup even when worker is running (idempotent)", async () => {
    detectInstalled = true;
    detectWorkerRunning = true;

    let autoSetupCalled = false;
    const mockAutoSetup = async () => {
      autoSetupCalled = true;
      return {
        binary: { status: "success" as const, message: "" },
        install: { status: "skipped" as const, message: "" },
        mcp: { status: "success" as const, message: "" },
        skills: { status: "success" as const, message: "" },
        commands: { status: "skipped" as const, message: "" },
        worker: { status: "skipped" as const, message: "" },
      };
    };

    const OpenCodeMem = createPluginWithDependencies(
      (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
      mockDetect,
      mockGetPort,
      mockAutoSetup,
    );
    const input = createMockInput();
    const hooks = await OpenCodeMem(input as any);

    // Wait a bit for the fire-and-forget promise to settle
    await new Promise((resolve) => setTimeout(resolve, 50));

    // autoSetup should be called (idempotent), but worker start is skipped
    expect(autoSetupCalled).toBe(true);
  });

  describe("system.transform memory status", () => {
    it("shows Active status when worker is connected", async () => {
      detectInstalled = true;
      detectWorkerRunning = true;

      mockGetMemoryStatus.mockImplementation(async () => ({
        connected: true,
        version: "1.0.0",
        workerUrl: "http://localhost:37777",
      }));

      const OpenCodeMem = createPluginWithDependencies(
        (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
        mockDetect,
        mockGetPort,
      );
      const input = createMockInput();
      const hooks = await OpenCodeMem(input as any);

      const systemTransform = hooks["experimental.chat.system.transform"] as any;
      const output = { system: [] as string[] };
      await systemTransform({}, output);

      expect(output.system.length).toBeGreaterThanOrEqual(1);
      expect(output.system[0]).toContain("Claude-Mem Status");
      expect(output.system[0]).toContain("Active");
      expect(output.system[0]).toContain("1.0.0");
    });

    it("shows Disconnected status when worker is down", async () => {
      detectInstalled = true;
      detectWorkerRunning = true;

      mockGetMemoryStatus.mockImplementation(async () => ({
        connected: false,
        workerUrl: "http://localhost:37777",
      }));

      const OpenCodeMem = createPluginWithDependencies(
        (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
        mockDetect,
        mockGetPort,
      );
      const input = createMockInput();
      const hooks = await OpenCodeMem(input as any);

      const systemTransform = hooks["experimental.chat.system.transform"] as any;
      const output = { system: [] as string[] };
      await systemTransform({}, output);

      expect(output.system.length).toBeGreaterThanOrEqual(1);
      expect(output.system[0]).toContain("Claude-Mem Status");
      expect(output.system[0]).toContain("Disconnected");
    });

    it("does not crash when getMemoryStatus throws", async () => {
      detectInstalled = true;
      detectWorkerRunning = true;

      mockGetMemoryStatus.mockImplementation(async () => {
        throw new Error("status fetch failed");
      });

      const OpenCodeMem = createPluginWithDependencies(
        (_port, _timeout, _log, _host) => new MockClaudeMemClient(),
        mockDetect,
        mockGetPort,
      );
      const input = createMockInput();
      const hooks = await OpenCodeMem(input as any);

      const systemTransform = hooks["experimental.chat.system.transform"] as any;
      const output = { system: [] as string[] };

      // Should not throw — status display is best-effort
      await expect(systemTransform({}, output)).resolves.toBeUndefined();
    });
  });
});
