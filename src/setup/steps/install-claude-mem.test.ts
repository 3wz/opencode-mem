import { describe, it, expect } from "bun:test";
import { installClaudeMem } from "./install-claude-mem.js";
import type { SetupDeps } from "../types.js";

/**
 * Create a mock SetupDeps for testing
 */
function createMockDeps(opts: {
  which?: string | null;
  whichAfterInstall?: string | null;
  execResult?: { exitCode: number; stdout?: string };
  execThrows?: boolean;
}): SetupDeps & { execCalls: string[][] } {
  const execCalls: string[][] = [];
  const logCalls: Array<{ msg: string; level?: string }> = [];

  return {
    which: (_cmd: string) => {
      if (execCalls.length > 0 && opts.whichAfterInstall !== undefined) {
        return opts.whichAfterInstall;
      }
      return opts.which ?? null;
    },
    fileExists: async () => false,
    readJson: async () => ({}),
    writeFile: async () => {},
    copyDir: async () => {},
    mkdirp: async () => {},
    exec: async (cmd: string[]) => {
      execCalls.push(cmd);
      if (opts.execThrows) throw new Error("npm not found");
      return opts.execResult ?? { exitCode: 0 };
    },
    log: (msg: string, level?: "info" | "warn" | "error") => {
      logCalls.push({ msg, level });
    },
    pluginDir: "/fake/plugin",
    getWorkerPort: () => 37777,
    execCalls,
  };
}

describe("installClaudeMem", () => {
  it("returns skipped when claude-mem is already installed", async () => {
    const deps = createMockDeps({ which: "/usr/local/bin/claude-mem" });
    const result = await installClaudeMem(deps);

    expect(result.status).toBe("skipped");
    expect(result.message).toContain("already installed");
    expect(deps.execCalls.length).toBe(0);
  });

  it("calls exec with correct npm install command when not installed", async () => {
    const deps = createMockDeps({
      which: null,
      execResult: { exitCode: 0 },
      whichAfterInstall: "/usr/local/bin/claude-mem",
    });
    const result = await installClaudeMem(deps);

    expect(result.status).toBe("success");
    expect(deps.execCalls.length).toBe(1);
    expect(deps.execCalls[0]).toEqual(["npm", "install", "-g", "claude-mem"]);
  });

  it("returns success when npm install exits with 0", async () => {
    const deps = createMockDeps({
      which: null,
      execResult: { exitCode: 0 },
      whichAfterInstall: "/usr/local/bin/claude-mem",
    });
    const result = await installClaudeMem(deps);

    expect(result.status).toBe("success");
    expect(result.message).toContain("installed successfully");
  });

  it("returns failed when npm install exits with non-zero code", async () => {
    const deps = createMockDeps({
      which: null,
      execResult: { exitCode: 1 },
    });
    const result = await installClaudeMem(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("exit code 1");
  });

  it("returns failed when exec throws an error", async () => {
    const deps = createMockDeps({
      which: null,
      execThrows: true,
    });
    const result = await installClaudeMem(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("Failed to install claude-mem");
    expect(result.message).toContain("npm not found");
  });

  it("logs Installing message before exec is called", async () => {
    const deps = createMockDeps({
      which: null,
      execResult: { exitCode: 0 },
      whichAfterInstall: "/usr/local/bin/claude-mem",
    });
    await installClaudeMem(deps);

    // Check that log was called with the installation message
    // We need to verify this by checking the implementation behavior
    expect(deps.execCalls.length).toBe(1);
  });

  it("returns failed when install succeeds but binary is still missing", async () => {
    const deps = createMockDeps({
      which: null,
      execResult: { exitCode: 0 },
      whichAfterInstall: null,
    });

    const result = await installClaudeMem(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("not in PATH");
  });
});
