import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { ClaudeMemClient } from "../client.js";
import { createCompactionHook } from "./compaction.js";

let mockServer: ReturnType<typeof Bun.serve>;
const MOCK_PORT = 37903;
let mockContextResponse: unknown = "important memory data";
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

afterAll(() => {
  mockServer.stop();
});

describe("createCompactionHook", () => {
  it("injects memory context into output.context array", async () => {
    mockStatus = 200;
    mockContextResponse = "important memory data";

    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCompactionHook(client, "test");
    const output = { context: [] as string[] };

    await hook({ sessionID: "sess_1" }, output);

    expect(output.context.length).toBeGreaterThan(0);
    expect(output.context[0]).toContain("Claude-Mem");
    expect(output.context[0]).toContain("important memory data");
    expect(output.context[0]).toContain("survives compaction");
  });

  it("skips injection when context is null", async () => {
    mockStatus = 200;
    mockContextResponse = "";

    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCompactionHook(client, "test");
    const output = { context: [] as string[] };

    await hook({ sessionID: "sess_1" }, output);

    expect(output.context.length).toBe(0);
  });

  it("does not replace existing context entries", async () => {
    mockStatus = 200;
    mockContextResponse = "new data";

    const client = new ClaudeMemClient(MOCK_PORT, 2000);
    const hook = createCompactionHook(client, "test");
    const output = { context: ["existing compaction context"] };

    await hook({ sessionID: "sess_1" }, output);

    expect(output.context[0]).toBe("existing compaction context");
    expect(output.context.length).toBe(2);
  });

  it("does not throw when worker unavailable", async () => {
    const client = new ClaudeMemClient(39995, 200);
    const hook = createCompactionHook(client, "test");
    const output = { context: [] as string[] };

    await expect(hook({ sessionID: "sess_1" }, output)).resolves.toBeUndefined();
    expect(output.context.length).toBe(0);
  });
});
