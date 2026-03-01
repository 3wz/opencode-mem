import { homedir } from "node:os";
import { join } from "node:path";
import type { SetupDeps, SetupStepResult } from "../types.js";
import { getMcpServerPath } from "../../utils/detect.js";
import { generateMcpConfig } from "../../mcp-config.js";

const OPENCODE_CONFIG_PATH = join(homedir(), ".config", "opencode", "opencode.json");

/**
 * Add claude-mem MCP configuration to opencode.json.
 * - Fresh install (no entry): adds type: "local" config
 * - Migration (existing type: "remote"): replaces with type: "local"
 * - Already correct (type: "local"): skips with message
 * - mcp-server.cjs not found: returns failed status
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

    // Check existing claude-mem MCP entry for idempotency / migration
    const mcp = config.mcp as Record<string, unknown> | undefined;
    const existing = mcp?.["claude-mem"] as Record<string, unknown> | undefined;

    if (existing?.type === "local") {
      return { status: "skipped", message: "claude-mem MCP already configured (type: local)" };
    }

    // Discover mcp-server.cjs path
    const mcpServerPath = getMcpServerPath();
    if (!mcpServerPath) {
      return { status: "failed", message: "mcp-server.cjs not found. Ensure claude-mem is installed." };
    }

    // Generate local MCP config entry
    const mcpEntry = generateMcpConfig(mcpServerPath);

    // Add or replace claude-mem MCP entry (preserving all existing config)
    const updatedConfig = {
      ...config,
      mcp: {
        ...(mcp ?? {}),
        ...mcpEntry,
      },
    };

    await deps.writeFile(OPENCODE_CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));

    const action = existing?.type === "remote" ? "migrated from remote to local" : "added";
    deps.log(`claude-mem MCP ${action} in opencode.json. Restart opencode to activate memory search tools.`, "info");

    return { status: "success", message: `claude-mem MCP configured in opencode.json (${action})` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", message: `Failed to configure MCP: ${message}` };
  }
}
