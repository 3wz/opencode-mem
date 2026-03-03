import { describe, it, expect, mock } from "bun:test";
import { runSetup } from "./runner.js";
import { parseArgs } from "./args.js";
import { NonTuiAdapter } from "./non-tui.js";
import type { CliOptions, CliAdapter } from "./types.js";
import type { SetupDeps } from "../setup/types.js";

function makeMockDeps(overrides: Partial<SetupDeps> = {}): SetupDeps {
  return {
    which: () => "/usr/local/bin/claude-mem",
    fileExists: async () => true,
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

describe("CLI Integration: parseArgs → runSetup → adapter", () => {
  it("executes full success flow: parseArgs → runSetup → adapter calls all lifecycle methods", async () => {
    const introMock = mock(() => {});
    const stepMock = mock(() => {});
    const outroMock = mock(() => {});

    const adapter: CliAdapter = {
      intro: introMock,
      step: stepMock,
      outro: outroMock,
    };

    const argv: string[] = ["--no-tui"];
    const options = parseArgs(argv);
    const deps = makeMockDeps();

    await runSetup(options, adapter, deps);

    expect(introMock).toHaveBeenCalledTimes(1);
    expect(stepMock).toHaveBeenCalledTimes(6);
    expect(outroMock).toHaveBeenCalledTimes(1);
  });

  it("handles failure flow: adapter.outro called with success=false when step fails", async () => {
    let outroSuccess = true;
    const outroMock = mock((success: boolean) => {
      outroSuccess = success;
    });

    const adapter: CliAdapter = {
      intro: () => {},
      step: () => {},
      outro: outroMock,
    };

    const argv: string[] = [];
    const options = parseArgs(argv);
    const deps = makeMockDeps({
      startWorker: async () => false,
    });

    await runSetup(options, adapter, deps);

    expect(outroMock).toHaveBeenCalledTimes(1);
    expect(outroSuccess).toBe(false);
  });

  it("--skip-worker flag: startWorker not called when skipWorker=true", async () => {
    let startWorkerCalled = false;

    const adapter: CliAdapter = {
      intro: () => {},
      step: () => {},
      outro: () => {},
    };

    const argv: string[] = ["--skip-worker"];
    const options = parseArgs(argv);
    const deps = makeMockDeps({
      startWorker: async () => {
        startWorkerCalled = true;
        return true;
      },
    });

    await runSetup(options, adapter, deps);

    expect(startWorkerCalled).toBe(false);
  });

  it("--port flag: custom port forwarded to setup deps", async () => {
    let portUsed = 0;

    const adapter: CliAdapter = {
      intro: () => {},
      step: () => {},
      outro: () => {},
    };

    const argv: string[] = ["--port", "9999"];
    const options = parseArgs(argv);
    const deps = makeMockDeps({
      startWorker: async (port: number) => {
        portUsed = port;
        return true;
      },
    });

    await runSetup(options, adapter, deps);

    expect(portUsed).toBe(9999);
  });

  it("--help flag: parseArgs returns help=true", () => {
    const argv: string[] = ["--help"];
    const options = parseArgs(argv);

    expect(options.help).toBe(true);
  });

  it("--no-tui flag: parseArgs returns noTui=true", () => {
    const argv: string[] = ["--no-tui"];
    const options = parseArgs(argv);

    expect(options.noTui).toBe(true);
  });

  it("default args: parseArgs returns correct defaults", () => {
    const argv: string[] = [];
    const options = parseArgs(argv);

    expect(options.noTui).toBe(false);
    expect(options.port).toBe(37777);
    expect(options.skipWorker).toBe(false);
    expect(options.help).toBe(false);
  });

  it("combined flags: --no-tui --port 9999 --skip-worker all parsed correctly", () => {
    const argv: string[] = ["--no-tui", "--port", "9999", "--skip-worker"];
    const options = parseArgs(argv);

    expect(options.noTui).toBe(true);
    expect(options.port).toBe(9999);
    expect(options.skipWorker).toBe(true);
    expect(options.help).toBe(false);
  });

  it("invalid port: parseArgs falls back to 37777 for invalid port value", () => {
    const argv: string[] = ["--port", "invalid"];
    const options = parseArgs(argv);

    expect(options.port).toBe(37777);
  });

  it("adapter.intro() called at start of runSetup", async () => {
    const callOrder: string[] = [];

    const adapter: CliAdapter = {
      intro: () => {
        callOrder.push("intro");
      },
      step: () => {
        callOrder.push("step");
      },
      outro: () => {
        callOrder.push("outro");
      },
    };

    const options = parseArgs([]);
    const deps = makeMockDeps();

    await runSetup(options, adapter, deps);

    expect(callOrder[0]).toBe("intro");
  });

  it("adapter.step() called 6 times for each setup step", async () => {
    const stepCalls: Array<[string, string, string]> = [];

    const adapter: CliAdapter = {
      intro: () => {},
      step: (name: string, status: string, message: string) => {
        stepCalls.push([name, status, message]);
      },
      outro: () => {},
    };

    const options = parseArgs([]);
    const deps = makeMockDeps();

    await runSetup(options, adapter, deps);

    expect(stepCalls.length).toBe(6);
    expect(stepCalls[0][0]).toBe("binary");
    expect(stepCalls[1][0]).toBe("install");
    expect(stepCalls[2][0]).toBe("mcp");
    expect(stepCalls[3][0]).toBe("commands");
    expect(stepCalls[4][0]).toBe("skills");
    expect(stepCalls[5][0]).toBe("worker");
  });

  it("NonTuiAdapter integration: works with runSetup without errors", async () => {
    const adapter = new NonTuiAdapter();
    const options = parseArgs(["--no-tui"]);
    const deps = makeMockDeps();

    const result = await runSetup(options, adapter, deps);

    expect(result).toBeDefined();
    expect(result).toHaveProperty("binary");
    expect(result).toHaveProperty("worker");
  });

  it("port out of range (too high): parseArgs falls back to 37777", () => {
    const argv: string[] = ["--port", "99999"];
    const options = parseArgs(argv);

    expect(options.port).toBe(37777);
  });

  it("port out of range (too low): parseArgs falls back to 37777", () => {
    const argv: string[] = ["--port", "0"];
    const options = parseArgs(argv);

    expect(options.port).toBe(37777);
  });

  it("multiple --port flags: last port value wins", () => {
    const argv: string[] = ["--port", "8888", "--port", "9999"];
    const options = parseArgs(argv);

    expect(options.port).toBe(9999);
  });

  it("unknown flags: silently ignored by parseArgs", () => {
    const argv: string[] = ["--unknown-flag", "--another-unknown"];
    const options = parseArgs(argv);

    expect(options.noTui).toBe(false);
    expect(options.port).toBe(37777);
    expect(options.skipWorker).toBe(false);
    expect(options.help).toBe(false);
  });

  it("adapter.outro() called at end of runSetup", async () => {
    const callOrder: string[] = [];

    const adapter: CliAdapter = {
      intro: () => {
        callOrder.push("intro");
      },
      step: () => {
        callOrder.push("step");
      },
      outro: () => {
        callOrder.push("outro");
      },
    };

    const options = parseArgs([]);
    const deps = makeMockDeps();

    await runSetup(options, adapter, deps);

    expect(callOrder[callOrder.length - 1]).toBe("outro");
  });

  it("--port flag without value: falls back to 37777", () => {
    const argv: string[] = ["--port"];
    const options = parseArgs(argv);

    expect(options.port).toBe(37777);
  });

  it("full pipeline with all flags: --help --no-tui --port 8888 --skip-worker", () => {
    const argv: string[] = ["--help", "--no-tui", "--port", "8888", "--skip-worker"];
    const options = parseArgs(argv);

    expect(options.help).toBe(true);
    expect(options.noTui).toBe(true);
    expect(options.port).toBe(8888);
    expect(options.skipWorker).toBe(true);
  });

  it("adapter.step() receives valid status values (success/skipped/failed)", async () => {
    const statuses: string[] = [];

    const adapter: CliAdapter = {
      intro: () => {},
      step: (name: string, status: string) => {
        statuses.push(status);
      },
      outro: () => {},
    };

    const options = parseArgs([]);
    const deps = makeMockDeps();

    await runSetup(options, adapter, deps);

    statuses.forEach((status) => {
      expect(["success", "skipped", "failed"]).toContain(status);
    });
  });
});
