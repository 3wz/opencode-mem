import { describe, it, expect, mock } from "bun:test";
import { configureMcp } from "./configure-mcp.js";
import type { SetupDeps } from "../types.js";

// Mock the detect module BEFORE importing configure-mcp
mock.module("../../utils/detect.js", () => ({
  getMcpServerPath: () => "/fake/mcp-server.cjs",
  getWorkerPort: () => 37777,
  readSettings: () => ({ port: 37777, dataDir: "/fake" }),
  getDataDir: () => "/fake",
  detectClaudeMem: async () => ({ installed: true, workerRunning: true, port: 37777, dataDir: "/fake" }),
}));

/**
 * Create a mock SetupDeps with a pre-loaded opencode.json config.
 * Returns deps + a getter for written data.
 */
function createMockConfig(config: Record<string, unknown>) {
  let written: string | null = null;
  const deps: SetupDeps = {
    which: () => null,
    fileExists: async (p) => p.includes("opencode.json"),
    readJson: async () => config,
    writeFile: async (_p, data) => {
      written = data;
    },
    copyDir: async () => {},
    mkdirp: async () => {},
    exec: async () => ({ exitCode: 0 }),
    log: () => {},
    pluginDir: "/fake",
    getWorkerPort: () => 37777,
  };
  return { deps, getWritten: () => written };
}

describe("configureMcp", () => {
  it("migrates remote MCP to local when type is remote", async () => {
    const { deps, getWritten } = createMockConfig({
      mcp: {
        "claude-mem": {
          type: "remote",
          url: "http://localhost:37777/mcp",
          enabled: true,
        },
      },
    });

    const result = await configureMcp(deps);

    expect(result.status).toBe("success");
    expect(result.message).toContain("migrated from remote to local");
    const parsed = JSON.parse(getWritten()!);
    expect(parsed.mcp["claude-mem"]).toEqual({
      type: "local",
      command: ["/fake/mcp-server.cjs"],
      enabled: true,
    });
  });

  it("adds claude-mem MCP with type local when missing", async () => {
    const { deps, getWritten } = createMockConfig({});

    const result = await configureMcp(deps);

    expect(result.status).toBe("success");
    const parsed = JSON.parse(getWritten()!);
    expect(parsed.mcp["claude-mem"]).toEqual({
      type: "local",
      command: ["/fake/mcp-server.cjs"],
      enabled: true,
    });
  });

  it("skips when claude-mem MCP already configured with type local", async () => {
    const { deps, getWritten } = createMockConfig({
      mcp: {
        "claude-mem": {
          type: "local",
          command: ["/some/path/mcp-server.cjs"],
          enabled: true,
        },
      },
    });

    const result = await configureMcp(deps);

    expect(result.status).toBe("skipped");
    expect(result.message).toContain("already configured");
    expect(getWritten()).toBeNull();
  });

  it("returns failed when opencode.json does not exist", async () => {
    const { deps, getWritten } = createMockConfig({});
    // Override fileExists to return false
    deps.fileExists = async () => false;

    const result = await configureMcp(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("not found");
    expect(getWritten()).toBeNull();
  });

  it("returns failed on invalid JSON without crashing", async () => {
    const { deps, getWritten } = createMockConfig({});
    // Override readJson to throw parse error
    deps.readJson = async () => {
      throw new SyntaxError("Unexpected token");
    };

    const result = await configureMcp(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("invalid JSON");
    expect(getWritten()).toBeNull();
  });

  it("preserves $schema and existing keys in opencode.json", async () => {
    const { deps, getWritten } = createMockConfig({
      $schema: "https://opencode.ai/schema.json",
      plugin: ["some-plugin"],
      theme: "dark",
    });

    const result = await configureMcp(deps);

    expect(result.status).toBe("success");
    const parsed = JSON.parse(getWritten()!);
    expect(parsed.$schema).toBe("https://opencode.ai/schema.json");
    expect(parsed.plugin).toEqual(["some-plugin"]);
    expect(parsed.theme).toBe("dark");
    expect(parsed.mcp["claude-mem"]).toBeDefined();
  });

  it("preserves existing MCP entries when adding claude-mem", async () => {
    const { deps, getWritten } = createMockConfig({
      mcp: {
        openai: {
          type: "remote",
          url: "http://localhost:9999/mcp",
        },
        "some-other": {
          type: "remote",
          url: "http://localhost:8888/mcp",
        },
      },
    });

    const result = await configureMcp(deps);

    expect(result.status).toBe("success");
    const parsed = JSON.parse(getWritten()!);
    // Existing entries preserved
    expect(parsed.mcp.openai).toEqual({
      type: "remote",
      url: "http://localhost:9999/mcp",
    });
    expect(parsed.mcp["some-other"]).toEqual({
      type: "remote",
      url: "http://localhost:8888/mcp",
    });
    // New entry added with type: local
    expect(parsed.mcp["claude-mem"]).toEqual({
      type: "local",
      command: ["/fake/mcp-server.cjs"],
      enabled: true,
    });
  });

  it("returns failed when mcp-server.cjs path is null", async () => {
    const { deps, getWritten } = createMockConfig({});
    // Re-mock to return null for this test
    mock.module("../../utils/detect.js", () => ({
      getMcpServerPath: () => null,
      getWorkerPort: () => 37777,
      readSettings: () => ({ port: 37777, dataDir: "/fake" }),
      getDataDir: () => "/fake",
      detectClaudeMem: async () => ({ installed: true, workerRunning: true, port: 37777, dataDir: "/fake" }),
    }));

    const result = await configureMcp(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("mcp-server.cjs not found");
    expect(getWritten()).toBeNull();
  });
});
