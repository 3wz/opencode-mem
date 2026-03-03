/**
 * CLI options for the opencode-claude-mem installation wizard
 */
export interface CliOptions {
  noTui: boolean;
  port: number;
  skipWorker: boolean;
  help: boolean;
}

/**
 * CLI adapter interface for different output modes (TUI, non-TUI, etc.)
 */
export interface CliAdapter {
  intro(): void;
  step(name: string, status: "success" | "skipped" | "failed", message: string): void;
  outro(success: boolean, message: string): void;
}
