import { homedir } from "node:os";
import { join } from "node:path";
import type { SetupDeps, SetupStepResult } from "../types.js";

/**
 * Detect if claude-mem binary is installed.
 * Checks both PATH (via which) and the ~/.claude-mem data directory.
 * Returns "success" if either is found, "failed" if neither.
 */
export async function detectBinary(deps: SetupDeps): Promise<SetupStepResult> {
  try {
    // Check PATH for binary
    const binaryPath = deps.which("claude-mem");
    if (binaryPath) {
      return { status: "success", message: `claude-mem found at ${binaryPath}` };
    }

    // Check data directory (installed but not in PATH)
    const dataDir = join(homedir(), ".claude-mem");
    const dataDirExists = await deps.fileExists(dataDir);
    if (dataDirExists) {
      return { status: "success", message: "claude-mem data directory found at ~/.claude-mem" };
    }

    return { status: "failed", message: "claude-mem not found (not in PATH, no ~/.claude-mem directory)" };
  } catch {
    return { status: "failed", message: "Failed to detect claude-mem installation" };
  }
}
