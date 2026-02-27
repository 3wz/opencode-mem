import { describe, it, expect } from "bun:test";
import { detectBinary } from "./detect-binary.js";
import type { SetupDeps } from "../types.js";

/**
 * Create a mock SetupDeps for testing
 */
function createMockDeps(
  which: string | null,
  fileExists: (path: string) => Promise<boolean>,
): SetupDeps {
  return {
    which: (_cmd: string) => which,
    fileExists,
    readJson: async () => ({}),
    writeFile: async () => {},
    copyDir: async () => {},
    mkdirp: async () => {},
    exec: async () => ({ exitCode: 0 }),
    log: () => {},
    pluginDir: "/fake/plugin",
    getWorkerPort: () => 37777,
  };
}

describe("detectBinary", () => {
  it("returns success when binary found via which", async () => {
    const deps = createMockDeps("/usr/local/bin/claude-mem", async () => false);
    const result = await detectBinary(deps);

    expect(result.status).toBe("success");
    expect(result.message).toContain("/usr/local/bin/claude-mem");
  });

  it("returns success when data directory exists but binary not in PATH", async () => {
    const deps = createMockDeps(null, async (path: string) => {
      return path.includes(".claude-mem");
    });
    const result = await detectBinary(deps);

    expect(result.status).toBe("success");
    expect(result.message).toContain("~/.claude-mem");
  });

  it("returns failed when neither binary nor data directory exists", async () => {
    const deps = createMockDeps(null, async () => false);
    const result = await detectBinary(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("not found");
  });

  it("returns failed when which returns null and fileExists returns false", async () => {
    const deps = createMockDeps(null, async () => false);
    const result = await detectBinary(deps);

    expect(result.status).toBe("failed");
  });

  it("handles errors gracefully and returns failed status", async () => {
    const deps = createMockDeps(null, async () => {
      throw new Error("Filesystem error");
    });
    const result = await detectBinary(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("Failed to detect");
  });
});
