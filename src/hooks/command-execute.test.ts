import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createCommandExecuteHook } from "./command-execute.js";
import { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";
import type { Server } from "bun";

let mockServer: Server<undefined>;
const MOCK_PORT = 37904;
let receivedBody: unknown = null;
let requestCount = 0;

beforeAll(() => {
  mockServer = Bun.serve({
    port: MOCK_PORT,
    async fetch(req) {
      receivedBody = await req.json().catch(() => null);
      requestCount++;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });
});

afterAll(() => mockServer.stop());

const makeState = (): PluginState => ({
  isWorkerRunning: true,
  projectName: "test-project",
  sessionId: "sess_test",
});

describe("createCommandExecuteHook", () => {
  it("captures command as observation", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCommandExecuteHook(client, makeState());

    await hook(
      { command: "test-cmd", sessionID: "sess_1", arguments: { foo: "bar" } },
      { parts: [] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { tool_name?: string } | null;
    expect(body?.tool_name).toBe("command:test-cmd");

  });

  it("skips when sessionID is empty", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCommandExecuteHook(client, makeState());

    await hook(
      { command: "test-cmd", sessionID: "", arguments: {} },
      { parts: [] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBe(0);
    expect(receivedBody).toBeNull();
  });

  it("skips when command is empty", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCommandExecuteHook(client, makeState());

    await hook(
      { command: "", sessionID: "sess_1", arguments: {} },
      { parts: [] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBe(0);
    expect(receivedBody).toBeNull();
  });

  it("strips privacy tags from arguments", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCommandExecuteHook(client, makeState());

    await hook(
      {
        command: "test-cmd",
        sessionID: "sess_1",
        arguments: { secret: "<private>hidden</private>", public: "visible" },
      },
      { parts: [] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { tool_input?: Record<string, unknown> } | null;
    expect(body?.tool_input).toBeDefined();
    expect(typeof body?.tool_input).toBe('object');
    expect(body?.tool_input?.public).toBe('visible');
    expect(JSON.stringify(body?.tool_input)).not.toContain("<private>");

  });
});
