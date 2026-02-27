import { homedir } from "node:os";
import { join } from "node:path";
import type { SetupDeps, SetupStepResult } from "../types.js";

/**
 * Copy the mem-search skill to the user's opencode skills directory.
 * Source: {pluginDir}/skills/mem-search/
 * Destination: ~/.config/opencode/skills/mem-search/
 * Idempotent: skips if destination already exists.
 * NEVER overwrites existing skill files (user may have customized).
 */
export async function copySkills(deps: SetupDeps): Promise<SetupStepResult> {
  try {
    const source = join(deps.pluginDir, "skills", "mem-search");
    const destination = join(homedir(), ".config", "opencode", "skills", "mem-search");
    const skillsDir = join(homedir(), ".config", "opencode", "skills");

    // Skip if destination already exists (don't overwrite user customizations)
    const destExists = await deps.fileExists(destination);
    if (destExists) {
      return { status: "skipped", message: "mem-search skill already installed" };
    }

    // Check source exists
    const sourceExists = await deps.fileExists(source);
    if (!sourceExists) {
      return { status: "failed", message: `Source skill not found at ${source}` };
    }

    // Create parent directory
    await deps.mkdirp(skillsDir);

    // Copy skill
    deps.log("Copying mem-search skill to opencode skills directory...", "info");
    await deps.copyDir(source, destination, { recursive: true });
    deps.log("mem-search skill installed successfully", "info");

    return { status: "success", message: `mem-search skill copied to ${destination}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", message: `Failed to copy skills: ${message}` };
  }
}
