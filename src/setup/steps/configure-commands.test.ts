import { describe, it, expect } from "bun:test";
import { configureCommands } from "./configure-commands.js";
import type { SetupDeps } from "../types.js";

/**
 * Create a mock SetupDeps with a pre-loaded opencode.json config.
 * Returns deps + a getter for written data.
 */
function createMockConfig(config: Record<string, unknown>) {
  let written: string | null = null;
  const deps: SetupDeps = {
    which: () => null,
    fileExists: async (p) => p.includes("opencode.json"),
    readJson: async () => config,
    writeFile: async (_p, data) => {
      written = data;
    },
    copyDir: async () => {},
    mkdirp: async () => {},
    exec: async () => ({ exitCode: 0 }),
    log: () => {},
    pluginDir: "/fake",
    getWorkerPort: () => 37777,
  };
  return { deps, getWritten: () => written };
}

describe("configureCommands", () => {
  it("fresh install: no command key → writes all 4 commands, returns success", async () => {
    const { deps, getWritten } = createMockConfig({});

    const result = await configureCommands(deps);

    expect(result.status).toBe("success");
    expect(result.message).toContain("4");
    const parsed = JSON.parse(getWritten()!);
    expect(Object.keys(parsed.command)).toEqual(
      expect.arrayContaining(["mem-search", "mem-save", "mem-status", "mem-timeline"]),
    );
    expect(Object.keys(parsed.command)).toHaveLength(4);
  });

  it("all exist: all 4 commands already present → returns skipped", async () => {
    const { deps } = createMockConfig({
      command: {
        "mem-search": { description: "existing", template: "existing" },
        "mem-save": { description: "existing", template: "existing" },
        "mem-status": { description: "existing", template: "existing" },
        "mem-timeline": { description: "existing", template: "existing" },
      },
    });

    const result = await configureCommands(deps);

    expect(result.status).toBe("skipped");
    expect(result.message).toContain("already configured");
  });

  it("partial: 2 commands exist → adds only missing 2, returns success with count", async () => {
    const { deps, getWritten } = createMockConfig({
      command: {
        "mem-search": { description: "existing", template: "existing" },
        "mem-save": { description: "existing", template: "existing" },
      },
    });

    const result = await configureCommands(deps);

    expect(result.status).toBe("success");
    expect(result.message).toContain("2");
    const parsed = JSON.parse(getWritten()!);
    // All 4 should be present
    expect(Object.keys(parsed.command)).toHaveLength(4);
    // Existing ones preserved with original values
    expect(parsed.command["mem-search"]).toEqual({ description: "existing", template: "existing" });
    expect(parsed.command["mem-save"]).toEqual({ description: "existing", template: "existing" });
    // New ones added
    expect(parsed.command["mem-status"]).toBeDefined();
    expect(parsed.command["mem-timeline"]).toBeDefined();
  });

  it("preserves existing: mystatus command exists → preserved alongside new mem-* commands", async () => {
    const { deps, getWritten } = createMockConfig({
      command: {
        mystatus: { description: "my custom command", template: "do stuff" },
      },
    });

    const result = await configureCommands(deps);

    expect(result.status).toBe("success");
    const parsed = JSON.parse(getWritten()!);
    // Custom command preserved
    expect(parsed.command.mystatus).toEqual({ description: "my custom command", template: "do stuff" });
    // All 4 mem commands added
    expect(parsed.command["mem-search"]).toBeDefined();
    expect(parsed.command["mem-save"]).toBeDefined();
    expect(parsed.command["mem-status"]).toBeDefined();
    expect(parsed.command["mem-timeline"]).toBeDefined();
  });

  it("no opencode.json: fileExists returns false → returns failed", async () => {
    const { deps, getWritten } = createMockConfig({});
    deps.fileExists = async () => false;

    const result = await configureCommands(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("not found");
    expect(getWritten()).toBeNull();
  });

  it("invalid JSON: readJson throws → returns failed", async () => {
    const { deps, getWritten } = createMockConfig({});
    deps.readJson = async () => {
      throw new SyntaxError("Unexpected token");
    };

    const result = await configureCommands(deps);

    expect(result.status).toBe("failed");
    expect(result.message).toContain("invalid JSON");
    expect(getWritten()).toBeNull();
  });
});
