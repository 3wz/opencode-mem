import * as p from "@clack/prompts";
import { CliAdapter } from "./types.js";

/**
 * TUI CLI adapter using @clack/prompts for interactive terminal output
 * Displays setup progress with colors and interactive elements
 */
export class TuiAdapter implements CliAdapter {
  private stepCount = 0;
  private totalSteps = 6;

  intro(): void {
    p.intro("opencode-claude-mem Installation Wizard");
  }

  step(name: string, status: "success" | "skipped" | "failed", message: string): void {
    this.stepCount++;
    const stepLabel = `[${this.stepCount}/${this.totalSteps}] ${name}`;
    const fullMessage = `${stepLabel} — ${message}`;

    if (status === "success") {
      p.log.success(fullMessage);
    } else if (status === "failed") {
      p.log.error(fullMessage);
    } else if (status === "skipped") {
      p.log.warn(fullMessage);
    }
  }

  outro(success: boolean, message: string): void {
    if (success) {
      p.outro(`✓ ${message}`);
    } else {
      p.outro(`✗ ${message}`);
    }
  }
}
