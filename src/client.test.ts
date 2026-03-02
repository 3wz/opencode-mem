import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { ClaudeMemClient } from "./client.js";

let mockServer: ReturnType<typeof Bun.serve>;
let mockPort: number;
let lastRequest: { path: string; body?: unknown; method: string } | null = null;
let mockResponse: unknown = { status: "ok" };
let mockStatus = 200;
let mockDelay = 0;

beforeAll(() => {
  mockPort = 37888;
  mockServer = Bun.serve({
    port: mockPort,
    async fetch(req) {
      const url = new URL(req.url);
      lastRequest = {
        method: req.method,
        path: `${url.pathname}${url.search}`,
      };

      if (req.method === "POST") {
        lastRequest.body = await req.json().catch(() => null);
      }

      if (mockDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, mockDelay));
      }

      // Return plain text for context inject endpoint
      if (url.pathname === "/api/context/inject") {
        const textResponse = typeof mockResponse === "string" ? mockResponse : "";
        return new Response(textResponse, {
          status: mockStatus,
          headers: { "Content-Type": "text/plain" },
        });
      }

      return new Response(JSON.stringify(mockResponse), {
        status: mockStatus,
        headers: { "Content-Type": "application/json" },
      });
    },
  
  });
});

afterAll(() => {
  mockServer.stop();
});

beforeEach(() => {
  lastRequest = null;
  mockResponse = { status: "ok" };
  mockStatus = 200;
  mockDelay = 0;
  delete process.env.CLAUDE_MEM_WORKER_HOST;
});

describe("ClaudeMemClient", () => {
  it("healthCheck returns true when worker responds with status ok", async () => {
    const client = new ClaudeMemClient(mockPort, 2000);

    const result = await client.healthCheck(1);

    expect(result).toBe(true);
    expect(lastRequest?.path).toBe("/health");
    expect(lastRequest?.method).toBe("GET");
  });

  it("healthCheck returns false when worker returns non-ok payload", async () => {
    mockResponse = { status: "error" };
    const client = new ClaudeMemClient(mockPort, 2000);

    const result = await client.healthCheck(1);

    expect(result).toBe(false);
  });

  it("healthCheck returns false when worker is unreachable", async () => {
    const client = new ClaudeMemClient(39999, 500);

    const result = await client.healthCheck(1);

    expect(result).toBe(false);
  });

  it("getContext calls GET /api/context/inject with encoded project", async () => {
    mockResponse = "some context" as any;  // plain text string
    const client = new ClaudeMemClient(mockPort, 2000);

    const result = await client.getContext("my project");

    expect(result).toEqual({ context: "some context", projectName: "my project" });
    expect(lastRequest?.path).toBe("/api/context/inject?project=my%20project");
    expect(lastRequest?.method).toBe("GET");
  });

  it("getContext returns null for empty text response", async () => {
    mockResponse = "" as any;  // empty string
    const client = new ClaudeMemClient(mockPort, 2000);

    const result = await client.getContext("my project");

    expect(result).toBeNull();
  });

  it("initSession calls POST /api/sessions/init", async () => {
    const client = new ClaudeMemClient(mockPort, 2000);

    await client.initSession({
      contentSessionId: "sess_123",
      project: "test",
      prompt: "hello",
    });

    expect(lastRequest?.path).toBe("/api/sessions/init");
    expect(lastRequest?.method).toBe("POST");
  });

  it("sendObservation calls POST /api/sessions/observations", async () => {
    const client = new ClaudeMemClient(mockPort, 2000);

    await client.sendObservation({
      contentSessionId: "sess_123",
      tool_name: "bash",
      tool_input: { command: "ls" },
      tool_response: "file.ts",
    });

    expect(lastRequest?.path).toBe("/api/sessions/observations");
    expect(lastRequest?.method).toBe("POST");
  });

  it("sendSummary calls POST /api/sessions/summarize", async () => {
    const client = new ClaudeMemClient(mockPort, 2000);

    await client.sendSummary({ contentSessionId: "sess_123", last_assistant_message: "" });

    expect(lastRequest?.path).toBe("/api/sessions/summarize");
    expect(lastRequest?.method).toBe("POST");
  });

  it("completeSession calls POST /api/sessions/complete", async () => {
    const client = new ClaudeMemClient(mockPort, 2000);

    await client.completeSession({ contentSessionId: "sess_123" });

    expect(lastRequest?.path).toBe("/api/sessions/complete");
    expect(lastRequest?.method).toBe("POST");
  });

  it("methods catch errors silently (no throw on non-200)", async () => {
    mockStatus = 500;
    const client = new ClaudeMemClient(mockPort, 2000);

    await expect(
      client.sendObservation({
        contentSessionId: "sess_123",
        tool_name: "bash",
        tool_input: { command: "ls" },
        tool_response: "file.ts",
      }),
    ).resolves.toBeUndefined();
  });

  it("respects timeout and does not throw on abort", async () => {
    mockDelay = 3000;
    const client = new ClaudeMemClient(mockPort, 500);
    const start = Date.now();

    await client.sendObservation({
      contentSessionId: "sess_timeout",
      tool_name: "bash",
      tool_input: { command: "ls" },
      tool_response: "x",
    });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it("logs failures via callback instead of throwing", async () => {
    const logs: string[] = [];
    const client = new ClaudeMemClient(39999, 100, (msg) => logs.push(msg));

    const context = await client.getContext("demo");

    expect(context).toBeNull();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toContain("[claude-mem] GET /api/context/inject?project=demo failed:");
  });
});

describe("ClaudeMemClient.getMemoryStatus", () => {
  it("returns connected:true with version when server responds ok", async () => {
    mockResponse = { status: "ok", version: "1.0.0" };
    mockStatus = 200;
    const client = new ClaudeMemClient(mockPort, 2000);

    const status = await client.getMemoryStatus();

    expect(status.connected).toBe(true);
    expect(status.version).toBe("1.0.0");
    expect(status.workerUrl).toBe(`http://localhost:${mockPort}`);
  });

  it("returns connected:false when server returns non-ok status", async () => {
    mockResponse = { status: "error" };
    mockStatus = 200;
    const client = new ClaudeMemClient(mockPort, 2000);

    const status = await client.getMemoryStatus();

    expect(status.connected).toBe(false);
    expect(status.workerUrl).toBe(`http://localhost:${mockPort}`);
  });

  it("returns connected:false when server returns non-200 HTTP status", async () => {
    mockResponse = { status: "ok" };
    mockStatus = 500;
    const client = new ClaudeMemClient(mockPort, 2000);

    const status = await client.getMemoryStatus();

    expect(status.connected).toBe(false);
    expect(status.workerUrl).toBe(`http://localhost:${mockPort}`);
  });

  it("returns connected:false on timeout without throwing", async () => {
    mockDelay = 3000; // Exceeds the 500ms hardcoded timeout in getMemoryStatus
    mockResponse = { status: "ok", version: "1.0.0" };
    const client = new ClaudeMemClient(mockPort, 2000);

    const status = await client.getMemoryStatus();

    expect(status.connected).toBe(false);
    expect(status.workerUrl).toBe(`http://localhost:${mockPort}`);
  });

  it("never throws even when fetch throws (unreachable server)", async () => {
    const client = new ClaudeMemClient(39999, 500); // No server on this port

    const status = await client.getMemoryStatus();

    expect(status.connected).toBe(false);
    expect(status.workerUrl).toBe("http://localhost:39999");
    expect(status.version).toBeUndefined();
  });
});

describe("ClaudeMemClient host resolution", () => {
  it("uses CLAUDE_MEM_WORKER_HOST when present", async () => {
    process.env.CLAUDE_MEM_WORKER_HOST = "example.local";
    const client = new ClaudeMemClient(mockPort, 2000);

    const status = await client.getMemoryStatus();

    expect(status.workerUrl).toBe(`http://example.local:${mockPort}`);
  });

  it("normalizes host passed to constructor", async () => {
    const client = new ClaudeMemClient(mockPort, 2000, () => {}, "http://localhost/");

    const status = await client.getMemoryStatus();

    expect(status.workerUrl).toBe(`http://localhost:${mockPort}`);
  });
});
