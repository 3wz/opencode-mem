import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createSummaryHandler } from "./summary.js";
import { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";

let mockServer: ReturnType<typeof Bun.serve>;
const MOCK_PORT = 37902;
let requestCount = 0;
let lastPath = "";
let lastBody: unknown = null;

beforeAll(() => {
  mockServer = Bun.serve({
    port: MOCK_PORT,
    async fetch(req) {
      lastPath = new URL(req.url).pathname;
      if (req.method === "POST") {
        lastBody = await req.json().catch(() => null);
      }
      requestCount++;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });
});

afterAll(() => mockServer.stop());

const makeState = (overrides?: Partial<PluginState>): PluginState => ({
  isWorkerRunning: true,
  projectName: "test-project",
  sessionId: "sess_test",
  promptNumber: 0,
  lastUserMessage: "",
  lastAssistantMessage: "",
  summarySent: false,
  ...overrides,
});

describe("createSummaryHandler", () => {
  it("triggers sendSummary on session.idle event", async () => {
    requestCount = 0;
    lastBody = null;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const handler = createSummaryHandler(client, makeState({ lastAssistantMessage: "assistant final" }));
    await handler({
      event: { type: "session.idle", properties: { sessionID: "sess_idle_1" } },
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(requestCount).toBeGreaterThan(0);
    expect(lastPath).toContain("/summarize");
    expect(lastBody).toEqual({
      contentSessionId: "sess_idle_1",
      last_assistant_message: "assistant final",
    });
  });

  it("ignores non-session.idle events", async () => {
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const handler = createSummaryHandler(client, makeState());
    await handler({
      event: { type: "session.created", properties: { info: { id: "sess_1" } } },
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(requestCount).toBe(0);
  });


  it("does not throw when worker unavailable", async () => {
    const client = new ClaudeMemClient(39996, 200);
    const handler = createSummaryHandler(client, makeState());
    await expect(
      handler({ event: { type: "session.idle", properties: { sessionID: "sess_1" } } }),
    ).resolves.toBeUndefined();
  });

  it("does not send duplicate summarize on repeated session.idle events", async () => {
    requestCount = 0;
    lastBody = null;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const state = makeState({ lastAssistantMessage: "assistant final" });
    const handler = createSummaryHandler(client, state);
    const event = { event: { type: "session.idle", properties: { sessionID: "sess_idle_dup" } } };
    
    // Call handler twice with the same event
    await handler(event);
    await new Promise((r) => setTimeout(r, 100));
    await handler(event);
    await new Promise((r) => setTimeout(r, 100));
    
    // Should only have sent one request
    expect(requestCount).toBe(1);
  });
});
