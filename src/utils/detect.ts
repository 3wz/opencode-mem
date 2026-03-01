import { existsSync, readdirSync } from "fs";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ClaudeMemConfig } from "../types.js";
import { ClaudeMemClient } from "../client.js";

const DEFAULT_CONFIG: ClaudeMemConfig = {
  port: 37777,
  dataDir: join(homedir(), ".claude-mem"),
};

export interface ClaudeMemDetectResult {
  installed: boolean;
  workerRunning: boolean;
  port: number;
  dataDir: string;
}

/** Read settings from ~/.claude-mem/settings.json, with defaults */
export function readSettings(): ClaudeMemConfig {
  const settingsPath = join(getDataDir(), "settings.json");
  try {
    if (!existsSync(settingsPath)) return { ...DEFAULT_CONFIG };
    const raw = readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ClaudeMemConfig>;
    return {
      port: parsed.port ?? DEFAULT_CONFIG.port,
      dataDir: parsed.dataDir ?? DEFAULT_CONFIG.dataDir,
      model: parsed.model,
      logLevel: parsed.logLevel,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Get the data directory (from settings or default ~/.claude-mem) */
export function getDataDir(): string {
  // Note: can't call readSettings() here (circular), use default
  const envDir = process.env.CLAUDE_MEM_DATA_DIR;
  return envDir ?? join(homedir(), ".claude-mem");
}

/** Get the worker port (from settings or default 37777) */
export function getWorkerPort(): number {
  try {
    const settings = readSettings();
    return settings.port;
  } catch {
    return DEFAULT_CONFIG.port;
  }
}

/** Detect if claude-mem is installed and if the worker is running */
export async function detectClaudeMem(): Promise<ClaudeMemDetectResult> {
  const dataDir = getDataDir();
  const dbPath = join(dataDir, "claude-mem.db");
  const installed = existsSync(dbPath);
  const port = getWorkerPort();

  if (!installed) {
    return { installed: false, workerRunning: false, port, dataDir };
  }

  const client = new ClaudeMemClient(port, 1000);
  const workerRunning = await client.healthCheck(1);

  return { installed, workerRunning, port, dataDir };
}

/** Get the path to mcp-server.cjs from claude-mem installation */
export function getMcpServerPath(): string | null {
  try {
    // Strategy 1: Check ~/.claude/plugins/cache/thedotmack/claude-mem/*/scripts/mcp-server.cjs
    const cacheDir = join(homedir(), ".claude", "plugins", "cache", "thedotmack", "claude-mem");
    if (existsSync(cacheDir)) {
      const dirs = readdirSync(cacheDir);
      if (dirs.length > 0) {
        // Sort versions descending (newest first)
        const versions = dirs.sort((a, b) => {
          const aParts = a.split(".").map(Number);
          const bParts = b.split(".").map(Number);
          const aMaj = aParts[0] ?? 0;
          const aMin = aParts[1] ?? 0;
          const aPatch = aParts[2] ?? 0;
          const bMaj = bParts[0] ?? 0;
          const bMin = bParts[1] ?? 0;
          const bPatch = bParts[2] ?? 0;
          return bMaj - aMaj || bMin - aMin || bPatch - aPatch;
        });
        const latestVersion = versions[0];
        const mcpPath = join(cacheDir, latestVersion, "scripts", "mcp-server.cjs");
        if (existsSync(mcpPath)) {
          return mcpPath;
        }
      }
    }

    // Strategy 2: Check npm global root
    try {
      const result = Bun.spawnSync(["npm", "root", "-g"], { stdout: "pipe" });
      const npmRoot = result.stdout?.toString().trim();
      if (npmRoot && npmRoot.length > 0) {
        const npmPath = join(npmRoot, "claude-mem", "scripts", "mcp-server.cjs");
        if (existsSync(npmPath)) {
          return npmPath;
        }
      }
    } catch {
      // npm root failed, continue to next strategy
    }

    // Strategy 3: Check Bun.which("claude-mem")
    const claudeMemBin = Bun.which("claude-mem");
    if (claudeMemBin) {
      // Resolve to package root by going up from bin
      const packageRoot = join(claudeMemBin, "..", "..");
      const bunPath = join(packageRoot, "scripts", "mcp-server.cjs");
      if (existsSync(bunPath)) {
        return bunPath;
      }
    }

    return null;
  } catch {
    return null;
  }
}
