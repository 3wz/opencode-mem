import { homedir } from "node:os";
import { join } from "node:path";
import type { SetupDeps, SetupStepResult } from "../types.js";

const OPENCODE_CONFIG_PATH = join(homedir(), ".config", "opencode", "opencode.json");

/**
 * Add claude-mem MCP configuration to opencode.json if not already present.
 * Idempotent: skips if claude-mem MCP already configured.
 * NEVER overwrites existing config entries.
 * Preserves ALL existing keys in opencode.json.
 */
export async function configureMcp(deps: SetupDeps): Promise<SetupStepResult> {
  try {
    // Read existing opencode.json
    const configExists = await deps.fileExists(OPENCODE_CONFIG_PATH);
    if (!configExists) {
      return { status: "failed", message: "opencode.json not found at ~/.config/opencode/opencode.json" };
    }

    let config: Record<string, unknown>;
    try {
      config = (await deps.readJson(OPENCODE_CONFIG_PATH)) as Record<string, unknown>;
    } catch {
      return { status: "failed", message: "opencode.json contains invalid JSON — skipping MCP configuration" };
    }

    // Check if claude-mem MCP already configured
    const mcp = config.mcp as Record<string, unknown> | undefined;
    if (mcp?.["claude-mem"]) {
      return { status: "skipped", message: "claude-mem MCP already configured in opencode.json" };
    }

    // Add claude-mem MCP entry (preserving all existing config)
    const port = deps.getWorkerPort();
    const updatedConfig = {
      ...config,
      mcp: {
        ...(mcp ?? {}),
        "claude-mem": {
          type: "remote",
          url: `http://localhost:${port}/mcp`,
          enabled: true,
        },
      },
    };

    await deps.writeFile(OPENCODE_CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));
    deps.log("claude-mem MCP added to opencode.json. Restart opencode to activate memory search tools.", "info");

    return { status: "success", message: "claude-mem MCP configured in opencode.json" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", message: `Failed to configure MCP: ${message}` };
  }
}
