import { join } from "path";
import { cp, mkdir } from "node:fs/promises";
import { getWorkerPort } from "../utils/detect.js";

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
  return {
    which: (cmd: string) => {
      return Bun.which(cmd) ?? null;
    },

    fileExists: async (path: string) => {
      return await Bun.file(path).exists();
    },

    readJson: async (path: string) => {
      return await Bun.file(path).json();
    },

    writeFile: async (path: string, data: string) => {
      await Bun.write(path, data);
    },

    copyDir: async (src: string, dest: string, opts?: { recursive?: boolean }) => {
      await cp(src, dest, { recursive: opts?.recursive ?? true });
    },

    mkdirp: async (path: string) => {
      await mkdir(path, { recursive: true });
    },

    exec: async (cmd: string[]) => {
      const process = Bun.spawn(cmd, {
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await process.exited;
      const stdout = await new Response(process.stdout).text();

      return { exitCode, stdout };
    },

    log,

    pluginDir: join(import.meta.dir, "..", ".."),

    getWorkerPort: () => getWorkerPort(),

    startWorker: async (port: number) => {
      const { startWorker: sw } = await import("../worker-manager.js");
      return sw(port);
    },
  };
}
