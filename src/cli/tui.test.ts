import { describe, it, expect, mock, beforeEach } from "bun:test";
import { TuiAdapter } from "./tui";

// Mock @clack/prompts module
const mockIntro = mock((title: string) => {});
const mockOutro = mock((message: string) => {});
const mockSuccess = mock((msg: string) => {});
const mockWarn = mock((msg: string) => {});
const mockError = mock((msg: string) => {});
const mockIsCancel = mock(() => false);
const mockCancel = mock((message: string) => {});

mock.module("@clack/prompts", () => ({
  intro: mockIntro,
  outro: mockOutro,
  log: {
    success: mockSuccess,
    warn: mockWarn,
    error: mockError,
  },
  isCancel: mockIsCancel,
  cancel: mockCancel,
}));

describe("TuiAdapter", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockIntro.mockClear();
    mockOutro.mockClear();
    mockSuccess.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockIsCancel.mockClear();
    mockCancel.mockClear();
  });

  it("intro() calls p.intro() with title", () => {
    const adapter = new TuiAdapter();
    adapter.intro();

    expect(mockIntro).toHaveBeenCalled();
    expect(mockIntro).toHaveBeenCalledTimes(1);
  });

  it("step() with success status calls p.log.success()", () => {
    const adapter = new TuiAdapter();
    adapter.step("Detecting claude-mem", "success", "Found at /usr/local/bin");

    expect(mockSuccess).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalledTimes(1);
    const calls = mockSuccess.mock.calls as unknown[][];
    const message = calls[0][0] as string;
    expect(message).toContain("Detecting claude-mem");
    expect(message).toContain("Found at /usr/local/bin");
  });

  it("step() with failed status calls p.log.error()", () => {
    const adapter = new TuiAdapter();
    adapter.step("Installing claude-mem", "failed", "npm not found");

    expect(mockError).toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledTimes(1);
    const calls = mockError.mock.calls as unknown[][];
    const message = calls[0][0] as string;
    expect(message).toContain("Installing claude-mem");
    expect(message).toContain("npm not found");
  });

  it("step() with skipped status calls p.log.warn()", () => {
    const adapter = new TuiAdapter();
    adapter.step("Configuring MCP", "skipped", "Already configured");

    expect(mockWarn).toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const calls = mockWarn.mock.calls as unknown[][];
    const message = calls[0][0] as string;
    expect(message).toContain("Configuring MCP");
    expect(message).toContain("Already configured");
  });

  it("outro() with success calls p.outro() with success message", () => {
    const adapter = new TuiAdapter();
    adapter.outro(true, "Setup completed successfully");

    expect(mockOutro).toHaveBeenCalled();
    expect(mockOutro).toHaveBeenCalledTimes(1);
    const calls = mockOutro.mock.calls as unknown[][];
    const message = calls[0][0] as string;
    expect(message).toContain("Setup completed successfully");
  });

  it("outro() with failure calls p.outro() with failure message", () => {
    const adapter = new TuiAdapter();
    adapter.outro(false, "Setup failed: npm not found");

    expect(mockOutro).toHaveBeenCalled();
    expect(mockOutro).toHaveBeenCalledTimes(1);
    const calls = mockOutro.mock.calls as unknown[][];
    const message = calls[0][0] as string;
    expect(message).toContain("Setup failed: npm not found");
  });

  it("step() increments step counter and includes it in message", () => {
    const adapter = new TuiAdapter();
    adapter.step("Step 1", "success", "Done");
    adapter.step("Step 2", "success", "Done");

    expect(mockSuccess).toHaveBeenCalledTimes(2);
    const calls = mockSuccess.mock.calls as unknown[][];
    const msg1 = calls[0][0] as string;
    const msg2 = calls[1][0] as string;
    expect(msg1).toContain("[1/6]");
    expect(msg2).toContain("[2/6]");
  });

  it("implements CliAdapter interface with all required methods", () => {
    const adapter = new TuiAdapter();
    expect(typeof adapter.intro).toBe("function");
    expect(typeof adapter.step).toBe("function");
    expect(typeof adapter.outro).toBe("function");
  });

  it("handles multiple steps in sequence without errors", () => {
    const adapter = new TuiAdapter();
    adapter.intro();
    adapter.step("Detect", "success", "Found");
    adapter.step("Install", "success", "Done");
    adapter.step("Configure", "skipped", "Already done");
    adapter.outro(true, "All done");

    expect(mockIntro).toHaveBeenCalledTimes(1);
    expect(mockSuccess).toHaveBeenCalledTimes(2);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockOutro).toHaveBeenCalledTimes(1);
  });

  it("step() message includes step number and total steps", () => {
    const adapter = new TuiAdapter();
    adapter.step("Test Step", "success", "Message");

    const calls = mockSuccess.mock.calls as unknown[][];
    const message = calls[0][0] as string;
    expect(message.match(/\[\d+\/6\]/)).toBeTruthy();
  });
});
