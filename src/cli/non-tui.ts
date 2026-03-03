import { CliAdapter } from "./types.js";

/**
 * Non-TUI CLI adapter for plain text output
 * Outputs setup progress to stdout without colors or interactive elements
 */
export class NonTuiAdapter implements CliAdapter {
  private stepCount = 0;
  private totalSteps = 6;

  intro(): void {
    process.stdout.write("\n");
    process.stdout.write("╔════════════════════════════════════════════════════════════╗\n");
    process.stdout.write("║                                                            ║\n");
    process.stdout.write("║          opencode-claude-mem Installation Wizard           ║\n");
    process.stdout.write("║                                                            ║\n");
    process.stdout.write("║  Persistent memory for OpenCode, powered by claude-mem     ║\n");
    process.stdout.write("║                                                            ║\n");
    process.stdout.write("╚════════════════════════════════════════════════════════════╝\n");
    process.stdout.write("\n");
  }

  step(name: string, status: "success" | "skipped" | "failed", message: string): void {
    this.stepCount++;
    const symbol = status === "success" ? "✓" : status === "failed" ? "✗" : "⚠";
    const line = `[${this.stepCount}/${this.totalSteps}] ${name}... ${symbol} ${message}\n`;
    process.stdout.write(line);
  }

  outro(success: boolean, message: string): void {
    process.stdout.write("\n");
    if (success) {
      process.stdout.write("╔════════════════════════════════════════════════════════════╗\n");
      process.stdout.write("║                                                            ║\n");
      process.stdout.write("║                    Setup Completed! ✓                      ║\n");
      process.stdout.write("║                                                            ║\n");
      process.stdout.write("╚════════════════════════════════════════════════════════════╝\n");
    } else {
      process.stdout.write("╔════════════════════════════════════════════════════════════╗\n");
      process.stdout.write("║                                                            ║\n");
      process.stdout.write("║                    Setup Failed ✗                          ║\n");
      process.stdout.write("║                                                            ║\n");
      process.stdout.write("╚════════════════════════════════════════════════════════════╝\n");
    }
    process.stdout.write(`\n${message}\n\n`);
  }
}
