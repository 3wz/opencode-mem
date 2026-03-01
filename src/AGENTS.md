<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-01 | Updated: 2026-03-01 -->

# src

## Purpose
Application source code for opencode-mem. Contains 6 core modules implementing the OpenCode ↔ claude-mem bridge: the plugin entry point, HTTP client, worker lifecycle manager, shared type definitions, MCP configuration generator, and barrel export. Three subdirectories organize event hooks, the auto-setup pipeline, and shared utilities.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | Barrel export (re-exports all public API from plugin.ts, types.ts, and setup/). |
| `plugin.ts` | Plugin entry point: `resolveProjectName()`, `buildHooks()`, `initializePlugin()`. Implements the OpenCode Plugin API. Wires all 7 event hooks and runs auto-setup on first load. |
| `client.ts` | `ClaudeMemClient`: HTTP bridge to the claude-mem worker (port 37777). Methods: `healthCheck`, `getContext`, `initSession`, `sendObservation`, `sendSummary`, `completeSession`, `getMemoryStatus`. All write methods are fire-and-forget (void). |
| `types.ts` | Shared interfaces: `PluginState`, `ClaudeMemConfig`, `SessionInitPayload`, `ObservationPayload`, `SummarizePayload`, `SessionCompletePayload`, `ContextInjectionResponse`, `WorkerHealth`, `MemoryStatus`. |
| `worker-manager.ts` | Worker lifecycle: `isWorkerRunning()` (health check on port 37777), `getWorkerCommand()` (discovers claude-mem binary), `startWorker()` (spawns detached process, polls for readiness). |
| `mcp-config.ts` | `generateMcpConfig(mcpServerPath)` — generates the `mcp.claude-mem` entry for opencode.json. `generateInstallInstructions()` — returns markdown for manual setup. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `hooks/` | 7 event hook handlers that bridge OpenCode lifecycle events to the claude-mem worker API. See `hooks/AGENTS.md`. |
| `setup/` | Auto-setup pipeline: 5 idempotent steps that install claude-mem, configure MCP, register slash commands, and copy skills. See `setup/AGENTS.md`. |
| `utils/` | Shared utility functions: detection, JSON parsing, tool filtering, and privacy tag stripping. See `utils/AGENTS.md`. |

## For AI Agents

### Working In This Directory
- These are the core modules. Changes here affect the entire plugin.
- Always verify with `bun test` (213 tests) and `bunx tsc --noEmit` after any change.
- Never use `console.log` — use `client.app.log()` for all logging.
- Native `fetch()` only — no axios, got, or other HTTP libraries.
- Must not add runtime dependencies — only `peerDependencies` and `devDependencies` are allowed.

### Testing Requirements
- Every module has a co-located `*.test.ts` file using Bun's native test runner with `describe()`/`it()` pattern.
- Mock pattern: `Bun.serve()` for HTTP server mocking, dependency injection for plugin factory (`clientFactory`, `detectFn`, `autoSetupFn`).
- Fire-and-forget operations use `waitForFireAndForget(ms = 50)` helper in tests.

### Common Patterns
- **Dependency injection**: `plugin.ts` accepts mock factories (`clientFactory`, `detectFn`, `autoSetupFn`) for testability without a live worker.
- **Fire-and-forget**: All write operations (`initSession`, `sendObservation`, `sendSummary`, `completeSession`) are called with `void` prefix — never awaited in hook handlers.
- **2000ms default timeout**: All HTTP calls to the worker use a 2000ms timeout (500ms for status checks).
- **Project name resolution**: `resolveProjectName()` uses `path.basename(worktree || directory)` to match the worker's naming convention.

## Dependencies

### Internal
- `hooks/` — Event handlers registered by `plugin.ts`
- `setup/` — Auto-setup pipeline called by `plugin.ts` on first load
- `utils/` — Shared helpers used by hooks and setup

### External
- `@opencode-ai/plugin` (peer) — OpenCode Plugin API: `Plugin` type, hook event types, `app.log()`

<!-- MANUAL: -->
