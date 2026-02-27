import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createSummaryHandler } from "./summary.js";
import { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";

let mockServer: ReturnType<typeof Bun.serve>;
const MOCK_PORT = 37902;
let requestCount = 0;
let lastPath = "";

beforeAll(() => {
  mockServer = Bun.serve({
    port: MOCK_PORT,
    async fetch(req) {
      lastPath = new URL(req.url).pathname;
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
  ...overrides,
});

describe("createSummaryHandler", () => {
  it("triggers sendSummary on session.idle event", async () => {
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const handler = createSummaryHandler(client, makeState());
    await handler({
      event: { type: "session.idle", properties: { sessionID: "sess_idle_1" } },
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(requestCount).toBeGreaterThan(0);
    expect(lastPath).toContain("/summarize");
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

  it("skips when isWorkerRunning is false", async () => {
    requestCount = 0;
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const handler = createSummaryHandler(client, makeState({ isWorkerRunning: false }));
    await handler({ event: { type: "session.idle", properties: { sessionID: "sess_1" } } });
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
});
