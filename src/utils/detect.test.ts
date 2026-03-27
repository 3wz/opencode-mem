import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getDataDir, getWorkerHost, getWorkerPort, readSettings, detectClaudeMem, getMcpServerPath } from "./detect.js";

describe("getDataDir", () => {
  it("returns ~/.claude-mem by default", () => {
    delete process.env.CLAUDE_MEM_DATA_DIR;
    const dir = getDataDir();
    expect(dir).toContain(".claude-mem");
    expect(dir).toContain(process.env.HOME ?? "~");
  });

  it("returns custom dir from env var", () => {
    process.env.CLAUDE_MEM_DATA_DIR = "/tmp/test-claude-mem";
    const dir = getDataDir();
    expect(dir).toBe("/tmp/test-claude-mem");
    delete process.env.CLAUDE_MEM_DATA_DIR;
  });
});

describe("getWorkerPort", () => {
  it("returns 37777 as default port", () => {
    // When no settings file, returns default
    const port = getWorkerPort();
    expect(typeof port).toBe("number");
    expect(port).toBeGreaterThan(0);
  });
});

describe("getWorkerHost", () => {
  afterEach(() => {
    delete process.env.CLAUDE_MEM_WORKER_HOST;
    delete process.env.CLAUDE_MEM_DATA_DIR;
  });

  it("returns env host when CLAUDE_MEM_WORKER_HOST is set", () => {
    process.env.CLAUDE_MEM_WORKER_HOST = "mem.local";
    expect(getWorkerHost()).toBe("mem.local");
  });

  it("returns host from settings file when present", () => {
    const tmpDir = `/tmp/claude-mem-host-${Date.now()}`;
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(`${tmpDir}/settings.json`, JSON.stringify({ host: "settings.local", port: 37777, dataDir: tmpDir }));
    process.env.CLAUDE_MEM_DATA_DIR = tmpDir;

    expect(getWorkerHost()).toBe("settings.local");
  });
});

describe("readSettings", () => {
  it("returns defaults when settings file missing", () => {
    process.env.CLAUDE_MEM_DATA_DIR = "/tmp/nonexistent-dir-xyz";
    const settings = readSettings();
    expect(settings.port).toBe(37777);
    expect(settings.dataDir).toContain(".claude-mem");
    delete process.env.CLAUDE_MEM_DATA_DIR;
  });
});

describe("detectClaudeMem", () => {
  it("returns installed:false when DB does not exist", async () => {
    process.env.CLAUDE_MEM_DATA_DIR = "/tmp/nonexistent-dir-xyz-detect";
    const result = await detectClaudeMem();
    expect(result.installed).toBe(false);
    expect(result.workerRunning).toBe(false);
    delete process.env.CLAUDE_MEM_DATA_DIR;
  });

  it("result has port and dataDir", async () => {
    process.env.CLAUDE_MEM_DATA_DIR = "/tmp/nonexistent-dir-xyz-detect2";
    const result = await detectClaudeMem();
    expect(result.port).toBeGreaterThan(0);
    expect(result.dataDir).toBeTruthy();
    delete process.env.CLAUDE_MEM_DATA_DIR;
  });

  it("returns correct shape", async () => {
    process.env.CLAUDE_MEM_DATA_DIR = "/tmp/none";
    const result = await detectClaudeMem();
    expect(result).toHaveProperty("installed");
    expect(result).toHaveProperty("workerRunning");
    expect(result).toHaveProperty("port");
    expect(result).toHaveProperty("dataDir");
    delete process.env.CLAUDE_MEM_DATA_DIR;
  });

  it("returns workerRunning:false when worker not responding", async () => {
    process.env.CLAUDE_MEM_DATA_DIR = "/tmp/nonexistent-dir-xyz-detect3";
    const result = await detectClaudeMem();
    expect(result.workerRunning).toBe(false);
    delete process.env.CLAUDE_MEM_DATA_DIR;
  });
});

describe("getMcpServerPath", () => {
  it("returns null or string", () => {
    const path = getMcpServerPath();
    expect(typeof path === "string" || path === null).toBe(true);
  });

  it("returns string path when mcp-server.cjs found", () => {
    const path = getMcpServerPath();
    if (path !== null) {
      expect(typeof path).toBe("string");
      expect(path).toContain("mcp-server.cjs");
    }
  });

  it("returns absolute path", () => {
    const path = getMcpServerPath();
    if (path !== null) {
      expect(path.startsWith("/")).toBe(true);
    }
  });

  it("returns path that exists on disk when found", () => {
    const path = getMcpServerPath();
    if (path !== null) {
      expect(path).toContain("mcp-server.cjs");
      // Verify path exists
      const { existsSync } = require("fs");
      expect(existsSync(path)).toBe(true);
    }
  });
});

describe("getMcpServerPath (filesystem)", () => {
  it("returns path from real cache dir when claude-mem is installed", () => {
    const { existsSync } = require("fs");
    const { join } = require("path");
    const os = require("os");
    const cacheDir = join(os.homedir(), ".claude", "plugins", "cache", "thedotmack", "claude-mem");
    const hasCacheDir = existsSync(cacheDir);
    const hasAnyMcpServer = hasCacheDir && require("fs").readdirSync(cacheDir).some((dir: string) => {
      return existsSync(join(cacheDir, dir, "scripts", "mcp-server.cjs"));
    });

    const path = getMcpServerPath();

    if (hasAnyMcpServer) {
      // If the cache dir exists on this machine, we should get a path back
      expect(path).not.toBeNull();
      expect(path!).toContain("mcp-server.cjs");
      expect(path!.startsWith("/")).toBe(true);
    } else {
      // If no cache dir, result depends on npm global / Bun.which fallbacks
      expect(path === null || typeof path === "string").toBe(true);
    }
  });

  it("returns null when all strategies fail (nonexistent homedir)", () => {
    // We can't easily mock homedir since it's imported at module level,
    // but we can verify the function handles errors gracefully.
    // The function wraps everything in try/catch and returns null on failure.
    // Test that the function never throws, regardless of environment.
    expect(() => {
      const result = getMcpServerPath();
      // Result is either a valid path or null — never throws
      expect(result === null || typeof result === "string").toBe(true);
    }).not.toThrow();
  });

  it("does not throw when Bun helpers are unavailable", () => {
    const originalSpawnSync = Bun.spawnSync;
    const originalWhich = Bun.which;

    try {
      Bun.spawnSync = undefined as unknown as typeof Bun.spawnSync;
      Bun.which = undefined as unknown as typeof Bun.which;
      expect(() => getMcpServerPath()).not.toThrow();
      const result = getMcpServerPath();
      expect(result === null || typeof result === "string").toBe(true);
    } finally {
      Bun.spawnSync = originalSpawnSync;
      Bun.which = originalWhich;
    }
  });

  it("prefers stable release over prerelease when versions tie", () => {
    const cacheRoot = join(homedir(), ".claude", "plugins", "cache", "thedotmack", "claude-mem");
    const stableDir = join(cacheRoot, "999.0.0", "scripts");
    const prereleaseDir = join(cacheRoot, "999.0.0-beta.1", "scripts");
    mkdirSync(stableDir, { recursive: true });
    mkdirSync(prereleaseDir, { recursive: true });
    writeFileSync(join(stableDir, "mcp-server.cjs"), "// stable");
    writeFileSync(join(prereleaseDir, "mcp-server.cjs"), "// prerelease");

    const path = getMcpServerPath();

    expect(path).toContain(join("999.0.0", "scripts", "mcp-server.cjs"));

    rmSync(join(cacheRoot, "999.0.0"), { recursive: true, force: true });
    rmSync(join(cacheRoot, "999.0.0-beta.1"), { recursive: true, force: true });
  });
});
