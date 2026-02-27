import type { SetupDeps, SetupResult, SetupStepResult } from "./types.js";
import { detectBinary as detectBinaryDefault } from "./steps/detect-binary.js";
import { installClaudeMem as installClaudeMemDefault } from "./steps/install-claude-mem.js";
import { configureMcp as configureMcpDefault } from "./steps/configure-mcp.js";
import { copySkills as copySkillsDefault } from "./steps/copy-skills.js";
import { startWorker as startWorkerFallback } from "../worker-manager.js";

export interface AutoSetupSteps {
  detectBinary: (deps: SetupDeps) => Promise<SetupStepResult>;
  installClaudeMem: (deps: SetupDeps) => Promise<SetupStepResult>;
  configureMcp: (deps: SetupDeps) => Promise<SetupStepResult>;
  copySkills: (deps: SetupDeps) => Promise<SetupStepResult>;
}

const defaultSteps: AutoSetupSteps = {
  detectBinary: detectBinaryDefault,
  installClaudeMem: installClaudeMemDefault,
  configureMcp: configureMcpDefault,
  copySkills: copySkillsDefault,
};

async function runStep(
  name: string,
  fn: () => Promise<SetupStepResult>,
  deps: SetupDeps,
): Promise<SetupStepResult> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.log(`Step "${name}" threw: ${message}`, "error");
    return { status: "failed", message };
  }
}

/** NEVER throws — entire body wrapped in try-catch. */
export async function autoSetup(
  deps: SetupDeps,
  steps: AutoSetupSteps = defaultSteps,
): Promise<SetupResult> {
  try {
    const binary = await runStep("detectBinary", () => steps.detectBinary(deps), deps);

    let install: SetupStepResult;
    if (binary.status === "success") {
      install = { status: "skipped", message: "claude-mem already detected — skipping install" };
    } else {
      install = await runStep("installClaudeMem", () => steps.installClaudeMem(deps), deps);
    }

    const mcp = await runStep("configureMcp", () => steps.configureMcp(deps), deps);

    const skills = await runStep("copySkills", () => steps.copySkills(deps), deps);

    const worker = await runStep("startWorker", async () => {
      const port = deps.getWorkerPort();
      const startFn = deps.startWorker ?? ((p: number) => startWorkerFallback(p));
      const running = await startFn(port);
      return running
        ? { status: "success" as const, message: `Worker running on port ${port}` }
        : { status: "failed" as const, message: `Worker failed to start on port ${port}` };
    }, deps);

    const allResults = [binary, install, mcp, skills, worker];
    const succeeded = allResults.filter((r) => r.status === "success").length;
    const skipped = allResults.filter((r) => r.status === "skipped").length;
    const failed = allResults.filter((r) => r.status === "failed").length;
    deps.log(`Setup complete: ${succeeded} succeeded, ${skipped} skipped, ${failed} failed`, "info");

    return { binary, install, mcp, skills, worker };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.log(`Setup failed catastrophically: ${message}`, "error");
    const fail: SetupStepResult = { status: "failed", message };
    return { binary: fail, install: fail, mcp: fail, skills: fail, worker: fail };
  }
}
