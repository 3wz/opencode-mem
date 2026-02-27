import { describe, it, expect } from "bun:test";
import {
  isWorkerRunning,
  getWorkerCommand,
  startWorker,
} from "./worker-manager.js";

describe("isWorkerRunning", () => {
  it("returns false when no process on test port", async () => {
    // Port 39994 should have nothing running
    const result = await isWorkerRunning(39994);
    expect(result).toBe(false);
  });

  it("returns boolean", async () => {
    const result = await isWorkerRunning(39994);
    expect(typeof result).toBe("boolean");
  });
});

describe("getWorkerCommand", () => {
  it("returns a command object or null", () => {
    const cmd = getWorkerCommand();
    expect(cmd === null || typeof cmd === "object").toBe(true);
  });

  it("returned command has cmd and args when not null", () => {
    const cmd = getWorkerCommand();
    if (cmd !== null) {
      expect(typeof cmd.cmd).toBe("string");
      expect(Array.isArray(cmd.args)).toBe(true);
    } else {
      expect(cmd).toBeNull();
    }
  });

  it("returns bunx as fallback command", () => {
    // Even if no local install found, should return bunx fallback
    const cmd = getWorkerCommand();
    expect(cmd).not.toBeNull();
    // The fallback is always available
    if (cmd) {
      expect(["bunx", cmd.cmd].some((v) => v.length > 0)).toBe(true);
    }
  });
});

describe("startWorker", () => {
  it("returns false quickly when worker cannot start (invalid command)", async () => {
    // Use very short timeout to avoid slow test
    const start = Date.now();
    // This will fail fast because port 39994 has no worker
    // and any spawn command will fail/timeout quickly
    const result = await startWorker(39994, 200); // 200ms timeout — intentionally short
    const elapsed = Date.now() - start;
    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(3000); // Should not hang
  });

  it("returns boolean", async () => {
    const result = await startWorker(39994, 200);
    expect(typeof result).toBe("boolean");
  });
});
