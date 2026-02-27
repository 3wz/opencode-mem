import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { ClaudeMemClient } from "./client.js";

/**
 * Check if the claude-mem worker is currently running.
 */
export async function isWorkerRunning(port = 37777): Promise<boolean> {
  const client = new ClaudeMemClient(port, 1000);
  return client.healthCheck(1);
}

/**
 * Get the command to start the claude-mem worker.
 * Tries multiple discovery strategies.
 */
export function getWorkerCommand(): { cmd: string; args: string[] } | null {
  // Strategy 1: Try claude-mem global npm install location
  const claudePluginPath = join(
    homedir(),
    ".claude",
    "node_modules",
    ".bin",
    "claude-mem",
  );
  if (existsSync(claudePluginPath)) {
    return { cmd: claudePluginPath, args: ["worker:start"] };
  }

  // Strategy 2: Try bunx (globally available in opencode environment)
  return { cmd: "bunx", args: ["claude-mem", "worker:start"] };
}

/**
 * Start the claude-mem worker if not already running.
 * Idempotent — does nothing if worker is already running.
 * Returns true if worker is running after this call.
 */
export async function startWorker(
  port = 37777,
  timeoutMs = 10000,
): Promise<boolean> {
  // Idempotency check
  if (await isWorkerRunning(port)) return true;

  const workerCmd = getWorkerCommand();
  if (!workerCmd) return false;

  try {
    // Spawn detached — fire and forget
    const proc = Bun.spawn([workerCmd.cmd, ...workerCmd.args], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
    });
    proc.unref(); // Don't keep process alive waiting for worker

    // Wait for worker to be ready (poll with timeout)
    const start = Date.now();
    const interval = 500; // Poll every 500ms
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, interval));
      if (await isWorkerRunning(port)) return true;
    }

    return false;
  } catch {
    return false;
  }
}
