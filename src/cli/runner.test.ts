import { describe, it, expect, mock } from "bun:test";
import { runSetup } from "./runner.js";
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

describe("runSetup", () => {
  it("calls adapter.intro() at start", async () => {
    const introMock = mock(() => {});
    const stepMock = mock(() => {});
    const outroMock = mock(() => {});
    const adapter: CliAdapter = {
      intro: introMock,
      step: stepMock,
      outro: outroMock,
    };
    const deps = makeMockDeps();
    const options: CliOptions = {
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    };

    await runSetup(options, adapter, deps);

    expect(introMock).toHaveBeenCalledTimes(1);
  });

  it("calls adapter.step() for each setup step result", async () => {
    const introMock = mock(() => {});
    const stepMock = mock(() => {});
    const outroMock = mock(() => {});
    const adapter: CliAdapter = {
      intro: introMock,
      step: stepMock,
      outro: outroMock,
    };
    const deps = makeMockDeps();
    const options: CliOptions = {
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    };

    await runSetup(options, adapter, deps);

    expect(stepMock).toHaveBeenCalledTimes(6);
  });

  it("calls adapter.outro() at end", async () => {
    const introMock = mock(() => {});
    const stepMock = mock(() => {});
    const outroMock = mock(() => {});
    const adapter: CliAdapter = {
      intro: introMock,
      step: stepMock,
      outro: outroMock,
    };
    const deps = makeMockDeps();
    const options: CliOptions = {
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    };

    await runSetup(options, adapter, deps);

    expect(outroMock).toHaveBeenCalledTimes(1);
  });

  it("returns SetupResult with all step properties", async () => {
    const adapter: CliAdapter = {
      intro: () => {},
      step: () => {},
      outro: () => {},
    };
    const deps = makeMockDeps();
    const options: CliOptions = {
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    };

    const result = await runSetup(options, adapter, deps);

    expect(result).toHaveProperty("binary");
    expect(result).toHaveProperty("install");
    expect(result).toHaveProperty("mcp");
    expect(result).toHaveProperty("commands");
    expect(result).toHaveProperty("skills");
    expect(result).toHaveProperty("worker");
  });

  it("uses options.port instead of deps.getWorkerPort", async () => {
    const adapter: CliAdapter = {
      intro: () => {},
      step: () => {},
      outro: () => {},
    };
    let portUsed = 0;

    const deps = makeMockDeps({
      startWorker: async (port: number) => {
        portUsed = port;
        return true;
      },
    });

    const options: CliOptions = {
      noTui: false,
      port: 9999,
      skipWorker: false,
      help: false,
    };

    await runSetup(options, adapter, deps);

    expect(portUsed).toBe(9999);
  });

  it("replaces startWorker with noop when skipWorker is true", async () => {
    const adapter: CliAdapter = {
      intro: () => {},
      step: () => {},
      outro: () => {},
    };
    let startWorkerCalled = false;

    const deps = makeMockDeps({
      startWorker: async () => {
        startWorkerCalled = true;
        return true;
      },
    });

    const options: CliOptions = {
      noTui: false,
      port: 37777,
      skipWorker: true,
      help: false,
    };

    await runSetup(options, adapter, deps);

    expect(startWorkerCalled).toBe(false);
  });

  it("passes step name, status, and message to adapter.step", async () => {
    const stepMock = mock(() => {});
    const adapter: CliAdapter = {
      intro: () => {},
      step: stepMock,
      outro: () => {},
    };
    const deps = makeMockDeps();
    const options: CliOptions = {
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    };

    await runSetup(options, adapter, deps);

    expect(stepMock).toHaveBeenCalledTimes(6);
    expect(stepMock).toHaveBeenCalledWith(
      "binary",
      expect.stringMatching(/success|skipped|failed/),
      expect.any(String),
    );
  });

  it("calls adapter.outro with success=true when no failures", async () => {
    const outroMock = mock(() => {});
    const adapter: CliAdapter = {
      intro: () => {},
      step: () => {},
      outro: outroMock,
    };
    const deps = makeMockDeps();
    const options: CliOptions = {
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    };

    await runSetup(options, adapter, deps);

    expect(outroMock).toHaveBeenCalledWith(true, expect.any(String));
  });
});
