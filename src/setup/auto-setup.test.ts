import { describe, it, expect } from "bun:test";
import { autoSetup } from "./auto-setup.js";
import type { SetupDeps, SetupStepResult } from "./types.js";

/**
 * Create mock SetupDeps with all steps injectable via overrides.
 */
function makeDeps(overrides: Partial<SetupDeps> = {}): SetupDeps {
  return {
    which: () => null,
    fileExists: async () => false,
    readJson: async () => ({}),
    writeFile: async () => {},
    copyDir: async () => {},
    mkdirp: async () => {},
    exec: async () => ({ exitCode: 0 }),
    log: () => {},
    pluginDir: "/fake/plugin",
    getWorkerPort: () => 37777,
    startWorker: async () => true,
    ...overrides,
  };
}

/** Helper to create step functions that return a fixed result */
function stepOk(msg = "ok"): () => Promise<SetupStepResult> {
  return async () => ({ status: "success", message: msg });
}
function stepFail(msg = "fail"): () => Promise<SetupStepResult> {
  return async () => ({ status: "failed", message: msg });
}
function stepSkip(msg = "skipped"): () => Promise<SetupStepResult> {
  return async () => ({ status: "skipped", message: msg });
}
function stepThrow(msg = "boom"): () => Promise<SetupStepResult> {
  return async () => {
    throw new Error(msg);
  };
}

describe("autoSetup", () => {
  it("returns all success when every step succeeds", async () => {
    const deps = makeDeps();
    const result = await autoSetup(deps, {
      detectBinary: stepOk("binary found"),
      installClaudeMem: stepOk("installed"),
      configureMcp: stepOk("mcp configured"),
      copySkills: stepOk("skills copied"),
    });

    expect(result.binary.status).toBe("success");
    expect(result.install.status).toBe("skipped"); // skipped because detect succeeded
    expect(result.mcp.status).toBe("success");
    expect(result.skills.status).toBe("success");
    expect(result.worker.status).toBe("success");
  });

  it("skips installClaudeMem when detectBinary succeeds", async () => {
    let installCalled = false;
    const deps = makeDeps();
    const result = await autoSetup(deps, {
      detectBinary: stepOk("binary found"),
      installClaudeMem: async () => {
        installCalled = true;
        return { status: "success", message: "installed" };
      },
      configureMcp: stepOk(),
      copySkills: stepOk(),
    });

    expect(installCalled).toBe(false);
    expect(result.install.status).toBe("skipped");
    expect(result.install.message).toContain("already");
  });

  it("calls installClaudeMem when detectBinary fails", async () => {
    let installCalled = false;
    const deps = makeDeps();
    const result = await autoSetup(deps, {
      detectBinary: stepFail("not found"),
      installClaudeMem: async () => {
        installCalled = true;
        return { status: "success", message: "installed" };
      },
      configureMcp: stepOk(),
      copySkills: stepOk(),
    });

    expect(installCalled).toBe(true);
    expect(result.binary.status).toBe("failed");
    expect(result.install.status).toBe("success");
  });

  it("catches step exceptions without crashing, marks as failed", async () => {
    const deps = makeDeps();
    const result = await autoSetup(deps, {
      detectBinary: stepOk("found"),
      installClaudeMem: stepOk(),
      configureMcp: stepThrow("mcp explosion"),
      copySkills: stepOk("skills ok"),
    });

    // Orchestrator should NOT throw
    expect(result.mcp.status).toBe("failed");
    expect(result.mcp.message).toContain("mcp explosion");
    // Other steps should still run
    expect(result.skills.status).toBe("success");
    expect(result.worker.status).toBe("success");
  });

  it("returns all failed when every step fails, without crashing", async () => {
    const deps = makeDeps({
      startWorker: async () => false,
    });
    const result = await autoSetup(deps, {
      detectBinary: stepFail("no binary"),
      installClaudeMem: stepFail("install failed"),
      configureMcp: stepFail("mcp failed"),
      copySkills: stepFail("skills failed"),
    });

    expect(result.binary.status).toBe("failed");
    expect(result.install.status).toBe("failed");
    expect(result.mcp.status).toBe("failed");
    expect(result.skills.status).toBe("failed");
    expect(result.worker.status).toBe("failed");
  });

  it("handles worker step failure (startWorker returns false)", async () => {
    const deps = makeDeps({
      startWorker: async () => false,
    });
    const result = await autoSetup(deps, {
      detectBinary: stepOk(),
      installClaudeMem: stepOk(),
      configureMcp: stepOk(),
      copySkills: stepOk(),
    });

    expect(result.worker.status).toBe("failed");
    expect(result.worker.message).toContain("Worker");
  });

  it("handles worker step throwing an exception", async () => {
    const deps = makeDeps({
      startWorker: async () => {
        throw new Error("worker crash");
      },
    });
    const result = await autoSetup(deps, {
      detectBinary: stepOk(),
      installClaudeMem: stepOk(),
      configureMcp: stepOk(),
      copySkills: stepOk(),
    });

    expect(result.worker.status).toBe("failed");
    expect(result.worker.message).toContain("worker crash");
  });

  it("logs an overall summary with counts", async () => {
    const logs: string[] = [];
    const deps = makeDeps({
      log: (msg: string) => logs.push(msg),
      startWorker: async () => false,
    });
    await autoSetup(deps, {
      detectBinary: stepOk(),
      installClaudeMem: stepOk(),
      configureMcp: stepFail(),
      copySkills: stepSkip(),
    });

    const summary = logs.find((l) => l.includes("Setup complete"));
    expect(summary).toBeDefined();
    expect(summary).toContain("succeeded");
    expect(summary).toContain("skipped");
    expect(summary).toContain("failed");
  });

  it("uses deps.getWorkerPort() for the worker port", async () => {
    let portUsed: number | undefined;
    const deps = makeDeps({
      getWorkerPort: () => 12345,
      startWorker: async (port: number) => {
        portUsed = port;
        return true;
      },
    });
    await autoSetup(deps, {
      detectBinary: stepOk(),
      installClaudeMem: stepOk(),
      configureMcp: stepOk(),
      copySkills: stepOk(),
    });

    expect(portUsed).toBe(12345);
  });
});
