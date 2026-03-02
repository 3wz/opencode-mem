import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createContextInjectionHook } from "./context-inject.js";
import { ClaudeMemClient } from "../client.js";

let mockServer: ReturnType<typeof Bun.serve>;
const MOCK_PORT = 37899;
let mockContextResponse: unknown = "test memory";
let mockStatus = 200;

beforeAll(() => {
  mockServer = Bun.serve({
    port: MOCK_PORT,
    async fetch() {
      // Return plain text for context inject endpoint
      const text = typeof mockContextResponse === "string" ? mockContextResponse : "";
      return new Response(text, {
        status: mockStatus,
        headers: { "Content-Type": "text/plain" },
      });
    },
  });
});

afterAll(() => mockServer.stop());

describe("createContextInjectionHook", () => {
  it("appends context to output.system when worker returns context", async () => {
    mockStatus = 200;
    mockContextResponse = "test memory";
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createContextInjectionHook(client, "test", MOCK_PORT);
    const output = { system: [] as string[] };
    await hook({ sessionID: "sess_1" }, output);
    expect(output.system.length).toBeGreaterThan(0);
    expect(output.system[0]).toContain("Claude-Mem");
    expect(output.system[0]).toContain("test memory");
  });

  it("includes web viewer URL in injected context", async () => {
    mockStatus = 200;
    mockContextResponse = "data";
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createContextInjectionHook(client, "test", MOCK_PORT);
    const output = { system: [] as string[] };
    await hook({}, output);
    expect(output.system[0]).toContain(`http://localhost:${MOCK_PORT}`);
  });

  it("skips injection when worker returns null context", async () => {
    mockStatus = 200;
    mockContextResponse = "";
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createContextInjectionHook(client, "test", MOCK_PORT);
    const output = { system: [] as string[] };
    await hook({}, output);
    expect(output.system.length).toBe(0);
  });

  it("skips injection when worker is unavailable (no crash)", async () => {
    const client = new ClaudeMemClient(39998, 200);
    const hook = createContextInjectionHook(client, "test");
    const output = { system: [] as string[] };
    await expect(hook({}, output)).resolves.toBeUndefined();
    expect(output.system.length).toBe(0);
  });

  it("does not modify existing system entries", async () => {
    mockStatus = 200;
    mockContextResponse = "new ctx";
    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createContextInjectionHook(client, "test", MOCK_PORT);
    const output = { system: ["existing system prompt"] };
    await hook({}, output);
    expect(output.system[0]).toBe("existing system prompt");
    expect(output.system.length).toBe(2);
  });
});
