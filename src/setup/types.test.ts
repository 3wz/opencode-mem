import { describe, it, expect } from "bun:test";
import type { SetupDeps, SetupStepResult, SetupResult } from "./types.js";
import { createDefaultDeps } from "./types.js";

describe("SetupDeps types", () => {
  it("SetupStepResult has status and message fields", () => {
    const result: SetupStepResult = { status: "success", message: "Done" };
    expect(result.status).toBe("success");
    expect(result.message).toBe("Done");
  });

  it("SetupResult has all step fields", () => {
    const result: SetupResult = {
      binary: { status: "success", message: "Binary installed" },
      install: { status: "success", message: "Installed" },
      mcp: { status: "success", message: "MCP ready" },
      skills: { status: "success", message: "Skills loaded" },
      worker: { status: "success", message: "Worker running" },
    };
    expect(result.binary.status).toBe("success");
    expect(result.install.status).toBe("success");
    expect(result.mcp.status).toBe("success");
    expect(result.skills.status).toBe("success");
    expect(result.worker.status).toBe("success");
  });
});

describe("createDefaultDeps", () => {
  const mockLog = (msg: string, level?: "info" | "warn" | "error") => {
    // Mock log function
  };

  it("returns object with which function", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.which).toBe("function");
  });

  it("returns object with fileExists function", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.fileExists).toBe("function");
  });

  it("returns object with readJson function", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.readJson).toBe("function");
  });

  it("returns object with writeFile function", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.writeFile).toBe("function");
  });

  it("returns object with copyDir function", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.copyDir).toBe("function");
  });

  it("returns object with mkdirp function", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.mkdirp).toBe("function");
  });

  it("returns object with exec function", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.exec).toBe("function");
  });

  it("returns object with log function", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.log).toBe("function");
  });

  it("returns object with pluginDir string", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.pluginDir).toBe("string");
  });

  it("returns object with getWorkerPort function", () => {
    const deps = createDefaultDeps(mockLog);
    expect(typeof deps.getWorkerPort).toBe("function");
  });

  it("pluginDir ends with opencode-mem", () => {
    const deps = createDefaultDeps(mockLog);
    expect(deps.pluginDir.endsWith("opencode-mem")).toBe(true);
  });
});
