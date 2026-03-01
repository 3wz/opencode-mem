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
  promptNumber: 0,
  lastUserMessage: "",
  lastAssistantMessage: "",
  summarySent: false,
});

describe("createCapturePromptHook", () => {
  it("captures user message from parts array", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      { message: {}, parts: [{ type: "text", text: "hello world" }] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { prompt?: string } | null;
    expect(body?.prompt).toContain("hello world");
  });

  it("updates state.lastUserMessage and increments prompt number", async () => {
    requestCount = 0;
    const state = makeState();
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, state);

    await hook(
      { sessionID: "sess_1" },
      { message: {}, parts: [{ type: "text", text: "first prompt" }] },
    );

    await hook(
      { sessionID: "sess_1" },
      { message: {}, parts: [{ type: "text", text: "second prompt" }] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(state.lastUserMessage).toBe("second prompt");
    expect(state.promptNumber).toBe(2);
  });

  it("strips privacy tags from prompt", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      { message: {}, parts: [{ type: "text", text: "hello <private>secret</private> world" }] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    const body = receivedBody as { prompt?: string } | null;
    expect(body?.prompt).not.toContain("<private>");
    expect(body?.prompt).toContain("hello");
  });

  it("skips fully private prompts (empty after stripping)", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      { message: {}, parts: [{ type: "text", text: "<private>all secret</private>" }] },
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

    await hook({ sessionID: "" }, { message: {}, parts: [{ type: "text", text: "hello" }] });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBe(0);
    expect(receivedBody).toBeNull();
  });

  it("handles multiple text parts joined by newline", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      {
        message: {},
        parts: [
          { type: "text", text: "first part" },
          { type: "text", text: "second part" },
        ],
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { prompt?: string } | null;
    expect(body?.prompt).toContain("first part");
    expect(body?.prompt).toContain("second part");
  });

  it("includes synthetic parts (no longer filtered)", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      {
        message: {},
        parts: [
          { type: "text", text: "real message", synthetic: false },
          { type: "text", text: "synthetic message", synthetic: true },
        ],
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { prompt?: string } | null;
    expect(body?.prompt).toContain("real message");
    expect(body?.prompt).toContain("synthetic message");
  });

  it("includes ignored parts (no longer filtered)", async () => {
    receivedBody = null;
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, makeState());

    await hook(
      { sessionID: "sess_1" },
      {
        message: {},
        parts: [
          { type: "text", text: "important", ignored: false },
          { type: "text", text: "ignored text", ignored: true },
        ],
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requestCount).toBeGreaterThan(0);
    const body = receivedBody as { prompt?: string } | null;
    expect(body?.prompt).toContain("important");
    expect(body?.prompt).toContain("ignored text");
  });

  it("calls initSession only on first message (promptNumber === 1)", async () => {
    receivedBody = null;
    requestCount = 0;
    const state = makeState();
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCapturePromptHook(client, state);

    // First message
    await hook(
      { sessionID: "sess_1" },
      { message: {}, parts: [{ type: "text", text: "first prompt" }] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    const firstRequestCount = requestCount;

    // Second message
    receivedBody = null;
    requestCount = 0;
    await hook(
      { sessionID: "sess_1" },
      { message: {}, parts: [{ type: "text", text: "second prompt" }] },
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    const secondRequestCount = requestCount;

    // First message should trigger initSession
    expect(firstRequestCount).toBeGreaterThan(0);
    // Second message should NOT trigger initSession
    expect(secondRequestCount).toBe(0);
  });
});
