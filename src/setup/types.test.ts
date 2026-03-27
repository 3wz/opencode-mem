import { describe, it, expect } from "bun:test";
import { dirname, join } from "path";
import { fileURLToPath } from "node:url";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
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
      commands: { status: "success", message: "Commands configured" },
      skills: { status: "success", message: "Skills loaded" },
      worker: { status: "success", message: "Worker running" },
    };
    expect(result.binary.status).toBe("success");
    expect(result.install.status).toBe("success");
    expect(result.mcp.status).toBe("success");
    expect(result.commands.status).toBe("success");
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

  it("pluginDir is derived from import.meta.url", () => {
    const deps = createDefaultDeps(mockLog);
    const expected = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    expect(deps.pluginDir).toBe(expected);
  });

  it("built Node setup path works without Bun global", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "opencode-mem-node-deps-"));
    const fakeHome = join(tempRoot, "home");
    const configDir = join(fakeHome, ".config", "opencode");
    const configPath = join(configDir, "opencode.json");

    try {
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, "{}", "utf-8");

      const build = spawnSync("npm", ["run", "build"], {
        cwd: join(dirname(fileURLToPath(import.meta.url)), "..", ".."),
        encoding: "utf-8",
      });
      expect(build.status).toBe(0);

      const run = spawnSync("node", ["dist/cli.js", "--no-tui", "--skip-worker"], {
        cwd: join(dirname(fileURLToPath(import.meta.url)), "..", ".."),
        encoding: "utf-8",
        env: {
          ...process.env,
          HOME: fakeHome,
          USERPROFILE: fakeHome,
        },
      });

      expect(run.stderr).not.toContain("Bun is not defined");
      expect(run.stdout).not.toContain("Bun is not defined");
      expect(run.stdout).toContain("Installation Wizard");
      expect(run.stdout.trim().length).toBeGreaterThan(0);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
