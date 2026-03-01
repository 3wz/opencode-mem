import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createTextCompleteHook } from "./text-complete.js";
import { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";
import type { Server } from "bun";

let mockServer: Server<undefined>;
const MOCK_PORT = 37905;
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
  promptNumber: 0,
  lastUserMessage: "",
  lastAssistantMessage: "",
  summarySent: false,
});

describe("createTextCompleteHook", () => {
  it("captures assistant text as observation", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createTextCompleteHook(client, makeState());

    await hook(
      { sessionID: "sess_1", messageID: "msg_1", partID: "part_1" },
      { text: "This is the assistant response" },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as {
      tool_name?: string;
      tool_input?: { messageID: string; partID: string };
      tool_response?: string;
    } | null;
    expect(body?.tool_name).toBe("assistant_response");
    expect(body?.tool_response).toContain("This is the assistant response");
    expect(body?.tool_input).toEqual({ messageID: "msg_1", partID: "part_1" });
  });

  it("updates state.lastAssistantMessage", async () => {
    const state = makeState();
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createTextCompleteHook(client, state);

    await hook(
      { sessionID: "sess_1", messageID: "msg_1", partID: "part_1" },
      { text: "Assistant final reply" },
    );

    expect(state.lastAssistantMessage).toContain("Assistant final reply");
  });

  it("does NOT mutate output.text", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createTextCompleteHook(client, makeState());

    const output = { text: "Original text" };
    const originalText = output.text;

    await hook(
      { sessionID: "sess_1", messageID: "msg_1", partID: "part_1" },
      output,
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(output.text).toBe(originalText);
  });

  it("skips when sessionID is empty", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createTextCompleteHook(client, makeState());

    await hook(
      { sessionID: "", messageID: "msg_1", partID: "part_1" },
      { text: "Some text" },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBe(0);
  });

  it("skips when text is empty or whitespace", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createTextCompleteHook(client, makeState());

    await hook(
      { sessionID: "sess_1", messageID: "msg_1", partID: "part_1" },
      { text: "   " },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBe(0);
  });

  it("truncates very long text", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createTextCompleteHook(client, makeState());

    const longText = "x".repeat(200 * 1024); // 200KB

    await hook(
      { sessionID: "sess_1", messageID: "msg_1", partID: "part_1" },
      { text: longText },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { tool_response?: string } | null;
    const result = body?.tool_response ?? "";
    expect(result.length).toBeLessThanOrEqual(100 * 1024 + "\n[truncated]".length);
  });

  it("strips privacy tags from text", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createTextCompleteHook(client, makeState());

    await hook(
      { sessionID: "sess_1", messageID: "msg_1", partID: "part_1" },
      { text: "Hello <private>secret</private> world" },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { tool_response?: string } | null;
    expect(body?.tool_response).not.toContain("<private>");
    expect(body?.tool_response).toContain("Hello");
    expect(body?.tool_response).toContain("world");
  });
});
