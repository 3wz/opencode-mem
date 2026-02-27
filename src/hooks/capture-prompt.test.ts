import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createCapturePromptHook } from "./capture-prompt.js";
import { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";
import type { Server } from "bun";

let mockServer: Server<undefined>;
const MOCK_PORT = 37901;
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

describe("createCapturePromptHook", () => {
  it("captures user message (string content)", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      { message: { content: "hello world" }, parts: [] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { initialPrompt?: string } | null;
    expect(body?.initialPrompt).toContain("hello world");
  });

  it("strips privacy tags from prompt", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      { message: { content: "hello <private>secret</private> world" }, parts: [] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    const body = receivedBody as { initialPrompt?: string } | null;
    expect(body?.initialPrompt).not.toContain("<private>");
    expect(body?.initialPrompt).toContain("hello");
  });

  it("skips fully private prompts (empty after stripping)", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      { message: { content: "<private>all secret</private>" }, parts: [] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBe(0);
    expect(receivedBody).toBeNull();
  });

  it("skips when sessionID is empty", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook({ sessionID: "" }, { message: { content: "hello" }, parts: [] });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBe(0);
    expect(receivedBody).toBeNull();
  });

  it("handles array content parts", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      {
        message: { content: [{ type: "text", text: "array content" }] },
        parts: [],
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { initialPrompt?: string } | null;
    expect(body?.initialPrompt).toContain("array content");
  });

  it("falls back to message.text when content is missing", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      { message: { text: "fallback text" }, parts: [] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { initialPrompt?: string } | null;
    expect(body?.initialPrompt).toContain("fallback text");
  });
});
