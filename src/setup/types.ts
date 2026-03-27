import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, delimiter, join } from "path";
import { fileURLToPath } from "node:url";
import { accessSync, constants as fsConstants, existsSync } from "node:fs";
import { getWorkerPort } from "../utils/detect.js";

function hasBunRuntime(): boolean {
  return typeof Bun !== "undefined"
    && typeof Bun.which === "function"
    && typeof Bun.file === "function"
    && typeof Bun.write === "function"
    && typeof Bun.spawn === "function";
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
        // Keep searching PATH entries.
      }
    }
  }

  return null;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function execCommand(cmd: string[]): Promise<{ exitCode: number; stdout?: string }> {
  return await new Promise((resolve) => {
    const child = spawn(cmd[0], cmd.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.on("error", () => {
      resolve({ exitCode: 1, stdout });
    });

    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout });
    });
  });
}

function resolvePluginDir(moduleUrl: string): string {
  const startDir = dirname(fileURLToPath(moduleUrl));
  const candidates = [
    startDir,
    join(startDir, ".."),
    join(startDir, "..", ".."),
    join(startDir, "..", "..", ".."),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "skills", "mem-search", "SKILL.md"))) {
      return candidate;
    }
  }

  return join(startDir, "..", "..");
}

/**
 * Result of a single setup step
 */
export interface SetupStepResult {
  status: "success" | "skipped" | "failed";
  message: string;
}

/**
 * Complete setup result with all steps
 */
export interface SetupResult {
  binary: SetupStepResult;
  install: SetupStepResult;
  mcp: SetupStepResult;
  commands: SetupStepResult;
  skills: SetupStepResult;
  worker: SetupStepResult;
}

/**
 * Dependency injection interface for setup operations.
 * Abstracts filesystem, process execution, and logging for testability.
 */
export interface SetupDeps {
  /** Check if a command exists in PATH */
  which: (cmd: string) => string | null;

  /** Check if a file exists */
  fileExists: (path: string) => Promise<boolean>;

  /** Read and parse JSON file */
  readJson: (path: string) => Promise<unknown>;

  /** Write string data to file */
  writeFile: (path: string, data: string) => Promise<void>;

  /** Copy directory recursively */
  copyDir: (src: string, dest: string, opts?: { recursive?: boolean }) => Promise<void>;

  /** Create directory recursively */
  mkdirp: (path: string) => Promise<void>;

  /** Execute command and return exit code and stdout */
  exec: (cmd: string[]) => Promise<{ exitCode: number; stdout?: string }>;

  /** Log a message with optional level */
  log: (msg: string, level?: "info" | "warn" | "error") => void;

  /** Plugin root directory path */
  pluginDir: string;

  /** Get the claude-mem worker port */
  getWorkerPort: () => number;

  /** Start the claude-mem worker (returns true if running after call) */
  startWorker?: (port: number) => Promise<boolean>;
}

/**
 * Create default dependencies using Bun and Node.js APIs
 */
export function createDefaultDeps(
  log: (msg: string, level?: "info" | "warn" | "error") => void,
): SetupDeps {
  const pluginDir = resolvePluginDir(import.meta.url);
  const useBun = hasBunRuntime();

  return {
    which: (cmd: string) => {
      if (useBun) {
        return Bun.which(cmd) ?? null;
      }

      return findCommandInPath(cmd);
    },

    fileExists: async (path: string) => {
      if (useBun) {
        return await Bun.file(path).exists();
      }

      return await pathExists(path);
    },

    readJson: async (path: string) => {
      if (useBun) {
        return await Bun.file(path).json();
      }

      const content = await readFile(path, "utf-8");
      return JSON.parse(content) as unknown;
    },

    writeFile: async (path: string, data: string) => {
      if (useBun) {
        await Bun.write(path, data);
        return;
      }

      await writeFile(path, data, "utf-8");
    },

    copyDir: async (src: string, dest: string, opts?: { recursive?: boolean }) => {
      await cp(src, dest, { recursive: opts?.recursive ?? true });
    },

    mkdirp: async (path: string) => {
      await mkdir(path, { recursive: true });
    },

    exec: async (cmd: string[]) => {
      if (useBun) {
        const process = Bun.spawn(cmd, {
          stdout: "pipe",
          stderr: "pipe",
        });

        const exitCode = await process.exited;
        const stdout = await new Response(process.stdout).text();

        return { exitCode, stdout };
      }

      return await execCommand(cmd);
    },

    log,

    pluginDir,

    getWorkerPort: () => getWorkerPort(),

    startWorker: async (port: number) => {
      const { startWorker: sw } = await import("../worker-manager.js");
      return sw(port);
    },
  };
}
