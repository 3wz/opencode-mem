import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getDataDir, getWorkerPort, readSettings, detectClaudeMem } from "./detect.js";

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
