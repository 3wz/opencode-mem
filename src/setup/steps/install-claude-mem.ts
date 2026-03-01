import type { SetupDeps, SetupStepResult } from "../types.js";

/**
 * Install claude-mem via npm if not already installed.
 * Idempotent: skips if already found in PATH.
 * Returns "skipped" if already installed, "success" if newly installed, "failed" on error.
 */
export async function installClaudeMem(deps: SetupDeps): Promise<SetupStepResult> {
  try {
    // Check if already installed
    const binaryPath = deps.which("claude-mem");
    if (binaryPath) {
      return { status: "skipped", message: "claude-mem already installed" };
    }

    // Install via npm
    deps.log("Installing claude-mem...", "info");
    const result = await deps.exec(["npm", "install", "-g", "claude-mem"]);

    if (result.exitCode === 0) {
      const installedPath = deps.which("claude-mem");
      if (!installedPath) {
        deps.log("npm install succeeded but claude-mem is not in PATH", "warn");
        return { status: "failed", message: "npm install succeeded but claude-mem is not in PATH" };
      }
      deps.log("claude-mem installed successfully", "info");
      return { status: "success", message: "claude-mem installed successfully via npm" };
    } else {
      deps.log("Failed to install claude-mem", "warn");
      return { status: "failed", message: `npm install failed with exit code ${result.exitCode}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", message: `Failed to install claude-mem: ${message}` };
  }
}
