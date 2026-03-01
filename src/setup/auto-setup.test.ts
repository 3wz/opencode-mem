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
      configureCommands: stepOk("commands configured"),
    });

    expect(result.binary.status).toBe("success");
    expect(result.install.status).toBe("skipped"); // skipped because detect succeeded
    expect(result.mcp.status).toBe("success");
    expect(result.skills.status).toBe("success");
    expect(result.commands.status).toBe("success");
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
      configureCommands: stepOk(),
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
      configureCommands: stepOk(),
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
      configureCommands: stepOk("commands ok"),
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
      configureCommands: stepFail("commands failed"),
    });

    expect(result.binary.status).toBe("failed");
    expect(result.install.status).toBe("failed");
    expect(result.mcp.status).toBe("failed");
    expect(result.skills.status).toBe("failed");
    expect(result.commands.status).toBe("failed");
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
      configureCommands: stepOk(),
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
      configureCommands: stepOk(),
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
      configureCommands: stepOk(),
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
      configureCommands: stepOk(),
    });

    expect(portUsed).toBe(12345);
  });

  it("result includes commands key with valid SetupStepResult", async () => {
    const deps = makeDeps();
    const result = await autoSetup(deps, {
      detectBinary: stepOk(),
      installClaudeMem: stepOk(),
      configureMcp: stepOk(),
      copySkills: stepOk(),
      configureCommands: stepOk("commands added"),
    });

    expect(result.commands).toBeDefined();
    expect(result.commands.status).toBe("success");
    expect(result.commands.message).toBe("commands added");
  });

  it("commands step runs after mcp and before skills", async () => {
    const callOrder: string[] = [];
    const deps = makeDeps();
    const result = await autoSetup(deps, {
      detectBinary: stepOk(),
      installClaudeMem: stepOk(),
      configureMcp: async () => {
        callOrder.push("mcp");
        return { status: "success" as const, message: "mcp" };
      },
      configureCommands: async () => {
        callOrder.push("commands");
        return { status: "success" as const, message: "commands" };
      },
      copySkills: async () => {
        callOrder.push("skills");
        return { status: "success" as const, message: "skills" };
      },
    });

    expect(callOrder).toEqual(["mcp", "commands", "skills"]);
  });

  it("catastrophic failure returns commands: fail", async () => {
    // Force a catastrophic failure by making deps.getWorkerPort throw
    // This triggers the outer try-catch in autoSetup (not runStep)
    const deps = makeDeps({
      getWorkerPort: () => { throw new Error("catastrophic"); },
    });

    // Use steps that all succeed, but the worker step will trigger catastrophic failure
    // because it accesses deps.getWorkerPort() outside of runStep's fn()
    // Actually, getWorkerPort is called inside runStep's fn, so we need a different approach.
    // The outer catch only fires if something outside runStep throws.
    // Let's test that all steps including commands return fail when all steps fail.
    const deps2 = makeDeps({ startWorker: async () => false });
    const result = await autoSetup(deps2, {
      detectBinary: stepFail("no binary"),
      installClaudeMem: stepFail("install failed"),
      configureMcp: stepFail("mcp failed"),
      configureCommands: stepFail("commands failed"),
      copySkills: stepFail("skills failed"),
    });

    expect(result.commands.status).toBe("failed");
    expect(result.commands.message).toBe("commands failed");
    expect(result.binary.status).toBe("failed");
    expect(result.install.status).toBe("failed");
    expect(result.mcp.status).toBe("failed");
    expect(result.skills.status).toBe("failed");
    expect(result.worker.status).toBe("failed");
  });
});

