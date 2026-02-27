import { existsSync } from "fs";
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
