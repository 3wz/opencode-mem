import { describe, it, expect } from "bun:test";
import { NonTuiAdapter } from "./non-tui";

describe("NonTuiAdapter", () => {
  it("intro() outputs welcome banner", () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => {
      writes.push(s);
      return true;
    };

    const adapter = new NonTuiAdapter();
    adapter.intro();

    process.stdout.write = origWrite;
    const output = writes.join("");
    expect(output).toContain("opencode-claude-mem");
  });

  it("step() with success status outputs checkmark", () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => {
      writes.push(s);
      return true;
    };

    const adapter = new NonTuiAdapter();
    adapter.step("Detecting claude-mem", "success", "Found at /usr/local/bin");

    process.stdout.write = origWrite;
    const output = writes.join("");
    expect(output).toContain("✓");
    expect(output).toContain("Detecting claude-mem");
    expect(output).toContain("Found at /usr/local/bin");
  });

  it("step() with failed status outputs cross mark", () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => {
      writes.push(s);
      return true;
    };

    const adapter = new NonTuiAdapter();
    adapter.step("Installing claude-mem", "failed", "npm not found");

    process.stdout.write = origWrite;
    const output = writes.join("");
    expect(output).toContain("✗");
    expect(output).toContain("Installing claude-mem");
    expect(output).toContain("npm not found");
  });

  it("step() with skipped status outputs warning symbol", () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => {
      writes.push(s);
      return true;
    };

    const adapter = new NonTuiAdapter();
    adapter.step("Configuring MCP", "skipped", "Already configured");

    process.stdout.write = origWrite;
    const output = writes.join("");
    expect(output).toContain("⚠");
    expect(output).toContain("Configuring MCP");
    expect(output).toContain("Already configured");
  });

  it("outro() with success outputs completion message", () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => {
      writes.push(s);
      return true;
    };

    const adapter = new NonTuiAdapter();
    adapter.outro(true, "Setup completed successfully");

    process.stdout.write = origWrite;
    const output = writes.join("");
    expect(output).toContain("Setup completed successfully");
  });

  it("outro() with failure outputs error message", () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => {
      writes.push(s);
      return true;
    };

    const adapter = new NonTuiAdapter();
    adapter.outro(false, "Setup failed: npm not found");

    process.stdout.write = origWrite;
    const output = writes.join("");
    expect(output).toContain("Setup failed: npm not found");
  });
});
