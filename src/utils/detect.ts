import { existsSync, readdirSync } from "fs";
import { readFileSync } from "fs";
import { homedir } from "os";
import { delimiter, join } from "path";
import { accessSync, constants as fsConstants } from "node:fs";
import { spawnSync } from "node:child_process";
import type { ClaudeMemConfig } from "../types.js";
import { ClaudeMemClient } from "../client.js";

function hasBunRuntime(): boolean {
  return typeof Bun !== "undefined"
    && typeof Bun.which === "function"
    && typeof Bun.spawnSync === "function";
}

function findCommandInPath(cmd: string): string | null {
  const pathValue = process.env.PATH;
  if (!pathValue) {
    return null;
  }

  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT?.split(";").filter(Boolean) ?? [".EXE", ".CMD", ".BAT", ".COM"])
    : [""];

  for (const entry of pathValue.split(delimiter)) {
    if (!entry) {
      continue;
    }

    for (const extension of extensions) {
      const candidate = process.platform === "win32" && extension && cmd.toLowerCase().endsWith(extension.toLowerCase())
        ? join(entry, cmd)
        : join(entry, `${cmd}${extension}`);

      try {
        accessSync(candidate, fsConstants.X_OK);
        return candidate;
      } catch {
        // Continue searching PATH.
      }
    }
  }

  return null;
}

const DEFAULT_CONFIG: ClaudeMemConfig = {
  port: 37777,
  dataDir: join(homedir(), ".claude-mem"),
  host: "localhost",
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
      host: parsed.host ?? DEFAULT_CONFIG.host,
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
  const envDir = process.env.CLAUDE_MEM_DATA_DIR?.trim();
  // Validate path to prevent traversal attacks (reject paths containing "..")
  const dataDir = envDir && !envDir.includes("..") ? envDir : join(homedir(), ".claude-mem");
  return dataDir;
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

export function getWorkerHost(): string {
  const envHost = process.env.CLAUDE_MEM_WORKER_HOST?.trim();
  if (envHost) {
    return envHost;
  }

  try {
    const settings = readSettings();
    return settings.host?.trim() || DEFAULT_CONFIG.host || "localhost";
  } catch {
    return DEFAULT_CONFIG.host || "localhost";
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
        const parseVersion = (value: string): [number, number, number, boolean] => {
          const match = value.match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
          if (!match) {
            return [0, 0, 0, true];
          }

          const major = Number.parseInt(match[1], 10);
          const minor = Number.parseInt(match[2], 10);
          const patch = Number.parseInt(match[3], 10);
          const preRelease = Boolean(match[4]);
          return [major, minor, patch, preRelease];
        };

        const versions = dirs.sort((a, b) => {
          const [aMaj, aMin, aPatch, aPre] = parseVersion(a);
          const [bMaj, bMin, bPatch, bPre] = parseVersion(b);

          if (bMaj !== aMaj) return bMaj - aMaj;
          if (bMin !== aMin) return bMin - aMin;
          if (bPatch !== aPatch) return bPatch - aPatch;
          if (aPre !== bPre) return aPre ? 1 : -1;
          return b.localeCompare(a);
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
      const result = hasBunRuntime()
        ? Bun.spawnSync(["npm", "root", "-g"], { stdout: "pipe" })
        : spawnSync("npm", ["root", "-g"], { encoding: "utf-8" });
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
    const claudeMemBin = hasBunRuntime() ? Bun.which("claude-mem") : findCommandInPath("claude-mem");
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
