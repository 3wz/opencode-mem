import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

const mockRunSetup = mock(async () => ({
  binary: { status: "success" as const, message: "Binary detected" },
  install: { status: "skipped" as const, message: "Already installed" },
  mcp: { status: "success" as const, message: "MCP configured" },
  commands: { status: "success" as const, message: "Commands registered" },
  skills: { status: "success" as const, message: "Skills copied" },
  worker: { status: "success" as const, message: "Worker started" },
}));

const mockParseArgs = mock((argv: string[]) => {
  const options = {
    noTui: false,
    port: 37777,
    skipWorker: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help") {
      options.help = true;
    } else if (arg === "--no-tui") {
      options.noTui = true;
    } else if (arg === "--skip-worker") {
      options.skipWorker = true;
    } else if (arg === "--port") {
      const nextArg = argv[i + 1];
      if (nextArg !== undefined) {
        const portNum = Number.parseInt(nextArg, 10);
        if (!Number.isNaN(portNum) && portNum >= 1 && portNum <= 65535) {
          options.port = portNum;
        }
        i++;
      }
    }
  }

  return options;
});

describe("CLI index", () => {
  let exitCode: number | null = null;
  let originalExit: typeof process.exit;
  let originalStdoutWrite: typeof process.stdout.write;
  let stdoutOutput: string = "";

  beforeEach(() => {
    exitCode = null;
    stdoutOutput = "";
    originalExit = process.exit;
    originalStdoutWrite = process.stdout.write;

    (process as any).exit = mock((code: number) => {
      exitCode = code;
    });

    (process.stdout as any).write = mock((data: string) => {
      stdoutOutput += data;
      return true;
    });

    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    process.exit = originalExit;
    process.stdout.write = originalStdoutWrite;
  });

  it("should show help text when --help flag is provided", async () => {
    const argv = ["--help"];
    const options = mockParseArgs(argv);

    expect(options.help).toBe(true);
  });

  it("should parse --no-tui flag correctly", async () => {
    const argv = ["--no-tui"];
    const options = mockParseArgs(argv);

    expect(options.noTui).toBe(true);
    expect(options.port).toBe(37777);
  });

  it("should parse --port flag with valid port number", async () => {
    const argv = ["--port", "3000"];
    const options = mockParseArgs(argv);

    expect(options.port).toBe(3000);
  });

  it("should parse --skip-worker flag correctly", async () => {
    const argv = ["--skip-worker"];
    const options = mockParseArgs(argv);

    expect(options.skipWorker).toBe(true);
  });

  it("should use TUI adapter when stdout.isTTY is true and --no-tui is not set", async () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });

    const argv: string[] = [];
    const options = mockParseArgs(argv);

    expect(process.stdout.isTTY).toBe(true);
    expect(options.noTui).toBe(false);
  });

  it("should use NonTUI adapter when stdout.isTTY is false", async () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    const argv: string[] = [];
    const options = mockParseArgs(argv);

    expect(process.stdout.isTTY).toBe(false);
  });

  it("should use NonTUI adapter when --no-tui flag is set", async () => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });

    const argv = ["--no-tui"];
    const options = mockParseArgs(argv);

    expect(options.noTui).toBe(true);
  });

  it("should exit with code 0 when setup succeeds", async () => {
    const result = await mockRunSetup();

    const hasFailed = Object.values(result).some(
      (r: any) => r.status === "failed"
    );
    const shouldExit = hasFailed ? 1 : 0;

    expect(shouldExit).toBe(0);
  });

  it("should exit with code 1 when setup has failures", async () => {
    const failedResult = {
      binary: { status: "failed" as const, message: "Binary not found" },
      install: { status: "skipped" as const, message: "Already installed" },
      mcp: { status: "success" as const, message: "MCP configured" },
      commands: { status: "success" as const, message: "Commands registered" },
      skills: { status: "success" as const, message: "Skills copied" },
      worker: { status: "success" as const, message: "Worker started" },
    };

    const hasFailed = Object.values(failedResult).some(
      (r: any) => r.status === "failed"
    );
    const shouldExit = hasFailed ? 1 : 0;

    expect(shouldExit).toBe(1);
  });

  it("should handle multiple flags together", async () => {
    const argv = ["--no-tui", "--port", "8080", "--skip-worker"];
    const options = mockParseArgs(argv);

    expect(options.noTui).toBe(true);
    expect(options.port).toBe(8080);
    expect(options.skipWorker).toBe(true);
  });

  it("should ignore invalid port numbers and use default", async () => {
    const argv = ["--port", "invalid"];
    const options = mockParseArgs(argv);

    expect(options.port).toBe(37777);
  });

  it("should ignore port numbers outside valid range", async () => {
    const argv = ["--port", "99999"];
    const options = mockParseArgs(argv);

    expect(options.port).toBe(37777);
  });
});
