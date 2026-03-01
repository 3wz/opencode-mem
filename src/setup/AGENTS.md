<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-01 | Updated: 2026-03-01 -->

# setup

## Purpose
Auto-setup pipeline that runs on first plugin load. Orchestrates 5 idempotent steps that install claude-mem globally, add the MCP entry to opencode.json, register 4 slash commands, and copy the mem-search skill. All steps are independent — if one fails, the rest still run. The pipeline never throws and never blocks plugin initialization.

## Key Files
| File | Description |
|------|-------------|
| `auto-setup.ts` | Orchestrates the 5-step setup pipeline. Never throws — entire body wrapped in try-catch. Each step is independent. Returns `SetupResult` with per-step status (success/skipped/failed). |
| `types.ts` | `SetupDeps` (dependency injection interface for testability), `SetupStepResult`, `SetupResult`. Includes `createDefaultDeps()` factory using Bun and Node.js APIs. |
| `index.ts` | Barrel export for the setup module. |
| `steps/detect-binary.ts` | Step 1: Checks if `claude-mem` is in PATH or `~/.claude-mem` directory exists. |
| `steps/install-claude-mem.ts` | Step 2: Runs `npm install -g claude-mem` if not detected. Skipped if already installed. |
| `steps/configure-mcp.ts` | Step 3: Adds `claude-mem` MCP entry to `~/.config/opencode/opencode.json`. Uses 3-strategy server path discovery (plugin cache → npm global → bun which). Handles migration from `type: "remote"` to `type: "local"`. |
| `steps/configure-commands.ts` | Step 4: Adds 4 slash commands (`/mem-search`, `/mem-save`, `/mem-status`, `/mem-timeline`) to `~/.config/opencode/opencode.json`. Only adds missing commands (per-key idempotency). |
| `steps/copy-skills.ts` | Step 5: Copies the mem-search skill from the plugin package to `~/.config/opencode/skills/mem-search/`. Never overwrites an existing destination (protects user customizations). |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `steps/` | 5 setup step implementations (documented above in Key Files). |

## For AI Agents

### Working In This Directory
- All steps must be **idempotent** — safe to run multiple times without side effects.
- Steps must **never throw** — wrap all logic in try-catch and return a `SetupStepResult`.
- Use **dependency injection** via `SetupDeps` for all filesystem and process operations — never call `fs`, `Bun.spawn`, or `which` directly in step files.
- Files touched at runtime: `~/.config/opencode/opencode.json`, `~/.config/opencode/skills/mem-search/`, system npm packages.

### Testing Requirements
- Tests use mock `SetupDeps` with in-memory file systems (no real filesystem writes).
- Test both success and failure paths for each step.
- Test idempotency: running a step twice should return `skipped` on the second run.

### Common Patterns
- Each step returns `SetupStepResult`: `{ status: "success" | "skipped" | "failed"; message: string }`.
- Steps check existing state before modifying (idempotency guard).
- `auto-setup.ts` logs progress via `deps.log()` but never blocks plugin initialization.
- `createDefaultDeps()` in `types.ts` provides production implementations using Bun APIs.

## Dependencies

### Internal
- `../utils/detect.ts` — `getMcpServerPath()`, `getWorkerPort()`
- `../mcp-config.ts` — `generateMcpConfig()`
- `../worker-manager.ts` — `startWorker()`

### External
- None (all filesystem/process operations abstracted via `SetupDeps`)

<!-- MANUAL: -->
