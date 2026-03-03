import { autoSetup } from "../setup/auto-setup.js";
import { createDefaultDeps } from "../setup/types.js";
import type { CliOptions, CliAdapter } from "./types.js";
import type { SetupDeps, SetupResult } from "../setup/types.js";

/**
 * Run the setup process with CLI adapter and custom dependencies.
 *
 * Steps:
 * 1. Call adapter.intro() at start
 * 2. Build custom SetupDeps based on createDefaultDeps() with overrides:
 *    - Override getWorkerPort to return options.port
 *    - If skipWorker is true: override startWorker with noop
 * 3. Call autoSetup(deps) with custom deps
 * 4. Map each step result to adapter.step() calls
 * 5. Call adapter.outro() at end with success status
 * 6. Return the SetupResult
 */
export async function runSetup(
  options: CliOptions,
  adapter: CliAdapter,
  deps?: SetupDeps,
): Promise<SetupResult> {
  adapter.intro();

  // Use provided deps or create default ones
  const baseDeps = deps || createDefaultDeps((msg) => {});

  // Build custom deps with overrides
  const customDeps: SetupDeps = {
    ...baseDeps,
    getWorkerPort: () => options.port,
    startWorker: options.skipWorker
      ? async () => true // noop when skipWorker is true
      : baseDeps.startWorker,
  };

  // Run setup
  const result = await autoSetup(customDeps);

  // Map results to adapter.step() calls
  adapter.step("binary", result.binary.status, result.binary.message);
  adapter.step("install", result.install.status, result.install.message);
  adapter.step("mcp", result.mcp.status, result.mcp.message);
  adapter.step("commands", result.commands.status, result.commands.message);
  adapter.step("skills", result.skills.status, result.skills.message);
  adapter.step("worker", result.worker.status, result.worker.message);

  // Determine overall success (no failures)
  const allSteps = [
    result.binary,
    result.install,
    result.mcp,
    result.commands,
    result.skills,
    result.worker,
  ];
  const hasFailed = allSteps.some((step) => step.status === "failed");
  const success = !hasFailed;

  // Call outro with success status and summary message
  const message = success
    ? "Setup completed successfully"
    : "Setup completed with failures";
  adapter.outro(success, message);

  return result;
}
