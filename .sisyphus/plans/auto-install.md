# Auto-Install Flow for opencode-claude-mem

## TL;DR

> **Quick Summary**: Add automatic setup to the opencode-claude-mem plugin so that when a user adds it to their `opencode.json` plugin array, everything else happens automatically: claude-mem is installed if missing, the worker is started, MCP is configured in opencode.json, and skills are copied — zero manual steps.
>
> **Deliverables**:
> - `src/setup/` module — auto-setup orchestrator with dependency injection
> - `src/setup/auto-setup.ts` — main orchestrator function
> - `src/setup/steps/` — individual setup step functions (detect, install, configure, copy)
> - `src/setup/types.ts` — SetupDeps interface and result types
> - Updated `src/plugin.ts` — integrates auto-setup (fire-and-forget)
> - Updated `src/mcp-config.ts` — adds `enabled: true` to generated config
> - Updated `src/types.ts` — enhanced OpenCodeMemOptions
> - Tests for all setup steps (TDD)
> - Updated README with auto-setup documentation
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: T1 (types) → T2 (detect) → T3-T6 (steps in parallel) → T7 (orchestrator) → T8 (integrate) → T9 (tests) → T10 (README)

---

## Context

### Original Request
"We need to add a way to install and configure claude-mem if the user doesn't have it on their computer, and auto copy the skills, MCPs, everything, so we create an installation flow that is automatic that opencode can follow and make it work."

### Interview Summary
**Key Discussions**:
- Plugin already works (Phase 1 complete, 100 tests, 18 tasks done). This is Phase 2.
- User referenced oh-my-opencode's polished install flow as inspiration.
- Silent auto-setup on plugin load — no CLI tool needed.
- All setup steps must be idempotent and gracefully fail.
- Never block opencode's main process.

**Research Findings**:
- `$` (BunShell) available in PluginInput — supports shell commands
- `client.app.log()` for progress reporting, must wrap in try-catch
- `directory` in PluginInput is the PROJECT directory, NOT the plugin's directory
- `import.meta.dir` gives the plugin's own directory (where `skills/` lives)
- Worker is self-bootstrapping (auto-creates `~/.claude-mem/`, settings.json, DB)
- No programmatic API to modify opencode.json — must use file I/O
- `Bun.which()` is synchronous, returns path or null
- `Bun.file().exists()` and `Bun.file().json()` for JSON I/O
- `node:fs/promises` `cp()` works in Bun for directory copy

### Metis Review
**Identified Gaps** (addressed):
- `directory` from PluginInput is project dir, not plugin dir → Use `import.meta.dir` instead
- `generateMcpConfig()` missing `enabled: true` → Must add to match actual opencode.json format
- MCP URL must use user's configured port from `getWorkerPort()`, not hardcoded 37777
- Skills directory may not exist for fresh opencode install → Must `mkdir -p` before copying
- opencode.json has `$schema` key → Must preserve all existing keys during merge
- Existing MCP config with custom port must NOT be overwritten → "add if absent" only
- Need concurrent startup safety → File I/O should be atomic where possible
- Need setup completion marker to skip expensive operations → Check results, not marker file

---

## Work Objectives

### Core Objective
Make the plugin self-configuring: adding `"opencode-claude-mem"` to the plugin array is the ONLY manual step. Everything else (install, configure, copy, start) happens automatically on first plugin load.

### Concrete Deliverables
- `src/setup/types.ts` — SetupDeps interface, SetupResult type, SetupStepResult type
- `src/setup/steps/detect-binary.ts` — Check if claude-mem CLI is installed
- `src/setup/steps/install-claude-mem.ts` — npm install -g claude-mem
- `src/setup/steps/configure-mcp.ts` — Add MCP entry to opencode.json
- `src/setup/steps/copy-skills.ts` — Copy mem-search skill to opencode skills dir
- `src/setup/auto-setup.ts` — Orchestrator that runs all steps in order
- Updated `src/plugin.ts` — `void autoSetup(...)` call in plugin init
- Updated `src/mcp-config.ts` — `enabled: true` in output
- Tests for each step + orchestrator
- Updated README

### Definition of Done
- [ ] `bun test` passes (all existing 100 tests + new setup tests)
- [ ] `bunx tsc --noEmit` clean (zero type errors)
- [ ] Auto-setup runs on plugin load when claude-mem is not configured
- [ ] Auto-setup is fully idempotent (running twice has no side effects)
- [ ] Auto-setup never crashes the plugin (all errors caught)
- [ ] Auto-setup never blocks plugin init (fire-and-forget)

### Must Have
- Auto-detect if claude-mem binary is installed (`Bun.which("claude-mem")`)
- Auto-install claude-mem via npm if missing
- Auto-start worker if not running (extend existing `startWorker()`)
- Auto-configure MCP in `~/.config/opencode/opencode.json` if missing
- Auto-copy `skills/mem-search/` to `~/.config/opencode/skills/` if missing
- Progress logging via `client.app.log()` (info/warn/error levels)
- Idempotency: every step checks "already done?" before acting
- Graceful failure: each step fails independently, plugin continues
- Use `import.meta.dir` to find plugin's own directory (NOT `directory` from PluginInput)
- Include `enabled: true` in generated MCP config
- Use `getWorkerPort()` for MCP URL (respect user's configured port)
- Dependency injection for all external operations (testability)
- TDD: tests for each setup step

### Must NOT Have (Guardrails)
- Must NOT use `directory` from PluginInput to find plugin's own files (it's the project dir)
- Must NOT use `console.log` in production code (use `client.app.log()`)
- Must NOT block plugin init waiting for npm install or worker start
- Must NOT overwrite existing MCP config entries in opencode.json
- Must NOT overwrite existing skill files (user may have customized them)
- Must NOT corrupt opencode.json (parse defensively, skip on error)
- Must NOT add npm dependencies to package.json (use only Bun built-ins + node:fs/promises)
- Must NOT use `mock.module()` in tests (causes cross-file pollution)
- Must NOT hardcode port 37777 for MCP URL (use `getWorkerPort()`)
- Must NOT create a CLI tool or interactive prompts
- Must NOT install `uv` or Chroma automatically (too invasive — just warn if missing)
- Must NOT modify claude-code's configuration

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (bun:test, 100 existing tests)
- **Automated tests**: TDD (RED → GREEN → REFACTOR)
- **Framework**: bun:test
- **Each task follows**: RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Module tests**: Use `bun test` — run tests, assert pass count
- **Type checking**: Use `bunx tsc --noEmit` — assert zero errors
- **Integration**: Use Bash — import module, call function, verify output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — types + detection):
├── Task 1: Setup types (SetupDeps, SetupResult) [quick]
└── Task 2: Detect binary step (detect-binary.ts) [quick]

Wave 2 (After Wave 1 — independent steps, MAX PARALLEL):
├── Task 3: Install step (install-claude-mem.ts) [quick]
├── Task 4: Configure MCP step (configure-mcp.ts) [unspecified-high]
├── Task 5: Copy skills step (copy-skills.ts) [quick]
└── Task 6: Fix generateMcpConfig to include enabled:true [quick]

Wave 3 (After Wave 2 — orchestration + integration):
├── Task 7: Auto-setup orchestrator (auto-setup.ts) [unspecified-high]
├── Task 8: Integrate into plugin.ts [quick]
├── Task 9: Update README [writing]
└── Task 10: Regression test run [quick]

Wave FINAL (After ALL tasks — independent review):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
└── Task F3: Scope fidelity check [deep]

Critical Path: T1 → T2 → T4 → T7 → T8 → F1-F3
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 4 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1 | — | T2-T8 | 1 |
| T2 | T1 | T3, T7 | 1 |
| T3 | T1, T2 | T7 | 2 |
| T4 | T1 | T7 | 2 |
| T5 | T1 | T7 | 2 |
| T6 | — | T4, T7 | 2 |
| T7 | T2-T6 | T8 | 3 |
| T8 | T7 | T10 | 3 |
| T9 | T7 | — | 3 |
| T10 | T8 | F1-F3 | 3 |
| F1 | T10 | — | FINAL |
| F2 | T10 | — | FINAL |
| F3 | T10 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: **2 tasks** — T1 → `quick`, T2 → `quick`
- **Wave 2**: **4 tasks** — T3 → `quick`, T4 → `unspecified-high`, T5 → `quick`, T6 → `quick`
- **Wave 3**: **4 tasks** — T7 → `unspecified-high`, T8 → `quick`, T9 → `writing`, T10 → `quick`
- **FINAL**: **3 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `deep`

---

## TODOs

- [x] 1. Setup Types and Interfaces

  **What to do**:
  - Create `src/setup/types.ts` with the `SetupDeps` interface for dependency injection:
    ```typescript
    export interface SetupDeps {
      which: (cmd: string) => string | null;
      fileExists: (path: string) => Promise<boolean>;
      readJson: (path: string) => Promise<unknown>;
      writeFile: (path: string, data: string) => Promise<void>;
      copyDir: (src: string, dest: string, opts?: { recursive?: boolean }) => Promise<void>;
      mkdirp: (path: string) => Promise<void>;
      exec: (cmd: string[]) => Promise<{ exitCode: number; stdout?: string }>;
      log: (msg: string, level?: "info" | "warn" | "error") => void;
      pluginDir: string;
      getWorkerPort: () => number;
    }
    ```
  - Add `SetupStepResult` type: `{ status: "success" | "skipped" | "failed"; message: string }`
  - Add `SetupResult` type: `{ binary: SetupStepResult; install: SetupStepResult; mcp: SetupStepResult; skills: SetupStepResult; worker: SetupStepResult }`
  - Add `createDefaultDeps(log)` factory that creates real implementations using Bun APIs
  - The `pluginDir` field in `createDefaultDeps` MUST use `import.meta.dir` resolved to the package root (e.g., `join(import.meta.dir, "..")` if the file is in `src/setup/`). NEVER use `directory` from PluginInput.
  - Export all types from `src/setup/index.ts`
  - Write tests in `src/setup/types.test.ts` verifying the factory produces valid deps

  **Must NOT do**:
  - Must NOT add any npm dependencies
  - Must NOT use `directory` from PluginInput in the deps factory

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small types-only file with a factory function
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 2, 3, 4, 5, 7, 8
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/types.ts` — Follow the same interface definition style (doc comments, optional fields with `?`)
  - `src/plugin.ts:78-148` (`createPluginWithDependencies`) — Existing dependency injection pattern. Follow same approach for `createDefaultDeps`.

  **API/Type References**:
  - `src/utils/detect.ts:46-53` (`getWorkerPort()`) — Reads port from settings. Must be included in SetupDeps.
  - `src/mcp-config.ts:3-6` (`McpConfig` interface) — MCP config shape for configure-mcp step.

  **External References**:
  - `Bun.which(cmd)` returns `string | null` — real type for `which` field
  - `node:fs/promises` `cp(src, dest, { recursive: true })` — what `copyDir` wraps
  - `Bun.file(path).exists()` returns `Promise<boolean>` — what `fileExists` wraps
  - `Bun.file(path).json()` returns `Promise<unknown>` — what `readJson` wraps
  - `Bun.write(path, data)` returns `Promise<number>` — what `writeFile` wraps

  **WHY Each Reference Matters**:
  - `src/types.ts`: Consistent code style with existing type definitions
  - `createPluginWithDependencies`: Project already uses DI; follow same pattern
  - `getWorkerPort()`: Must be wired through to MCP config generation; don't hardcode port

  **Acceptance Criteria**:
  - [ ] File created: `src/setup/types.ts`
  - [ ] File created: `src/setup/index.ts` (barrel export)
  - [ ] `bunx tsc --noEmit` → 0 errors
  - [ ] `bun test src/setup/types.test.ts` → PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: createDefaultDeps returns valid deps object
    Tool: Bash (bun test)
    Preconditions: src/setup/types.ts and src/setup/types.test.ts exist
    Steps:
      1. Run: bun test src/setup/types.test.ts
      2. Assert: all tests pass, 0 failures
    Expected Result: All tests pass
    Failure Indicators: Any test failure or type error
    Evidence: .sisyphus/evidence/task-1-setup-types.txt

  Scenario: TypeScript compilation succeeds
    Tool: Bash
    Steps:
      1. Run: bunx tsc --noEmit
      2. Assert: exit code 0
    Expected Result: Zero type errors
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `feat(setup): add setup types and binary detection`
  - Files: `src/setup/types.ts`, `src/setup/index.ts`, `src/setup/types.test.ts`
  - Pre-commit: `bun test src/setup/ && bunx tsc --noEmit`

- [x] 2. Detect Binary Step

  **What to do**:
  - Create `src/setup/steps/detect-binary.ts` with function:
    ```typescript
    export async function detectBinary(deps: SetupDeps): Promise<SetupStepResult>
    ```
  - Use `deps.which("claude-mem")` to check if binary exists in PATH
  - Also check if `~/.claude-mem/` directory exists via `deps.fileExists()` (for installations without PATH binary)
  - Return `{ status: "success", message: "claude-mem found at /path/to/binary" }` if found
  - Return `{ status: "failed", message: "claude-mem not found" }` if not found
  - Write tests in `src/setup/steps/detect-binary.test.ts`:
    - Test: binary found via which → returns success with path
    - Test: binary not found but ~/.claude-mem exists → returns success
    - Test: neither binary nor data dir → returns failed
    - All tests use injected deps (no real filesystem)

  **Must NOT do**:
  - Must NOT use `Bun.which` directly — use `deps.which`
  - Must NOT throw on any failure

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 3, 7
  - **Blocked By**: Task 1 (needs SetupDeps type)

  **References**:

  **Pattern References**:
  - `src/utils/detect.ts:56-70` (`detectClaudeMem()`) — Existing detection logic. Follow same try-catch-return-default pattern.

  **API/Type References**:
  - `src/setup/types.ts:SetupDeps` — Use `deps.which()` and `deps.fileExists()`
  - `src/setup/types.ts:SetupStepResult` — The return type

  **Acceptance Criteria**:
  - [ ] File created: `src/setup/steps/detect-binary.ts`
  - [ ] File created: `src/setup/steps/detect-binary.test.ts`
  - [ ] `bun test src/setup/steps/detect-binary.test.ts` → PASS (3+ tests)
  - [ ] `bunx tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Detection with injected mock deps
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test src/setup/steps/detect-binary.test.ts
      2. Assert: 3+ tests pass, 0 failures
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-2-detect-binary.txt
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `feat(setup): add setup types and binary detection`
  - Files: `src/setup/steps/detect-binary.ts`, `src/setup/steps/detect-binary.test.ts`
  - Pre-commit: `bun test src/setup/ && bunx tsc --noEmit`

- [x] 3. Install Claude-Mem Step

  **What to do**:
  - Create `src/setup/steps/install-claude-mem.ts` with function:
    ```typescript
    export async function installClaudeMem(deps: SetupDeps): Promise<SetupStepResult>
    ```
  - First check if already installed: `deps.which("claude-mem")` → skip if found
  - If not installed, run `deps.exec(["npm", "install", "-g", "claude-mem"])`
  - Check exit code: 0 = success, non-zero = failed
  - Log progress: "Installing claude-mem..." before, result message after
  - Return appropriate `SetupStepResult`
  - Write tests in `src/setup/steps/install-claude-mem.test.ts`:
    - Test: already installed → returns skipped
    - Test: not installed, exec succeeds → returns success
    - Test: not installed, exec fails (exit code 1) → returns failed
    - Test: exec throws → returns failed
    - All tests use injected deps

  **Must NOT do**:
  - Must NOT call real `npm install` in tests
  - Must NOT throw on failure

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/setup/steps/detect-binary.ts` (from T2) — Same function signature pattern
  - `src/worker-manager.ts:40-70` (`startWorker()`) — "check if already done, then try" flow

  **API/Type References**:
  - `src/setup/types.ts:SetupDeps.exec` — `exec(cmd: string[]) => Promise<{ exitCode: number }>`
  - `src/setup/types.ts:SetupDeps.which` — Check if already installed

  **Acceptance Criteria**:
  - [ ] File created: `src/setup/steps/install-claude-mem.ts`
  - [ ] File created: `src/setup/steps/install-claude-mem.test.ts`
  - [ ] `bun test src/setup/steps/install-claude-mem.test.ts` → PASS (4+ tests)
  - [ ] `bunx tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Install step with mock deps — all paths
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test src/setup/steps/install-claude-mem.test.ts
      2. Assert: 4+ tests pass, 0 failures
    Expected Result: All tests pass, correct exec arguments verified
    Evidence: .sisyphus/evidence/task-3-install.txt
  ```

  **Commit**: YES (groups with Tasks 4, 5, 6)
  - Message: `feat(setup): add install, configure, copy steps and fix MCP config`
  - Pre-commit: `bun test src/setup/ && bunx tsc --noEmit`

- [x] 4. Configure MCP Step

  **What to do**:
  - Create `src/setup/steps/configure-mcp.ts` with function:
    ```typescript
    export async function configureMcp(deps: SetupDeps): Promise<SetupStepResult>
    ```
  - Read `~/.config/opencode/opencode.json` via `deps.readJson()`
  - If file doesn't exist or can't be parsed, return `{ status: "failed", message: "opencode.json not found or invalid" }`
  - Check if `mcp["claude-mem"]` already exists in the config object
  - If already exists: return `{ status: "skipped", message: "MCP already configured" }` — NEVER overwrite
  - If missing: add `mcp["claude-mem"]` with `{ type: "remote", url: "http://localhost:{port}/mcp", enabled: true }` where port comes from `deps.getWorkerPort()`
  - Write back with `deps.writeFile()` using `JSON.stringify(config, null, 2)` to preserve formatting
  - MUST preserve ALL existing keys in opencode.json (`$schema`, `plugin`, other `mcp` entries, etc.)
  - Log: "MCP configuration added to opencode.json. Restart opencode to activate."
  - Write tests in `src/setup/steps/configure-mcp.test.ts`:
    - Test: MCP already exists → returns skipped, writeFile NOT called
    - Test: MCP missing, adds it with correct port and enabled:true
    - Test: MCP missing, custom port from getWorkerPort → uses custom port in URL
    - Test: opencode.json doesn't exist → returns failed
    - Test: opencode.json is invalid JSON → returns failed, no crash
    - Test: preserves $schema and all other top-level keys

  **Must NOT do**:
  - Must NOT overwrite existing `mcp["claude-mem"]` entry
  - Must NOT delete or modify any existing keys in opencode.json
  - Must NOT hardcode port 37777 — use `deps.getWorkerPort()`
  - Must NOT crash on malformed JSON

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: JSON merge logic with multiple edge cases requires careful implementation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/utils/detect.ts:21-36` (`readSettings()`) — JSON file read pattern with try-catch and defaults. Follow same defensive approach for opencode.json reading.
  - `src/mcp-config.ts:16-23` (`generateMcpConfig()`) — Current MCP config generation. This step MUST add `enabled: true` which the current function does NOT produce.

  **API/Type References**:
  - `src/mcp-config.ts:3-6` (`McpConfig`) — Current MCP type. The step produces `{ type: "remote", url: string, enabled: true }` which extends this.
  - `src/setup/types.ts:SetupDeps.readJson` — For reading opencode.json
  - `src/setup/types.ts:SetupDeps.writeFile` — For writing opencode.json back
  - `src/setup/types.ts:SetupDeps.getWorkerPort` — For dynamic port in MCP URL

  **Test References**:
  - `src/mcp-config.test.ts` — Existing MCP config tests. Follow same assertion style.

  **WHY Each Reference Matters**:
  - `readSettings()`: Shows how to read JSON defensively in this codebase
  - `generateMcpConfig()`: The config shape to produce, but MUST add `enabled: true`
  - `getWorkerPort`: The MCP URL must use the user's configured port, not hardcoded 37777

  **Acceptance Criteria**:
  - [ ] File created: `src/setup/steps/configure-mcp.ts`
  - [ ] File created: `src/setup/steps/configure-mcp.test.ts`
  - [ ] `bun test src/setup/steps/configure-mcp.test.ts` → PASS (6+ tests)
  - [ ] `bunx tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Configure MCP with mock deps — all paths
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test src/setup/steps/configure-mcp.test.ts
      2. Assert: 6+ tests pass, 0 failures
      3. Verify: "skipped" test asserts writeFile was NOT called
      4. Verify: "adds MCP" test asserts writeFile was called with JSON containing enabled:true
      5. Verify: "custom port" test asserts URL contains custom port, not 37777
      6. Verify: "preserves keys" test asserts $schema and plugin keys are in output
    Expected Result: All tests pass with correct assertions
    Evidence: .sisyphus/evidence/task-4-configure-mcp.txt

  Scenario: Malformed JSON doesn't crash
    Tool: Bash (bun test)
    Steps:
      1. Run the specific test that feeds invalid JSON to readJson
      2. Assert: returns { status: "failed" }, no thrown exception
    Expected Result: Graceful failure
    Evidence: .sisyphus/evidence/task-4-malformed-json.txt
  ```

  **Commit**: YES (groups with Tasks 3, 5, 6)
  - Message: `feat(setup): add install, configure, copy steps and fix MCP config`
  - Pre-commit: `bun test src/setup/ && bunx tsc --noEmit`

- [x] 5. Copy Skills Step

  **What to do**:
  - Create `src/setup/steps/copy-skills.ts` with function:
    ```typescript
    export async function copySkills(deps: SetupDeps): Promise<SetupStepResult>
    ```
  - Source: `join(deps.pluginDir, "skills", "mem-search")` — plugin's own skills directory
  - Destination: `join(homedir(), ".config", "opencode", "skills", "mem-search")`
  - Check if destination already exists via `deps.fileExists()` → skip if exists (don't overwrite user's customizations)
  - Check if source exists via `deps.fileExists()` → fail gracefully if source missing
  - Create parent directory: `deps.mkdirp(join(homedir(), ".config", "opencode", "skills"))`
  - Copy: `deps.copyDir(source, destination, { recursive: true })`
  - Log progress: "Copying mem-search skill..." and result
  - Write tests in `src/setup/steps/copy-skills.test.ts`:
    - Test: destination already exists → returns skipped
    - Test: source missing → returns failed
    - Test: happy path → mkdirp called, copyDir called, returns success
    - Test: copyDir throws → returns failed

  **Must NOT do**:
  - Must NOT overwrite existing skill files
  - Must NOT use `directory` from PluginInput — use `deps.pluginDir`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/setup/steps/detect-binary.ts` (from T2) — Same step function pattern
  - `skills/mem-search/SKILL.md` — The file that gets copied. Confirm it exists in plugin directory.

  **API/Type References**:
  - `src/setup/types.ts:SetupDeps.copyDir` — Wraps `node:fs/promises` `cp()`
  - `src/setup/types.ts:SetupDeps.mkdirp` — Wraps `node:fs/promises` `mkdir({ recursive: true })`
  - `src/setup/types.ts:SetupDeps.fileExists` — Check source/destination existence
  - `src/setup/types.ts:SetupDeps.pluginDir` — Plugin root directory (from `import.meta.dir`)

  **WHY Each Reference Matters**:
  - `detect-binary.ts`: Consistent step pattern
  - `SKILL.md`: Verifies source file exists and gives executor confidence about what's being copied
  - `pluginDir`: CRITICAL — this is from `import.meta.dir`, NOT from PluginInput.directory

  **Acceptance Criteria**:
  - [ ] File created: `src/setup/steps/copy-skills.ts`
  - [ ] File created: `src/setup/steps/copy-skills.test.ts`
  - [ ] `bun test src/setup/steps/copy-skills.test.ts` → PASS (4+ tests)
  - [ ] `bunx tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Copy skills with mock deps
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test src/setup/steps/copy-skills.test.ts
      2. Assert: 4+ tests pass, 0 failures
      3. Verify: "skipped" test asserts copyDir was NOT called
      4. Verify: "success" test asserts mkdirp was called before copyDir
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-5-copy-skills.txt
  ```

  **Commit**: YES (groups with Tasks 3, 4, 6)
  - Message: `feat(setup): add install, configure, copy steps and fix MCP config`
  - Pre-commit: `bun test src/setup/ && bunx tsc --noEmit`

- [x] 6. Fix generateMcpConfig to Include `enabled: true`

  **What to do**:
  - Update `src/mcp-config.ts` `McpConfig` interface to add `enabled?: boolean`
  - Update `generateMcpConfig()` to include `enabled: true` in the output
  - Update existing tests in `src/mcp-config.test.ts` to expect `enabled: true`
  - This is a BUGFIX: the current config doesn't match what opencode actually uses

  **Must NOT do**:
  - Must NOT change the function signature
  - Must NOT remove any existing fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 3-line change in source + test update
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5)
  - **Blocks**: Tasks 4, 7
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/mcp-config.ts:16-23` — The function to modify. Add `enabled: true` to the returned object.
  - `src/mcp-config.ts:3-6` (`McpConfig` interface) — Add `enabled?: boolean` field.
  - `src/mcp-config.test.ts` — Update assertions to expect `enabled: true`.

  **External References**:
  - User's actual `~/.config/opencode/opencode.json` has `"enabled": true` in the MCP entry. This is the format opencode expects.

  **Acceptance Criteria**:
  - [ ] `src/mcp-config.ts` updated: `McpConfig` has `enabled?: boolean`, `generateMcpConfig()` returns `enabled: true`
  - [ ] `src/mcp-config.test.ts` updated: tests pass with `enabled: true`
  - [ ] `bun test src/mcp-config.test.ts` → PASS
  - [ ] `bunx tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: MCP config includes enabled:true
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test src/mcp-config.test.ts
      2. Assert: all tests pass
      3. Verify: test output confirms enabled:true in generated config
    Expected Result: All tests pass with enabled:true in output
    Evidence: .sisyphus/evidence/task-6-mcp-config.txt
  ```

  **Commit**: YES (groups with Tasks 3, 4, 5)
  - Message: `feat(setup): add install, configure, copy steps and fix MCP config`
  - Pre-commit: `bun test && bunx tsc --noEmit`

- [x] 7. Auto-Setup Orchestrator

  **What to do**:
  - Create `src/setup/auto-setup.ts` with the main orchestrator function:
    ```typescript
    export async function autoSetup(deps: SetupDeps): Promise<SetupResult>
    ```
  - Runs all setup steps in sequence (order matters: detect → install → configure → copy → start worker):
    1. `detectBinary(deps)` — check if claude-mem exists
    2. If detect failed: `installClaudeMem(deps)` — try to install it
    3. `configureMcp(deps)` — add MCP to opencode.json if missing
    4. `copySkills(deps)` — copy skill files if missing
    5. Start worker if not running (reuse existing `isWorkerRunning` + `startWorker` from `worker-manager.ts`, but call through deps)
  - Wrap ENTIRE function in try-catch — never throw
  - Log overall result summary: "Setup complete: N steps succeeded, N skipped, N failed"
  - Return `SetupResult` with status of each step
  - Add `startWorkerStep` to SetupDeps or call it directly (the existing `startWorker()` is already well-tested)
  - Write tests in `src/setup/auto-setup.test.ts`:
    - Test: all steps succeed → returns all success
    - Test: detect fails, install succeeds → binary: failed, install: success
    - Test: detect succeeds → install is skipped
    - Test: one step throws → other steps still run, no crash
    - Test: all steps fail → returns all failed, no crash
    - All tests use injected deps

  **Must NOT do**:
  - Must NOT throw from autoSetup
  - Must NOT block forever
  - Must NOT use real filesystem or network

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Orchestrates multiple steps with conditional logic and error handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential with T8)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 2, 3, 4, 5, 6

  **References**:

  **Pattern References**:
  - `src/plugin.ts:11-75` (main plugin function) — Shows the init flow pattern: detect → log status → register hooks. Auto-setup follows the same "check state, act, log" approach but for installation.
  - `src/plugin.ts:78-148` (`createPluginWithDependencies`) — DI pattern. `autoSetup` follows the same: accept `deps`, call deps methods.
  - `src/worker-manager.ts:40-70` (`startWorker()`) — The worker start logic to integrate. Either import directly or add a `startWorker` method to deps.

  **API/Type References**:
  - `src/setup/types.ts:SetupDeps` — The full deps interface
  - `src/setup/types.ts:SetupResult` — The return type
  - `src/setup/steps/detect-binary.ts:detectBinary` — Step 1
  - `src/setup/steps/install-claude-mem.ts:installClaudeMem` — Step 2
  - `src/setup/steps/configure-mcp.ts:configureMcp` — Step 3
  - `src/setup/steps/copy-skills.ts:copySkills` — Step 4
  - `src/worker-manager.ts:startWorker` — Step 5 (worker start)

  **WHY Each Reference Matters**:
  - `plugin.ts` main function: Shows the flow pattern to follow
  - `createPluginWithDependencies`: DI pattern to mirror
  - Individual steps: These are what the orchestrator calls in sequence
  - `startWorker()`: Reuse existing worker management, don't reimplement

  **Acceptance Criteria**:
  - [ ] File created: `src/setup/auto-setup.ts`
  - [ ] File created: `src/setup/auto-setup.test.ts`
  - [ ] `bun test src/setup/auto-setup.test.ts` → PASS (5+ tests)
  - [ ] `bunx tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Orchestrator runs all steps
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test src/setup/auto-setup.test.ts
      2. Assert: 5+ tests pass, 0 failures
      3. Verify: "all succeed" test returns SetupResult with all statuses
      4. Verify: "one throws" test still completes without crashing
    Expected Result: All tests pass, no unhandled exceptions
    Evidence: .sisyphus/evidence/task-7-orchestrator.txt

  Scenario: Full setup module tests pass together
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test src/setup/
      2. Assert: all tests in setup/ pass (detect + install + configure + copy + orchestrator)
    Expected Result: All setup tests pass as a group
    Evidence: .sisyphus/evidence/task-7-full-setup.txt
  ```

  **Commit**: YES (groups with Tasks 8, 9)
  - Message: `feat(setup): add orchestrator and integrate into plugin`
  - Pre-commit: `bun test && bunx tsc --noEmit`

- [x] 8. Integrate Auto-Setup into Plugin

  **What to do**:
  - Modify `src/plugin.ts` to call `autoSetup()` during plugin init
  - Add import: `import { autoSetup } from "./setup/auto-setup.js"`
  - Add import: `import { createDefaultDeps } from "./setup/types.js"`
  - After the `detectClaudeMem()` call (line ~37-38), add auto-setup integration:
    ```typescript
    // Auto-setup: install/configure claude-mem if needed (fire-and-forget)
    if (!detection.workerRunning) {
      const setupDeps = createDefaultDeps(log);
      void autoSetup(setupDeps).then(async (result) => {
        // If setup started the worker, update state
        if (result.worker.status === "success") {
          state.isWorkerRunning = true;
          log("Auto-setup started the worker. Memory features now active.");
        }
      });
    }
    ```
  - CRITICAL: This must be `void` (fire-and-forget). The plugin init MUST NOT await auto-setup.
  - Also update `createPluginWithDependencies` with same integration (for testing)
  - Update `src/index.ts` to re-export setup types: `export { autoSetup } from "./setup/auto-setup.js"`
  - Update existing plugin tests to account for the new code path
  - Write additional test:
    - Test: when worker not running, autoSetup is called (mock autoSetup)
    - Test: when worker running, autoSetup is NOT called

  **Must NOT do**:
  - Must NOT `await` autoSetup in plugin init (must be fire-and-forget)
  - Must NOT break any of the 100 existing tests
  - Must NOT change the plugin's return type or hook behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: ~10 lines of new code in plugin.ts + test updates
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 7)
  - **Blocks**: Task 10
  - **Blocked By**: Task 7

  **References**:

  **Pattern References**:
  - `src/plugin.ts:37-47` — Current detection + logging block. Auto-setup goes right after this.
  - `src/plugin.ts:109-119` — Same block in `createPluginWithDependencies`. Must add setup there too.

  **API/Type References**:
  - `src/setup/auto-setup.ts:autoSetup` — The function to call
  - `src/setup/types.ts:createDefaultDeps` — Factory to create real deps
  - `src/setup/types.ts:SetupResult` — Result type to check worker status

  **Test References**:
  - `src/plugin.test.ts` — Existing plugin tests. Must all still pass after changes.

  **WHY Each Reference Matters**:
  - `plugin.ts:37-47`: Exact insertion point for auto-setup call
  - `plugin.test.ts`: Must verify zero regressions in existing tests

  **Acceptance Criteria**:
  - [ ] `src/plugin.ts` updated with auto-setup call (fire-and-forget)
  - [ ] `src/index.ts` updated with setup re-exports
  - [ ] `bun test src/plugin.test.ts` → PASS (all existing tests)
  - [ ] `bun test` → PASS (all 100+ tests)
  - [ ] `bunx tsc --noEmit` → 0 errors

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Plugin init calls autoSetup when worker not running
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test src/plugin.test.ts
      2. Assert: all existing tests pass
      3. Assert: new test verifies autoSetup is called when worker not detected
    Expected Result: All tests pass, autoSetup integration verified
    Evidence: .sisyphus/evidence/task-8-plugin-integration.txt

  Scenario: Full test suite passes (regression check)
    Tool: Bash (bun test)
    Steps:
      1. Run: bun test
      2. Assert: 100+ tests pass, 0 failures
    Expected Result: Zero regressions
    Evidence: .sisyphus/evidence/task-8-regression.txt
  ```

  **Commit**: YES (groups with Tasks 7, 9)
  - Message: `feat(setup): add orchestrator and integrate into plugin`
  - Pre-commit: `bun test && bunx tsc --noEmit`

- [x] 9. Update README with Auto-Setup Documentation

  **What to do**:
  - Update `README.md` to document the auto-setup feature
  - Add a new section "Automatic Setup" after the existing "Installation" section
  - Explain what happens automatically when the plugin loads:
    - Installs claude-mem if not found
    - Starts the worker if not running
    - Configures MCP in opencode.json if not present
    - Copies mem-search skill if not present
  - Add a "What Gets Configured" section listing the files/configs modified
  - Update the "Prerequisites" section: remove claude-mem as a prerequisite (it's auto-installed now)
  - Update troubleshooting section with auto-setup related tips
  - Keep it concise — no excessive documentation

  **Must NOT do**:
  - Must NOT remove existing README sections that are still relevant
  - Must NOT add emojis
  - Must NOT over-document

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation update
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (parallel with T7, T8)
  - **Blocks**: None
  - **Blocked By**: Task 7 (needs to know final behavior)

  **References**:

  **Pattern References**:
  - `README.md` — Current README to update. Preserve existing structure, add new sections.

  **External References**:
  - oh-my-opencode installation guide (user referenced as inspiration for polish)

  **Acceptance Criteria**:
  - [ ] `README.md` updated with auto-setup documentation
  - [ ] Prerequisites section updated (claude-mem no longer required upfront)
  - [ ] No broken markdown links

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: README is valid markdown
    Tool: Bash
    Steps:
      1. Read README.md
      2. Verify all code blocks are properly closed
      3. Verify section headers are properly nested
    Expected Result: Valid markdown structure
    Evidence: .sisyphus/evidence/task-9-readme.txt
  ```

  **Commit**: YES (groups with Tasks 7, 8)
  - Message: `feat(setup): add orchestrator and integrate into plugin`
  - Pre-commit: `bun test && bunx tsc --noEmit`

- [x] 10. Full Regression Test Run

  **What to do**:
  - Run the complete test suite: `bun test`
  - Run type checking: `bunx tsc --noEmit`
  - Verify all 100+ original tests still pass
  - Verify all new setup tests pass
  - Count total tests and report
  - If any failures: fix them (this is a verification + fix task)

  **Must NOT do**:
  - Must NOT skip failing tests
  - Must NOT delete tests to make suite pass

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Run commands and verify output
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 8)
  - **Blocks**: F1, F2, F3
  - **Blocked By**: Task 8

  **References**:
  - `package.json:13-14` — Test and check scripts
  - All test files in `src/` and `tests/`

  **Acceptance Criteria**:
  - [ ] `bun test` → PASS (all tests, 0 failures)
  - [ ] `bunx tsc --noEmit` → 0 errors
  - [ ] Total test count reported (should be 100+ original + 20+ new)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Complete test suite
    Tool: Bash
    Steps:
      1. Run: bun test
      2. Capture output including pass/fail counts
      3. Run: bunx tsc --noEmit
      4. Assert: both commands exit with code 0
    Expected Result: All tests pass, zero type errors
    Evidence: .sisyphus/evidence/task-10-regression.txt
  ```

  **Commit**: NO (verification only)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 3 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `bunx tsc --noEmit` + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches without comments, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(setup): add setup types and binary detection` — `src/setup/types.ts`, `src/setup/steps/detect-binary.ts`, `src/setup/steps/detect-binary.test.ts`
- **Wave 2**: `feat(setup): add install, configure, copy steps` — `src/setup/steps/*.ts`, `src/mcp-config.ts`
- **Wave 3**: `feat(setup): add orchestrator and integrate into plugin` — `src/setup/auto-setup.ts`, `src/plugin.ts`, `README.md`

---

## Success Criteria

### Verification Commands
```bash
bun test              # Expected: all tests pass (100 existing + ~30 new)
bunx tsc --noEmit     # Expected: 0 errors
bun test src/setup/   # Expected: all setup-specific tests pass
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (existing + new)
- [ ] TypeScript clean
- [ ] Plugin loads without blocking opencode
- [ ] Setup is fully idempotent
