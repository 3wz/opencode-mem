import { homedir } from "node:os";
import { join } from "node:path";
import type { SetupDeps, SetupStepResult } from "../types.js";

const OPENCODE_CONFIG_PATH = join(homedir(), ".config", "opencode", "opencode.json");

const COMMAND_TEMPLATES: Record<string, { description: string; template: string }> = {
  "mem-search": {
    description: "Search claude-mem persistent memory",
    template:
      'Search my claude-mem persistent memory for: $ARGUMENTS\n\nUse the claude-mem MCP search tool. Follow the 3-layer workflow:\n1. search(query="$ARGUMENTS") to get an index with IDs\n2. timeline(anchor=ID) for context around interesting results\n3. get_observations([IDs]) for full details\n\nPresent results with observation IDs, titles, and relevant content.',
  },
  "mem-save": {
    description: "Save a manual memory to claude-mem",
    template:
      "Save this to my claude-mem persistent memory: $ARGUMENTS\n\nUse the claude-mem MCP save_memory tool with the text provided. Confirm when saved with the observation ID.",
  },
  "mem-status": {
    description: "Show claude-mem memory status",
    template:
      "Show my claude-mem memory status. Check:\n1. Worker connection (curl http://localhost:37777/health)\n2. Available MCP tools (claude-mem search, timeline, get_observations, save_memory)\n3. Recent memory for this project\n\nPresent as a clean status report.",
  },
  "mem-timeline": {
    description: "Show recent memory timeline",
    template:
      "Show my recent claude-mem memory timeline using the claude-mem MCP timeline tool. Present observations chronologically with IDs and summaries.",
  },
};

/**
 * Add claude-mem command templates to opencode.json.
 * - Only adds commands that don't already exist (idempotent per-key)
 * - Preserves ALL existing keys in opencode.json
 */
export async function configureCommands(deps: SetupDeps): Promise<SetupStepResult> {
  try {
    const configExists = await deps.fileExists(OPENCODE_CONFIG_PATH);
    if (!configExists) {
      return { status: "failed", message: "opencode.json not found at ~/.config/opencode/opencode.json" };
    }

    let config: Record<string, unknown>;
    try {
      const raw = await deps.readJson(OPENCODE_CONFIG_PATH);
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return { status: "failed" as const, message: "opencode.json is not a valid JSON object" };
      }
      config = raw as Record<string, unknown>;
    } catch {
      return { status: "failed", message: "opencode.json contains invalid JSON — skipping command configuration" };
    }

    const existingCommands =
      typeof config.command === "object" && config.command !== null && !Array.isArray(config.command)
        ? (config.command as Record<string, unknown>)
        : {};

    // Count how many commands need to be added
    const commandsToAdd: string[] = [];
    for (const key of Object.keys(COMMAND_TEMPLATES)) {
      if (!(key in existingCommands)) {
        commandsToAdd.push(key);
      }
    }

    if (commandsToAdd.length === 0) {
      return { status: "skipped", message: "All commands already configured" };
    }

    // Build new commands object, preserving existing entries
    const mergedCommands: Record<string, unknown> = { ...existingCommands };
    for (const key of commandsToAdd) {
      mergedCommands[key] = COMMAND_TEMPLATES[key];
    }

    const updatedConfig = {
      ...config,
      command: mergedCommands,
    };

    await deps.writeFile(OPENCODE_CONFIG_PATH, JSON.stringify(updatedConfig, null, 2));

    deps.log(`Added ${commandsToAdd.length} commands to opencode.json: ${commandsToAdd.join(", ")}`, "info");

    return { status: "success", message: `Added ${commandsToAdd.length} commands to opencode.json` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "failed", message: `Failed to configure commands: ${message}` };
  }
}
