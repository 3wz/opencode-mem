import { describe, it, expect } from "bun:test";
import type { SetupDeps, SetupStepResult } from "../types.js";
import { copySkills } from "./copy-skills.js";

/**
 * Create a mock SetupDeps with configurable behavior and call tracking
 */
function createMockDeps(opts: {
  destExists?: boolean;
  sourceExists?: boolean;
  copyDirThrows?: boolean;
  pluginDir?: string;
}): SetupDeps & { calls: string[] } {
  const calls: string[] = [];

  return {
    which: () => null,
    fileExists: async (p: string) => {
      // Check destination first (contains "opencode/skills/mem-search")
      if (p.includes("opencode/skills/mem-search")) {
        return opts.destExists ?? false;
      }
      // Then check source (contains "skills/mem-search")
      if (p.includes("skills/mem-search")) {
        return opts.sourceExists ?? true;
      }
      return false;
    },
    readJson: async () => ({}),
    writeFile: async () => {},
    copyDir: async () => {
      calls.push("copyDir");
      if (opts.copyDirThrows) {
        throw new Error("Copy failed");
      }
    },
    mkdirp: async () => {
      calls.push("mkdirp");
    },
    exec: async () => ({ exitCode: 0 }),
    log: () => {},
    pluginDir: opts.pluginDir ?? "/fake/plugin",
    getWorkerPort: () => 37777,
    calls,
  };
}

describe("copySkills", () => {
  it("should skip if destination already exists", async () => {
    const deps = createMockDeps({ destExists: true });
    const result = await copySkills(deps);

    expect(result.status).toBe("skipped");
    expect(result.message).toContain("already installed");
    expect(deps.calls).not.toContain("copyDir");
  });

  it("should fail if source doesn't exist", async () => {
    const deps = createMockDeps({ sourceExists: false });
    const result = await copySkills(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("Source skill not found");
    expect(deps.calls).not.toContain("copyDir");
  });

  it("should create parent directory before copying", async () => {
    const deps = createMockDeps({ sourceExists: true, destExists: false });
    const result = await copySkills(deps);

    expect(result.status).toBe("success");
    expect(deps.calls).toContain("mkdirp");
    expect(deps.calls).toContain("copyDir");
    // mkdirp should be called before copyDir
    const mkdirpIndex = deps.calls.indexOf("mkdirp");
    const copyDirIndex = deps.calls.indexOf("copyDir");
    expect(mkdirpIndex).toBeLessThan(copyDirIndex);
  });

  it("should copy skill on happy path", async () => {
    const deps = createMockDeps({ sourceExists: true, destExists: false });
    const result = await copySkills(deps);

    expect(result.status).toBe("success");
    expect(result.message).toContain("mem-search skill copied");
    expect(deps.calls).toContain("copyDir");
  });

  it("should handle copyDir errors gracefully", async () => {
    const deps = createMockDeps({
      sourceExists: true,
      destExists: false,
      copyDirThrows: true,
    });
    const result = await copySkills(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("Failed to copy skills");
    expect(result.message).toContain("Copy failed");
  });

  it("should use correct paths from pluginDir", async () => {
    const customPluginDir = "/custom/plugin/path";
    const deps = createMockDeps({
      sourceExists: true,
      destExists: false,
      pluginDir: customPluginDir,
    });

    // Track which paths are checked
    const checkedPaths: string[] = [];
    const originalFileExists = deps.fileExists;
    deps.fileExists = async (p: string) => {
      checkedPaths.push(p);
      return originalFileExists(p);
    };

    const result = await copySkills(deps);

    expect(result.status).toBe("success");
    // Verify that the custom pluginDir was used in the source path
    expect(checkedPaths.some((p) => p.includes(customPluginDir))).toBe(true);
  });
});
