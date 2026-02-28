import type { Plugin } from "@opencode-ai/plugin";
import { ClaudeMemClient } from "./client.js";
import { createCompactionHook } from "./hooks/compaction.js";
import { createContextInjectionHook } from "./hooks/context-inject.js";
import { createCapturePromptHook } from "./hooks/capture-prompt.js";
import { createSaveObservationHook } from "./hooks/save-observation.js";
import { createCommandExecuteHook } from "./hooks/command-execute.js";
import { createTextCompleteHook } from "./hooks/text-complete.js";
import { createSummaryHandler } from "./hooks/summary.js";
import { detectClaudeMem, getWorkerPort } from "./utils/detect.js";
import { autoSetup } from "./setup/auto-setup.js";
import { createDefaultDeps } from "./setup/types.js";
import type { PluginState } from "./types.js";

type PluginHooks = Awaited<ReturnType<Plugin>>;

function buildHooks(
  memClient: ClaudeMemClient,
  state: PluginState,
  projectName: string,
  port: number,
  cwd: string,
): PluginHooks {
  const summaryHandler = createSummaryHandler(memClient, state);

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        const sessionId = event.properties.info.id;
        state.sessionId = sessionId;

        if (state.isWorkerRunning && sessionId) {
          void memClient.initSession({
            claudeSessionId: sessionId,
            projectName,
          });
        }
      }

      if (event.type === "session.deleted") {
        const sessionId = event.properties.info.id;

        if (state.isWorkerRunning && sessionId) {
          void memClient.completeSession({
            claudeSessionId: sessionId,
            projectName,
          });
        }
      }

      await summaryHandler({ event });
    },
    "chat.message": createCapturePromptHook(memClient, state) as PluginHooks["chat.message"],
    "tool.execute.after": createSaveObservationHook(memClient, state, cwd) as PluginHooks["tool.execute.after"],
    "experimental.chat.system.transform": createContextInjectionHook(
      memClient,
      projectName,
      port,
    ) as PluginHooks["experimental.chat.system.transform"],
    "experimental.session.compacting": createCompactionHook(
      memClient,
      projectName,
    ) as PluginHooks["experimental.session.compacting"],
    "command.execute.before": createCommandExecuteHook(memClient, state) as PluginHooks["command.execute.before"],
    "experimental.text.complete": createTextCompleteHook(memClient, state) as PluginHooks["experimental.text.complete"],
  };
}


/**
 * OpenCodeMem - opencode plugin for claude-mem persistent memory.
 * Connects to the shared claude-mem worker (port 37777) and maps
 * opencode session lifecycle events to claude-mem hooks.
 */
const OpenCodeMem: Plugin = async ({ client, project, directory }) => {
  const port = getWorkerPort();
  const projectName = (project as { path?: string }).path ?? directory;

  const log = (msg: string, level: "info" | "warn" | "error" = "info") => {
    try {
      client.app.log({
        body: {
          service: "opencode-mem",
          message: `[opencode-mem] ${msg}`,
          level,
        },
      });
    } catch {
      // Never crash plugin on logging failures.
    }
  };

  const memClient = new ClaudeMemClient(port, 2000, log);

  const state: PluginState = {
    isWorkerRunning: false,
    projectName,
    sessionId: "",
  };

  const detection = await detectClaudeMem();
  state.isWorkerRunning = detection.workerRunning;

  if (detection.workerRunning) {
    log(`Connected to claude-mem worker on port ${port}`);
    log(`Memory viewer: http://localhost:${port}`);
  } else if (detection.installed) {
    log("Claude-mem installed but worker not running. Memory features disabled.");
  } else {
    log("Claude-mem not detected. Memory features disabled.");
  }

  // Auto-setup: always run MCP config/skills setup (idempotent, fire-and-forget).
  // Worker start is skipped internally when already running.
  const setupDeps = createDefaultDeps(log);
  void autoSetup(setupDeps).then((result) => {
    if (result.worker.status === "success" && !state.isWorkerRunning) {
      state.isWorkerRunning = true;
      log("Auto-setup started the worker. Memory features now active.");
    }
  });

  return buildHooks(memClient, state, projectName, port, directory);
};

// Internal function for testing - allows injecting mock client and detect functions
export function createPluginWithDependencies(
  clientFactory: (port: number, timeout: number, log: (msg: string) => void) => any,
  detectFn?: () => Promise<any>,
  getPortFn?: () => number,
  autoSetupFn?: (deps: any) => Promise<any>,
): Plugin {
  return async ({ client, project, directory }) => {
    const port = (getPortFn || getWorkerPort)();
    const projectName = (project as { path?: string }).path ?? directory;

    const log = (msg: string, level: "info" | "warn" | "error" = "info") => {
      try {
        client.app.log({
          body: {
            service: "opencode-mem",
            message: `[opencode-mem] ${msg}`,
            level,
          },
        });
      } catch {
        // Never crash plugin on logging failures.
      }
    };

    const memClient = clientFactory(port, 2000, log);

    const state: PluginState = {
      isWorkerRunning: false,
      projectName,
      sessionId: "",
    };

    const detection = await (detectFn || detectClaudeMem)();
    state.isWorkerRunning = detection.workerRunning;

    if (detection.workerRunning) {
      log(`Connected to claude-mem worker on port ${port}`);
      log(`Memory viewer: http://localhost:${port}`);
    } else if (detection.installed) {
      log("Claude-mem installed but worker not running. Memory features disabled.");
    } else {
      log("Claude-mem not detected. Memory features disabled.");
    }

    // Auto-setup: always run MCP config/skills setup (idempotent, fire-and-forget).
    // Worker start is skipped internally when already running.
    const setupDeps = createDefaultDeps(log);
    const setupFn = autoSetupFn || autoSetup;
    void setupFn(setupDeps).then((result) => {
      if (result.worker.status === "success" && !state.isWorkerRunning) {
        state.isWorkerRunning = true;
        log("Auto-setup started the worker. Memory features now active.");
      }
    });

    return buildHooks(memClient, state, projectName, port, directory);
  };
}

// Alias for backward compatibility
export const createPluginWithClient = (clientFactory: (port: number, timeout: number, log: (msg: string) => void) => any) =>
  createPluginWithDependencies(clientFactory);

export default OpenCodeMem;
export { OpenCodeMem };
export type { PluginState };
