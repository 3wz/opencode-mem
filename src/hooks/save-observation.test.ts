import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";
import { createSaveObservationHook } from "./save-observation.js";

let mockServer: ReturnType<typeof Bun.serve>;
const MOCK_PORT = 37900;
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

describe("createSaveObservationHook", () => {
  it("captures tool name, args, and output", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createSaveObservationHook(client, makeState(), "/test");

    await hook(
      { tool: "bash", sessionID: "sess_1", callID: "call_1", args: { command: "ls" } },
      { title: "bash", output: "file.ts\nother.ts", metadata: {} },
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as any;
    expect(body?.toolName).toBe("bash");
    expect(body?.claudeSessionId).toBe("sess_1");
    expect(body?.toolInput).toContain('"command":"ls"');
    expect(body?.toolResult).toBe("file.ts\nother.ts");
  });

  it("strips privacy tags from tool input", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createSaveObservationHook(client, makeState(), "/test");

    await hook(
      {
        tool: "bash",
        sessionID: "sess_1",
        callID: "call_1",
        args: { cmd: "echo <private>secret</private>" },
      },
      { title: "bash", output: "done", metadata: {} },
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as any;
    expect(body?.toolInput).not.toContain("<private>");
    expect(body?.toolInput).not.toContain("secret");
  });

  it("skips tools in skip list (TodoWrite)", async () => {
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createSaveObservationHook(client, makeState(), "/test");

    await hook(
      { tool: "TodoWrite", sessionID: "sess_1", callID: "call_1", args: {} },
      { title: "TodoWrite", output: "done", metadata: {} },
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(requestCount).toBe(0);
  });

  it("skips when sessionID is empty", async () => {
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createSaveObservationHook(client, makeState(), "/test");

    await hook(
      { tool: "bash", sessionID: "", callID: "call_1", args: {} },
      { title: "bash", output: "out", metadata: {} },
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(requestCount).toBe(0);
  });

  it("truncates output exceeding 100KB", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createSaveObservationHook(client, makeState(), "/test");
    const bigOutput = "x".repeat(200 * 1024);

    await hook(
      { tool: "bash", sessionID: "sess_1", callID: "call_1", args: {} },
      { title: "bash", output: bigOutput, metadata: {} },
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as any;
    expect(body?.toolResult?.length).toBeLessThan(110 * 1024);
    expect(body?.toolResult).toContain("[truncated]");
  });

  it("passes cwd in payload", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createSaveObservationHook(client, makeState(), "/my/project");

    await hook(
      { tool: "bash", sessionID: "sess_1", callID: "call_1", args: {} },
      { title: "bash", output: "out", metadata: {} },
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as any;
    expect(body?.cwd).toBe("/my/project");
  });

  it("does not throw when worker is unavailable", async () => {
    const client = new ClaudeMemClient(39997, 200);
    const hook = createSaveObservationHook(client, makeState(), "/test");

    await expect(
      hook(
        { tool: "bash", sessionID: "sess_1", callID: "call_1", args: {} },
        { title: "bash", output: "out", metadata: {} },
      ),
    ).resolves.toBeUndefined();
  });
});
