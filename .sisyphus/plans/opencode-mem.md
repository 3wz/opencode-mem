# OpenCode-Mem: Claude-Mem Plugin/Adapter for OpenCode

## TL;DR

> **Quick Summary**: Build a TypeScript opencode plugin that bridges claude-mem's persistent memory system to opencode, mapping claude-mem's 5 lifecycle hooks to opencode's plugin event system and sharing the same worker service (port 37777) and SQLite database. Both claude-code and opencode see the same memory.
>
> **Deliverables**:
> - `opencode-claude-mem` npm package (also works as local `.opencode/plugins/` file)
> - Plugin mapping all claude-mem lifecycle hooks to opencode events
> - MCP server configuration for claude-mem search tools
> - `mem-search` skill ported to opencode format
> - Auto-detection of existing claude-mem worker
> - TDD test suite with bun:test
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: T1 → T3 → T7 → T9 → T14 → T18 → F1-F4

---

## Context

### Original Request
Create a plugin/adapter for opencode that makes claude-mem work identically to how it works with claude-code — as a 100% inline plugin, not just MCP. If claude-mem is already initialized from claude-code, opencode should connect to the same worker and share memory. Acts as a bridge maintaining the same process for both projects.

### Interview Summary
**Key Discussions**:
- **Worker strategy**: Shared worker on port 37777 — reuse existing claude-mem worker, start if not running
- **Distribution**: Both npm package + local plugin support
- **Features**: ALL selected — MCP search, mem-search skill, context injection, auto-detect, web viewer
- **Test strategy**: TDD with bun:test

**Research Findings**:
- Claude-mem uses 5 lifecycle hooks (SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd) with a worker service on port 37777
- OpenCode plugins are JS/TS modules with `async ({ project, client, $, directory, worktree }) => Hooks`
- OpenCode has equivalent events: `session.created`, `session.idle`, `session.deleted`, `tool.execute.after`, `chat.message`
- OpenCode has `experimental.chat.system.transform` for system prompt injection (ideal for context)
- OpenCode has `experimental.session.compacting` for memory persistence across compactions
- Claude-mem worker API is HTTP REST on port 37777 with endpoints for context, observations, summaries
- Claude-mem stores data in `~/.claude-mem/claude-mem.db` (SQLite + ChromaDB)
- OpenCode uses `@opencode-ai/plugin` package with `tool()` helper for custom tools

### Self-Analysis (Metis-equivalent)
**Identified Gaps** (addressed in plan):
- Privacy tag stripping (`<private>`, `<claude-mem-context>`) must be replicated in opencode hooks
- Tool skip list (TodoWrite, AskUserQuestion, etc.) must be replicated
- Worker discovery strategy: health check → try start → graceful degradation
- Session ID mapping: use opencode's session ID as `claude_session_id`
- Race conditions: claude-code + opencode hitting same worker simultaneously (SQLite WAL handles this)
- Bun availability: opencode uses Bun internally, so it's guaranteed available
- Error handling: plugin must never break opencode if worker is unavailable

---

## Work Objectives

### Core Objective
Enable opencode to use claude-mem's persistent memory system via an inline plugin that connects to the same worker service and database that claude-code uses, providing seamless cross-tool memory.

### Concrete Deliverables
- `opencode-claude-mem` npm package published and installable via opencode.json
- Plugin TypeScript source with full hook mappings
- HTTP client module for claude-mem worker API
- Auto-detect and worker lifecycle management
- MCP server configuration (search, timeline, get_observations)
- mem-search SKILL.md for opencode
- TDD test suite (bun:test)
- README with installation instructions

### Definition of Done
- [ ] `bun test` passes all test files
- [ ] Plugin loads in opencode without errors
- [ ] Context from claude-code sessions appears in opencode sessions
- [ ] Tool observations from opencode are captured in claude-mem DB
- [ ] MCP search tools return results from both claude-code and opencode sessions
- [ ] Plugin gracefully degrades when worker is unavailable

### Must Have
- Shared worker service (port 37777) — same database for both tools
- Context injection into opencode sessions from prior sessions
- Tool observation capture (PostToolUse equivalent)
- Session lifecycle management (create, idle/summary, cleanup)
- Privacy tag stripping before sending data to worker
- Tool skip list (filter low-value tools)
- Graceful degradation when worker unavailable
- TDD test coverage

### Must NOT Have (Guardrails)
- Must NOT modify claude-mem's core source code
- Must NOT create a separate database — uses shared `~/.claude-mem/claude-mem.db`
- Must NOT block opencode's main process — all worker calls are fire-and-forget with short timeouts
- Must NOT include ragtime module (separate license)
- Must NOT modify the web viewer UI
- Must NOT add unnecessary npm dependencies (keep it lightweight)
- Must NOT use `console.log` in production code (use opencode's `client.app.log()`)
- Must NOT hardcode paths — respect `~/.claude-mem/settings.json` for data directory and port

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: TDD (test-first)
- **Framework**: bun:test (built into Bun runtime)
- **Each task follows**: RED (failing test) → GREEN (minimal implementation) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **HTTP client**: Use Bash (curl) — assert status + response against mock/real worker
- **Plugin hooks**: Use Bash (bun test) — unit tests with mocked opencode context
- **Integration**: Use Bash (bun run) — start opencode with plugin loaded, verify behavior
- **MCP tools**: Use Bash (curl) — query MCP endpoints, assert response format

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — scaffolding, types, test infra):
├── Task 1: Project scaffolding (package.json, tsconfig, bun setup) [quick]
├── Task 2: Type definitions and interfaces [quick]
├── Task 3: Claude-mem HTTP client module [deep]
├── Task 4: Privacy tag stripping utility [quick]
├── Task 5: Tool skip list filter utility [quick]
└── Task 6: Auto-detect / health check module [quick]

Wave 2 (Core Plugin — hook implementations, MAX PARALLEL):
├── Task 7: Plugin entry point + session lifecycle hooks [deep]
├── Task 8: Context injection hook (experimental.chat.system.transform) [deep]
├── Task 9: Tool observation hook (tool.execute.after) [deep]
├── Task 10: User prompt capture hook (chat.message) [deep]
├── Task 11: Session idle/summary hook (session.idle) [deep]
├── Task 12: Compaction memory hook (experimental.session.compacting) [deep]
└── Task 13: Worker lifecycle manager (start/stop) [unspecified-high]

Wave 3 (Extended Features — MCP, skill, packaging):
├── Task 14: MCP server configuration generator [quick]
├── Task 15: mem-search skill (SKILL.md) [writing]
├── Task 16: npm package configuration + exports [quick]
└── Task 17: README and installation guide [writing]

Wave 4 (Integration — end-to-end, verification):
└── Task 18: End-to-end integration test suite [deep]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: T1 → T3 → T7 → T9 → T14 → T18 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 6 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2-6 | 1 |
| 2 | 1 | 3-13 | 1 |
| 3 | 1, 2 | 7-13, 18 | 1 |
| 4 | 1 | 9, 10 | 1 |
| 5 | 1 | 9 | 1 |
| 6 | 1, 2, 3 | 7, 13 | 1 |
| 7 | 2, 3, 6 | 8-12, 18 | 2 |
| 8 | 3, 7 | 18 | 2 |
| 9 | 3, 4, 5, 7 | 18 | 2 |
| 10 | 3, 4, 7 | 18 | 2 |
| 11 | 3, 7 | 18 | 2 |
| 12 | 3, 7 | 18 | 2 |
| 13 | 3, 6 | 18 | 2 |
| 14 | 2 | 18 | 3 |
| 15 | — | 18 | 3 |
| 16 | 7 | 17 | 3 |
| 17 | 16 | 18 | 3 |
| 18 | 7-17 | F1-F4 | 4 |

### Agent Dispatch Summary

- **Wave 1**: **6 tasks** — T1 `quick`, T2 `quick`, T3 `deep`, T4 `quick`, T5 `quick`, T6 `quick`
- **Wave 2**: **7 tasks** — T7-T12 `deep`, T13 `unspecified-high`
- **Wave 3**: **4 tasks** — T14 `quick`, T15 `writing`, T16 `quick`, T17 `writing`
- **Wave 4**: **1 task** — T18 `deep`
- **FINAL**: **4 tasks** — F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**

- [x] 1. Project Scaffolding + Test Infrastructure

  **What to do**:
  - Initialize git repo (`git init`)
  - Create `package.json` with name `opencode-claude-mem`, type `module`, exports map
  - Add dev dependencies: `@opencode-ai/plugin`, `typescript`, `@types/bun`
  - Create `tsconfig.json` targeting ES2022, ESNext modules, strict mode
  - Create directory structure: `src/`, `src/hooks/`, `src/utils/`, `tests/`, `skills/`
  - Create `bunfig.toml` for test configuration
  - Write first test: `tests/setup.test.ts` — verify test runner works (expect(true).toBe(true))
  - Verify `bun test` runs and passes

  **Must NOT do**:
  - Do NOT add unnecessary dependencies (no express, no lodash, etc.)
  - Do NOT create .opencode/ directory structure yet (that's for consumers)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — this is the foundation
  - **Parallel Group**: Wave 1 (first task)
  - **Blocks**: Tasks 2, 3, 4, 5, 6
  - **Blocked By**: None (can start immediately)

  **References**:
  - Claude-mem's `package.json`: https://github.com/thedotmack/claude-mem/blob/main/package.json — reference for npm metadata patterns
  - OpenCode plugin types: `@opencode-ai/plugin` npm package — provides Plugin type and tool() helper
  - OpenCode ecosystem plugins: `opencode-wakatime`, `opencode-helicone-session` — naming convention and package.json patterns

  **Acceptance Criteria**:
  - [ ] `bun test` runs and passes (1 test, 0 failures)
  - [ ] `bun check` (tsc --noEmit) passes with no errors
  - [ ] package.json has correct name, type, exports

  **QA Scenarios:**

  ```
  Scenario: Test runner works
    Tool: Bash
    Preconditions: Fresh project directory
    Steps:
      1. Run `bun test`
      2. Assert exit code 0
      3. Assert output contains '1 pass'
    Expected Result: bun:test runs successfully, 1 test passes
    Failure Indicators: Non-zero exit code, 'fail' in output
    Evidence: .sisyphus/evidence/task-1-test-runner.txt

  Scenario: TypeScript compiles
    Tool: Bash
    Preconditions: tsconfig.json exists
    Steps:
      1. Run `bunx tsc --noEmit`
      2. Assert exit code 0
    Expected Result: No TypeScript compilation errors
    Failure Indicators: Non-zero exit code, error messages
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(core): scaffold project with types, HTTP client, and utilities`
  - Files: `package.json, tsconfig.json, bunfig.toml, tests/setup.test.ts, src/`
  - Pre-commit: `bun test`

- [x] 2. Type Definitions and Interfaces

  **What to do**:
  - Write test first: `src/types.test.ts` — verify type exports compile correctly
  - Create `src/types.ts` with all shared interfaces:
    - `ClaudeMemConfig` — settings from `~/.claude-mem/settings.json` (port, dataDir, model, logLevel)
    - `WorkerHealth` — response shape from GET /health
    - `ContextInjectionResponse` — response from GET /api/context/inject
    - `SessionInitPayload` — POST body for /sessions/{id}/init
    - `ObservationPayload` — POST body for /api/sessions/observations
    - `SummarizePayload` — POST body for /api/sessions/summarize
    - `SessionCompletePayload` — POST body for /api/sessions/complete
    - `PluginState` — internal state (sessionDbId, isWorkerRunning, projectName)
    - `OpenCodeMemOptions` — plugin initialization options (port, autoStart, timeout)
  - Export all types from `src/index.ts`

  **Must NOT do**:
  - Do NOT import runtime dependencies — types only
  - Do NOT add implementation logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`typescript-advanced-types`]
    - `typescript-advanced-types`: Type definitions require precise TS modeling

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T4, T5 after T1 completes)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 3, 7-14
  - **Blocked By**: Task 1

  **References**:
  - Claude-mem worker HTTP API docs: https://docs.claude-mem.ai/architecture/worker-service — exact request/response shapes
  - Claude-mem hooks architecture: https://docs.claude-mem.ai/hooks-architecture — hook input/output types
  - `@opencode-ai/plugin` source: https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts — Plugin, Hooks, PluginInput types

  **Acceptance Criteria**:
  - [ ] `bun test src/types.test.ts` passes
  - [ ] All interfaces are exported and importable
  - [ ] `bunx tsc --noEmit` passes

  **QA Scenarios:**

  ```
  Scenario: Types compile and export correctly
    Tool: Bash
    Preconditions: src/types.ts exists with all interfaces
    Steps:
      1. Run `bun test src/types.test.ts`
      2. Assert output contains 'pass'
      3. Run `bunx tsc --noEmit`
      4. Assert exit code 0
    Expected Result: All type definitions compile without errors
    Failure Indicators: TypeScript compilation errors, missing exports
    Evidence: .sisyphus/evidence/task-2-types-compile.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(core): scaffold project with types, HTTP client, and utilities`
  - Files: `src/types.ts, src/types.test.ts`
  - Pre-commit: `bun test`

- [x] 3. Claude-Mem HTTP Client Module

  **What to do**:
  - Write tests first: `src/client.test.ts`
    - Test: `healthCheck()` returns true when worker responds 200
    - Test: `healthCheck()` returns false when worker unreachable (timeout)
    - Test: `getContext(project)` calls GET /api/context/inject?project=X
    - Test: `initSession(sessionId, project, prompt)` calls POST /sessions/{id}/init
    - Test: `sendObservation(payload)` calls POST /api/sessions/observations
    - Test: `sendSummary(payload)` calls POST /api/sessions/summarize
    - Test: `completeSession(payload)` calls POST /api/sessions/complete
    - Test: All methods have 2-second timeout (fire-and-forget)
    - Test: All methods catch errors silently (graceful degradation)
  - Implement `src/client.ts`:
    - `ClaudeMemClient` class with configurable port (default 37777)
    - Uses native `fetch()` (no axios dependency)
    - All methods return Promises that never reject (catch internally, log via callback)
    - Configurable timeout (default 2000ms) via AbortController
    - `healthCheck()` with retry logic (max 3 attempts, 1s delay)

  **Must NOT do**:
  - Do NOT add axios, got, or other HTTP libraries — use native fetch
  - Do NOT throw errors from client methods — always catch and return gracefully

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`native-data-fetching`]
    - `native-data-fetching`: Covers fetch API, error handling, timeout patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T4, T5 after T1+T2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 7-13, 18
  - **Blocked By**: Tasks 1, 2

  **References**:
  - Claude-mem worker API endpoints: https://docs.claude-mem.ai/architecture/hooks — exact API contracts per hook
  - Claude-mem save-hook fire-and-forget pattern: https://docs.claude-mem.ai/hooks-architecture — 2s timeout, non-blocking pattern
  - Native fetch with AbortController: https://developer.mozilla.org/en-US/docs/Web/API/AbortController — timeout implementation

  **Acceptance Criteria**:
  - [ ] `bun test src/client.test.ts` passes (9+ tests)
  - [ ] All methods use native fetch (no external HTTP library)
  - [ ] All methods have 2s timeout
  - [ ] All methods catch errors silently
  - [ ] healthCheck has retry logic (3 attempts)

  **QA Scenarios:**

  ```
  Scenario: Health check when worker is running
    Tool: Bash
    Preconditions: Claude-mem worker running on port 37777
    Steps:
      1. Run `bun test src/client.test.ts --test-name-pattern 'healthCheck.*true'`
      2. Assert test passes
    Expected Result: healthCheck() returns true
    Failure Indicators: Test failure, timeout
    Evidence: .sisyphus/evidence/task-3-health-check-running.txt

  Scenario: Health check when worker is NOT running
    Tool: Bash
    Preconditions: No process on port 37777
    Steps:
      1. Run `bun test src/client.test.ts --test-name-pattern 'healthCheck.*false'`
      2. Assert test passes
    Expected Result: healthCheck() returns false (no crash, no throw)
    Failure Indicators: Unhandled rejection, test failure
    Evidence: .sisyphus/evidence/task-3-health-check-not-running.txt

  Scenario: Fire-and-forget timeout
    Tool: Bash
    Preconditions: Mock server with 5s delay
    Steps:
      1. Run `bun test src/client.test.ts --test-name-pattern 'timeout'`
      2. Assert test completes in under 3 seconds
    Expected Result: Client aborts after 2s, no error thrown
    Failure Indicators: Test takes > 3s, unhandled error
    Evidence: .sisyphus/evidence/task-3-timeout.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(core): scaffold project with types, HTTP client, and utilities`
  - Files: `src/client.ts, src/client.test.ts`
  - Pre-commit: `bun test`


- [x] 4. Privacy Tag Stripping Utility

  **What to do**:
  - Write tests first: `src/utils/strip-tags.test.ts`
    - Test: strips `<private>sensitive data</private>` from strings
    - Test: strips `<claude-mem-context>...</claude-mem-context>` from strings
    - Test: handles nested tags
    - Test: handles empty string input
    - Test: handles string with no tags (returns unchanged)
    - Test: handles JSON string input (strips from values)
    - Test: ReDoS protection — max 100 tag replacements
  - Implement `src/utils/strip-tags.ts`:
    - `stripMemoryTagsFromText(text: string): string`
    - `stripMemoryTagsFromJson(jsonString: string): string`
    - Regex-based with iteration limit (100 max) for ReDoS protection

  **Must NOT do**:
  - Do NOT use external regex libraries
  - Do NOT remove more than 100 tags (ReDoS protection)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T2, T3, T5, T6)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Task 1

  **References**:
  - Claude-mem tag stripping source: `src/utils/tag-stripping.ts` in claude-mem repo — exact regex patterns and logic
  - Claude-mem hooks docs: https://docs.claude-mem.ai/architecture/hooks — Privacy & Tag Stripping section

  **Acceptance Criteria**:
  - [ ] `bun test src/utils/strip-tags.test.ts` passes (7+ tests)
  - [ ] Both `<private>` and `<claude-mem-context>` tags stripped
  - [ ] ReDoS protection works (max 100 iterations)

  **QA Scenarios:**

  ```
  Scenario: Privacy tags stripped from text
    Tool: Bash
    Preconditions: src/utils/strip-tags.ts implemented
    Steps:
      1. Run `bun test src/utils/strip-tags.test.ts`
      2. Assert all tests pass
    Expected Result: All tag stripping tests pass
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-4-strip-tags.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Files: `src/utils/strip-tags.ts, src/utils/strip-tags.test.ts`

- [x] 5. Tool Skip List Filter Utility

  **What to do**:
  - Write tests first: `src/utils/tool-filter.test.ts`
    - Test: `shouldSkipTool('TodoWrite')` returns true
    - Test: `shouldSkipTool('AskUserQuestion')` returns true
    - Test: `shouldSkipTool('ListMcpResourcesTool')` returns true
    - Test: `shouldSkipTool('SlashCommand')` returns true
    - Test: `shouldSkipTool('Skill')` returns true
    - Test: `shouldSkipTool('read')` returns false (capture this tool)
    - Test: `shouldSkipTool('bash')` returns false
    - Test: `shouldSkipTool('edit')` returns false
    - Test: `shouldSkipTool('write')` returns false
  - Implement `src/utils/tool-filter.ts`:
    - `SKIP_TOOLS` const Set with low-value tool names
    - `shouldSkipTool(toolName: string): boolean`
    - Case-insensitive matching

  **Must NOT do**:
  - Do NOT make the skip list configurable yet (YAGNI)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T2, T3, T4, T6)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 9
  - **Blocked By**: Task 1

  **References**:
  - Claude-mem save-hook skip list: https://docs.claude-mem.ai/architecture/hooks — PostToolUse section, `SKIP_TOOLS` constant

  **Acceptance Criteria**:
  - [ ] `bun test src/utils/tool-filter.test.ts` passes (9+ tests)
  - [ ] All claude-mem skip tools are filtered

  **QA Scenarios:**

  ```
  Scenario: Tool filtering works correctly
    Tool: Bash
    Steps:
      1. Run `bun test src/utils/tool-filter.test.ts`
      2. Assert all tests pass
    Expected Result: Skip tools filtered, capture tools allowed
    Evidence: .sisyphus/evidence/task-5-tool-filter.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Files: `src/utils/tool-filter.ts, src/utils/tool-filter.test.ts`

- [x] 6. Auto-Detect and Health Check Module

  **What to do**:
  - Write tests first: `src/utils/detect.test.ts`
    - Test: `detectClaudeMem()` returns `{ installed: true, workerRunning: true, port: 37777 }` when worker is running
    - Test: `detectClaudeMem()` returns `{ installed: true, workerRunning: false }` when DB exists but worker not running
    - Test: `detectClaudeMem()` returns `{ installed: false, workerRunning: false }` when no DB found
    - Test: `readSettings()` reads port from `~/.claude-mem/settings.json`
    - Test: `readSettings()` returns defaults when settings file missing
    - Test: `getDataDir()` returns `~/.claude-mem` (default) or custom from settings
  - Implement `src/utils/detect.ts`:
    - `detectClaudeMem()` — check for DB file, check worker health
    - `readSettings()` — read `~/.claude-mem/settings.json` with defaults
    - `getDataDir()` — resolve data directory path
    - `getWorkerPort()` — resolve port (from settings or default 37777)
  - Uses `ClaudeMemClient.healthCheck()` from Task 3

  **Must NOT do**:
  - Do NOT search for claude-mem installation paths (just check DB and worker)
  - Do NOT modify settings.json

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T4, T5 after T1+T2+T3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 7, 13
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - Claude-mem settings: https://docs.claude-mem.ai/configuration — settings.json schema
  - Claude-mem data directory: `~/.claude-mem/` — default location for DB and settings

  **Acceptance Criteria**:
  - [ ] `bun test src/utils/detect.test.ts` passes (6+ tests)
  - [ ] Correctly detects worker running / not running / DB exists / missing

  **QA Scenarios:**

  ```
  Scenario: Auto-detect with worker running
    Tool: Bash
    Preconditions: Claude-mem worker on port 37777
    Steps:
      1. Run `bun test src/utils/detect.test.ts --test-name-pattern 'workerRunning.*true'`
      2. Assert passes
    Expected Result: Detects running worker
    Evidence: .sisyphus/evidence/task-6-detect-running.txt

  Scenario: Auto-detect without worker
    Tool: Bash
    Preconditions: No worker on port 37777, but ~/.claude-mem/claude-mem.db exists
    Steps:
      1. Run `bun test src/utils/detect.test.ts --test-name-pattern 'workerRunning.*false'`
      2. Assert passes
    Expected Result: Detects DB but no worker
    Evidence: .sisyphus/evidence/task-6-detect-db-only.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Files: `src/utils/detect.ts, src/utils/detect.test.ts`


- [x] 7. Plugin Entry Point + Session Lifecycle Hooks

  **What to do**:
  - Write tests first: `src/plugin.test.ts`
    - Test: Plugin export is a valid async function matching `Plugin` type
    - Test: Plugin initializes with correct context destructuring
    - Test: `session.created` event triggers session init via HTTP client
    - Test: `session.deleted` event triggers session complete via HTTP client
    - Test: Plugin auto-detects claude-mem on init
    - Test: Plugin logs web viewer URL on init (localhost:37777)
    - Test: Plugin handles worker-not-available gracefully (no crash)
  - Implement `src/plugin.ts`:
    - Default export: `OpenCodeMem` plugin function
    - On init: auto-detect claude-mem, log status
    - `event` handler for `session.created` → call `client.initSession()`
    - `event` handler for `session.deleted` → call `client.completeSession()`
    - Internal state tracking (sessionDbId, projectName, isConnected)
    - Use `client.app.log()` for logging (not console.log)
  - Re-export from `src/index.ts` as the package's main export

  **Must NOT do**:
  - Do NOT implement tool/message hooks here (separate tasks)
  - Do NOT use console.log (use client.app.log())
  - Do NOT block on worker connection (fire-and-forget)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — other Wave 2 tasks depend on this
  - **Parallel Group**: Wave 2 (first in wave)
  - **Blocks**: Tasks 8-12
  - **Blocked By**: Tasks 2, 3, 6

  **References**:
  - OpenCode plugin API: https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts — Plugin type, PluginInput, Hooks interface
  - OpenCode wakatime plugin: https://github.com/angristan/opencode-wakatime — production plugin pattern using `event` hook
  - OpenCode supermemory plugin: https://github.com/supermemoryai/opencode-supermemory — memory plugin pattern (closest analog)

  **Acceptance Criteria**:
  - [ ] `bun test src/plugin.test.ts` passes (7+ tests)
  - [ ] Plugin exports a valid `Plugin` function
  - [ ] Session lifecycle events trigger correct HTTP calls
  - [ ] Graceful degradation when worker unavailable

  **QA Scenarios:**

  ```
  Scenario: Plugin initializes and detects worker
    Tool: Bash
    Preconditions: Claude-mem worker running
    Steps:
      1. Run `bun test src/plugin.test.ts --test-name-pattern 'init'`
      2. Assert passes
    Expected Result: Plugin initializes, detects worker, logs status
    Evidence: .sisyphus/evidence/task-7-plugin-init.txt

  Scenario: Plugin handles missing worker gracefully
    Tool: Bash
    Preconditions: No worker running
    Steps:
      1. Run `bun test src/plugin.test.ts --test-name-pattern 'graceful'`
      2. Assert passes (no crash, no unhandled rejection)
    Expected Result: Plugin logs warning, continues without memory features
    Evidence: .sisyphus/evidence/task-7-graceful-degradation.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Message: `feat(plugin): implement core opencode plugin with all lifecycle hooks`
  - Files: `src/plugin.ts, src/plugin.test.ts, src/index.ts`
  - Pre-commit: `bun test`

- [x] 8. Context Injection Hook (experimental.chat.system.transform)

  **What to do**:
  - Write tests first: `src/hooks/context-inject.test.ts`
    - Test: Hook calls `client.getContext(project)` and appends result to `output.system`
    - Test: Hook formats context with `[claude-mem]` header
    - Test: Hook includes web viewer URL in injected context
    - Test: Hook skips injection when worker unavailable (no error)
    - Test: Hook skips injection when no prior context exists
  - Implement `src/hooks/context-inject.ts`:
    - Export `createContextInjectionHook(memClient, projectName)` factory
    - Returns an `experimental.chat.system.transform` handler
    - Calls `memClient.getContext(projectName)`
    - Formats as markdown with header, appends to `output.system`
    - Appends web viewer URL: `Memory viewer: http://localhost:{port}`
    - Catches all errors silently

  **Must NOT do**:
  - Do NOT inject huge amounts of context — use progressive disclosure format
  - Do NOT modify existing system prompt entries — only append

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9, T10, T11, T12)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 3, 7

  **References**:
  - OpenCode `experimental.chat.system.transform` hook: https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts — output.system array
  - Claude-mem context-hook output format: https://docs.claude-mem.ai/hooks-architecture — progressive disclosure table format

  **Acceptance Criteria**:
  - [ ] `bun test src/hooks/context-inject.test.ts` passes (5+ tests)
  - [ ] Context appears in system prompt when worker available
  - [ ] No error when worker unavailable

  **QA Scenarios:**

  ```
  Scenario: Context injected into system prompt
    Tool: Bash
    Steps:
      1. Run `bun test src/hooks/context-inject.test.ts --test-name-pattern 'appends.*system'`
      2. Assert passes
    Expected Result: output.system array has claude-mem context appended
    Evidence: .sisyphus/evidence/task-8-context-inject.txt

  Scenario: No injection when worker down
    Tool: Bash
    Steps:
      1. Run `bun test src/hooks/context-inject.test.ts --test-name-pattern 'skip'`
      2. Assert passes
    Expected Result: output.system unchanged, no error
    Evidence: .sisyphus/evidence/task-8-no-inject.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Files: `src/hooks/context-inject.ts, src/hooks/context-inject.test.ts`

- [x] 9. Tool Observation Hook (tool.execute.after)

  **What to do**:
  - Write tests first: `src/hooks/save-observation.test.ts`
    - Test: Captures tool name, input args, output from `tool.execute.after` event
    - Test: Strips privacy tags from tool input and output before sending
    - Test: Skips tools in the skip list (TodoWrite, etc.)
    - Test: Sends observation to worker via `client.sendObservation()`
    - Test: Uses fire-and-forget pattern (doesn't await, doesn't block)
    - Test: Passes opencode session ID as `claudeSessionId`
    - Test: Includes `cwd` (working directory) in payload
  - Implement `src/hooks/save-observation.ts`:
    - Export `createSaveObservationHook(memClient, state)` factory
    - Returns a `tool.execute.after` handler
    - Filters via `shouldSkipTool()`
    - Strips privacy tags via `stripMemoryTagsFromJson()`
    - Calls `memClient.sendObservation()` (fire-and-forget)

  **Must NOT do**:
  - Do NOT await the HTTP call (fire-and-forget)
  - Do NOT capture tool output if it exceeds 100KB (truncate)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T8, T10, T11, T12)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 3, 4, 5, 7

  **References**:
  - OpenCode `tool.execute.after` hook: `(input: { tool, sessionID, callID, args }, output: { title, output, metadata })` — mutable output
  - Claude-mem save-hook: https://docs.claude-mem.ai/architecture/hooks — PostToolUse section, observation payload shape

  **Acceptance Criteria**:
  - [ ] `bun test src/hooks/save-observation.test.ts` passes (7+ tests)
  - [ ] Skip list tools are filtered out
  - [ ] Privacy tags stripped before sending
  - [ ] Fire-and-forget (non-blocking)

  **QA Scenarios:**

  ```
  Scenario: Observation captured for valid tool
    Tool: Bash
    Steps:
      1. Run `bun test src/hooks/save-observation.test.ts --test-name-pattern 'captures'`
      2. Assert passes
    Expected Result: Observation sent to worker with correct payload
    Evidence: .sisyphus/evidence/task-9-observation-capture.txt

  Scenario: Skip list tools filtered
    Tool: Bash
    Steps:
      1. Run `bun test src/hooks/save-observation.test.ts --test-name-pattern 'skip'`
      2. Assert passes
    Expected Result: TodoWrite, AskUserQuestion etc. not sent to worker
    Evidence: .sisyphus/evidence/task-9-skip-filter.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Files: `src/hooks/save-observation.ts, src/hooks/save-observation.test.ts`

- [x] 10. User Prompt Capture Hook (chat.message)

  **What to do**:
  - Write tests first: `src/hooks/capture-prompt.test.ts`
    - Test: Captures user message text from `chat.message` hook
    - Test: Strips privacy tags from prompt before sending
    - Test: Skips fully private prompts (empty after stripping)
    - Test: Sends prompt to worker via `client.initSession()`
    - Test: Passes session ID and project name correctly
  - Implement `src/hooks/capture-prompt.ts`:
    - Export `createCapturePromptHook(memClient, state)` factory
    - Returns a `chat.message` handler
    - Extracts text from `output.message` / `output.parts`
    - Strips privacy tags
    - Calls `memClient.initSession()` (fire-and-forget)

  **Must NOT do**:
  - Do NOT modify the user's message (only read it)
  - Do NOT capture system messages or assistant messages

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T8, T9, T11, T12)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 3, 4, 7

  **References**:
  - OpenCode `chat.message` hook: `(input: { sessionID, agent?, model? }, output: { message, parts })` — read output.message for prompt text
  - Claude-mem new-hook: https://docs.claude-mem.ai/architecture/hooks — UserPromptSubmit section, session creation pattern

  **Acceptance Criteria**:
  - [ ] `bun test src/hooks/capture-prompt.test.ts` passes (5+ tests)
  - [ ] Privacy tags stripped
  - [ ] Fully private prompts skipped
  - [ ] Session initialized with correct data

  **QA Scenarios:**

  ```
  Scenario: User prompt captured
    Tool: Bash
    Steps:
      1. Run `bun test src/hooks/capture-prompt.test.ts`
      2. Assert all tests pass
    Expected Result: Prompt sent to worker, privacy tags stripped
    Evidence: .sisyphus/evidence/task-10-prompt-capture.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Files: `src/hooks/capture-prompt.ts, src/hooks/capture-prompt.test.ts`


- [x] 11. Session Idle/Summary Hook (session.idle)

  **What to do**:
  - Write tests first: `src/hooks/summary.test.ts`
    - Test: `session.idle` event triggers `client.sendSummary()`
    - Test: Passes session ID correctly
    - Test: Handles worker unavailable gracefully
  - Implement `src/hooks/summary.ts`:
    - Export `createSummaryHook(memClient, state)` factory
    - Subscribes to `session.idle` via `event` handler
    - Calls `memClient.sendSummary()` (fire-and-forget)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T8, T9, T10, T12)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 3, 7

  **References**:
  - Claude-mem summary-hook: https://docs.claude-mem.ai/architecture/hooks — Stop section
  - OpenCode `session.idle` event: session goes idle after assistant finishes responding

  **Acceptance Criteria**:
  - [ ] `bun test src/hooks/summary.test.ts` passes (3+ tests)

  **QA Scenarios:**

  ```
  Scenario: Summary triggered on idle
    Tool: Bash
    Steps:
      1. Run `bun test src/hooks/summary.test.ts`
      2. Assert all tests pass
    Expected Result: Summary request sent to worker
    Evidence: .sisyphus/evidence/task-11-summary.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Files: `src/hooks/summary.ts, src/hooks/summary.test.ts`

- [x] 12. Compaction Memory Hook (experimental.session.compacting)

  **What to do**:
  - Write tests first: `src/hooks/compaction.test.ts`
    - Test: Hook injects recent memory context into `output.context` array
    - Test: Hook fetches recent observations via `client.getContext()`
    - Test: Hook handles empty/no context gracefully
    - Test: Hook skips when worker unavailable
  - Implement `src/hooks/compaction.ts`:
    - Export `createCompactionHook(memClient, projectName)` factory
    - Returns `experimental.session.compacting` handler
    - Fetches recent context from worker
    - Pushes formatted context into `output.context` array
    - Header: `## Claude-Mem Persistent Memory (survives compaction)`

  **Must NOT do**:
  - Do NOT replace the entire compaction prompt (only append context)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T8-T11)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 3, 7

  **References**:
  - OpenCode `experimental.session.compacting` hook: appends to `output.context[]` or replaces `output.prompt`
  - Claude-mem context format: progressive disclosure table with observation IDs

  **Acceptance Criteria**:
  - [ ] `bun test src/hooks/compaction.test.ts` passes (4+ tests)

  **QA Scenarios:**

  ```
  Scenario: Memory persists across compaction
    Tool: Bash
    Steps:
      1. Run `bun test src/hooks/compaction.test.ts`
      2. Assert all tests pass
    Expected Result: Memory context injected into compaction output
    Evidence: .sisyphus/evidence/task-12-compaction.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Files: `src/hooks/compaction.ts, src/hooks/compaction.test.ts`

- [x] 13. Worker Lifecycle Manager (start/stop)

  **What to do**:
  - Write tests first: `src/worker-manager.test.ts`
    - Test: `startWorker()` starts the worker via `bun` command
    - Test: `startWorker()` is idempotent (does not start if already running)
    - Test: `startWorker()` waits for health check to pass (max 10s)
    - Test: `isWorkerRunning()` returns true when worker responds to health check
    - Test: `getWorkerCommand()` resolves correct command for starting worker
  - Implement `src/worker-manager.ts`:
    - `startWorker(options)` — start claude-mem worker process
      - Try: `bunx claude-mem worker:start` (npm global)
      - Try: `bun run worker:start` in `~/.claude/plugins/marketplaces/thedotmack/` (plugin install)
      - Detached process (doesn't block plugin)
    - `isWorkerRunning()` — thin wrapper over `ClaudeMemClient.healthCheck()`
    - `getWorkerCommand()` — detect installed location

  **Must NOT do**:
  - Do NOT implement worker stop (claude-mem handles its own lifecycle)
  - Do NOT keep a reference to the child process (fire-and-forget)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T8-T12)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 18
  - **Blocked By**: Tasks 3, 6

  **References**:
  - Claude-mem worker management: `npm run worker:start` / `bun` commands
  - Bun shell API: `$\`command\`` syntax for spawning processes

  **Acceptance Criteria**:
  - [ ] `bun test src/worker-manager.test.ts` passes (5+ tests)
  - [ ] Worker starts if not running, skips if already running

  **QA Scenarios:**

  ```
  Scenario: Worker starts when not running
    Tool: Bash
    Preconditions: No worker on port 37777
    Steps:
      1. Run `bun test src/worker-manager.test.ts --test-name-pattern 'start'`
      2. Assert passes
    Expected Result: Worker process spawned, health check passes within 10s
    Evidence: .sisyphus/evidence/task-13-worker-start.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Files: `src/worker-manager.ts, src/worker-manager.test.ts`

- [x] 14. MCP Server Configuration Generator

  **What to do**:
  - Write tests first: `src/mcp-config.test.ts`
    - Test: `generateMcpConfig(port)` returns valid opencode MCP config object
    - Test: Config points to `http://localhost:{port}/mcp` as remote MCP URL
    - Test: Config includes all claude-mem MCP tool names
    - Test: `generateInstallInstructions()` returns markdown with config snippet
  - Implement `src/mcp-config.ts`:
    - `generateMcpConfig(port?: number)` — returns opencode.json-compatible MCP config
    - `generateInstallInstructions()` — returns markdown install guide
    - Config shape matches opencode.json `mcp` key for local MCP server pointing to claude-mem

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T15, T16, T17)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18
  - **Blocked By**: Task 2

  **References**:
  - OpenCode MCP config: https://opencode.ai/docs/mcp-servers/ — local MCP server config format
  - Claude-mem MCP tools: search, timeline, get_observations, save_memory

  **Acceptance Criteria**:
  - [ ] `bun test src/mcp-config.test.ts` passes (4+ tests)
  - [ ] Generated config is valid opencode.json shape

  **QA Scenarios:**

  ```
  Scenario: MCP config generated correctly
    Tool: Bash
    Steps:
      1. Run `bun test src/mcp-config.test.ts`
      2. Assert all tests pass
    Expected Result: Valid opencode MCP configuration generated
    Evidence: .sisyphus/evidence/task-14-mcp-config.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Message: `feat(extras): add MCP config, mem-search skill, and npm packaging`
  - Files: `src/mcp-config.ts, src/mcp-config.test.ts`

- [x] 15. mem-search Skill (SKILL.md)

  **What to do**:
  - Create `skills/mem-search/SKILL.md` in opencode skill format:
    - Frontmatter with `name: mem-search`, `description: Search claude-mem persistent memory...`
    - Body with usage instructions: how to search, available operations, examples
    - Match claude-mem's progressive disclosure workflow (search → timeline → get_observations)
    - Include MCP tool names and example queries

  **Must NOT do**:
  - Do NOT copy claude-mem's SKILL.md verbatim — adapt for opencode's skill format

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T14, T16, T17)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18
  - **Blocked By**: None

  **References**:
  - OpenCode skills format: https://opencode.ai/docs/skills/ — SKILL.md frontmatter and body format
  - Claude-mem mem-search skill: `plugin/skills/mem-search/SKILL.md` in claude-mem repo

  **Acceptance Criteria**:
  - [ ] `skills/mem-search/SKILL.md` exists with valid frontmatter
  - [ ] Name matches directory name (`mem-search`)
  - [ ] Description is 1-1024 characters
  - [ ] Body includes search workflow and examples

  **QA Scenarios:**

  ```
  Scenario: Skill file is valid
    Tool: Bash
    Steps:
      1. Verify file exists: `test -f skills/mem-search/SKILL.md`
      2. Verify frontmatter has `name:` and `description:` keys
      3. Verify name matches directory name
    Expected Result: Valid SKILL.md file
    Evidence: .sisyphus/evidence/task-15-skill-file.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Files: `skills/mem-search/SKILL.md`

- [x] 16. npm Package Configuration + Exports

  **What to do**:
  - Update `package.json` with:
    - `main`: `src/plugin.ts` (Bun runs TS directly)
    - `exports`: `{ ".": "./src/plugin.ts" }`
    - `files`: `["src/", "skills/", "README.md"]`
    - `keywords`: opencode, claude-mem, memory, plugin
    - `peerDependencies`: `{ "@opencode-ai/plugin": "*" }`
    - `scripts`: `{ "test": "bun test", "check": "bunx tsc --noEmit" }`
  - Create `src/index.ts` barrel file re-exporting plugin and types
  - Verify `npm pack` produces a clean tarball

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T14, T15)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 17
  - **Blocked By**: Task 7

  **Acceptance Criteria**:
  - [ ] `npm pack --dry-run` shows expected files
  - [ ] `bun test` still passes after package.json changes

  **QA Scenarios:**

  ```
  Scenario: npm pack produces correct tarball
    Tool: Bash
    Steps:
      1. Run `npm pack --dry-run 2>&1`
      2. Assert output includes src/plugin.ts, skills/mem-search/SKILL.md, README.md
      3. Assert output does NOT include tests/ or node_modules/
    Expected Result: Clean tarball with correct files
    Evidence: .sisyphus/evidence/task-16-npm-pack.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Files: `package.json, src/index.ts`

- [x] 17. README and Installation Guide

  **What to do**:
  - Create `README.md` with:
    - Project description — what it does, why it exists
    - Installation methods:
      1. npm: `opencode.json` → `"plugin": ["opencode-claude-mem"]`
      2. Local: copy to `.opencode/plugins/`
    - MCP search setup: add MCP config to opencode.json
    - Skill setup: copy `skills/mem-search/` to `.opencode/skills/`
    - Prerequisites: claude-mem must be installed (link to claude-mem docs)
    - How it works: architecture diagram (text-based)
    - Configuration: supported options
    - Troubleshooting: common issues
    - Note: not affiliated with OpenCode team

  **Must NOT do**:
  - Do NOT use emojis unless user requests them
  - Do NOT include badges or shields (not published yet)

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T14, T15)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 18
  - **Blocked By**: Task 16

  **Acceptance Criteria**:
  - [ ] README.md exists with installation instructions
  - [ ] All installation methods documented
  - [ ] Prerequisites listed
  - [ ] Not-affiliated disclaimer included

  **QA Scenarios:**

  ```
  Scenario: README has all required sections
    Tool: Bash
    Steps:
      1. Verify README.md exists
      2. Search for 'Installation', 'Prerequisites', 'Configuration', 'not affiliated'
    Expected Result: All sections present
    Evidence: .sisyphus/evidence/task-17-readme.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Files: `README.md`

- [x] 18. End-to-End Integration Test Suite

  **What to do**:
  - Create `tests/e2e/integration.test.ts`:
    - Test: Plugin loads without errors (mock opencode context)
    - Test: Full lifecycle: init → prompt capture → tool observation → idle/summary → cleanup
    - Test: Context injection works with mock worker responses
    - Test: Compaction hook injects memory
    - Test: MCP config generator output is valid JSON matching opencode schema
    - Test: Graceful degradation — full lifecycle with worker unavailable
    - Test: Privacy tags stripped throughout entire lifecycle
  - Uses mock HTTP server (bun's built-in Bun.serve) to simulate claude-mem worker
  - Tests the plugin as a whole unit, not individual hooks

  **Must NOT do**:
  - Do NOT require a real claude-mem worker for tests (use mocks)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on all prior tasks
  - **Parallel Group**: Wave 4 (sequential)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 7-17

  **References**:
  - All prior task source files — this test integrates everything
  - Bun.serve: https://bun.sh/docs/api/http — for mock HTTP server

  **Acceptance Criteria**:
  - [ ] `bun test tests/e2e/` passes (7+ tests)
  - [ ] Full lifecycle tested end-to-end
  - [ ] Graceful degradation tested

  **QA Scenarios:**

  ```
  Scenario: Full lifecycle integration
    Tool: Bash
    Steps:
      1. Run `bun test tests/e2e/integration.test.ts`
      2. Assert all tests pass
      3. Assert test covers init, prompt, tool, idle, cleanup
    Expected Result: Full lifecycle works end-to-end
    Evidence: .sisyphus/evidence/task-18-e2e.txt

  Scenario: Graceful degradation
    Tool: Bash
    Steps:
      1. Run `bun test tests/e2e/integration.test.ts --test-name-pattern 'degradation'`
      2. Assert passes (no crashes)
    Expected Result: Plugin works without worker (limited functionality)
    Evidence: .sisyphus/evidence/task-18-degradation.txt
  ```

  **Commit**: YES
  - Message: `test(e2e): add end-to-end integration tests`
  - Files: `tests/e2e/integration.test.ts`
  - Pre-commit: `bun test`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `bun check` (tsc --noEmit) + `bun test`. Review all source files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify all exports match package.json exports field.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Start claude-mem worker. Load plugin in opencode (local plugin mode). Run through full lifecycle: submit prompt, use tools, observe context injection, search memory via MCP, check web viewer. Capture screenshots/outputs. Test graceful degradation (stop worker, verify no crash).
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual files. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Flag unaccounted files or dependencies.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Wave | Commit Message | Files | Pre-commit |
|------|---------------|-------|-----------|
| 1 | `feat(core): scaffold project with types, HTTP client, and utilities` | package.json, tsconfig.json, src/types.ts, src/client.ts, src/utils/*.ts, src/**/*.test.ts | `bun test` |
| 2 | `feat(plugin): implement core opencode plugin with all lifecycle hooks` | src/plugin.ts, src/hooks/*.ts, src/hooks/*.test.ts | `bun test` |
| 3 | `feat(extras): add MCP config, mem-search skill, and npm packaging` | src/mcp-config.ts, skills/mem-search/SKILL.md, package.json, README.md | `bun test` |
| 4 | `test(e2e): add end-to-end integration tests` | tests/e2e/*.test.ts | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
bun test                        # Expected: all tests pass
bun check                       # Expected: no TypeScript errors
npm pack --dry-run               # Expected: correct files listed (no build step needed — Bun runs TS directly)
curl http://localhost:37777/health  # Expected: {"status":"ok"} (when worker running)
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (bun test)
- [ ] TypeScript compiles without errors (bun check)
- [ ] Plugin loads in opencode without errors
- [ ] Context injection works cross-tool (claude-code → opencode)
- [ ] MCP search returns results
- [ ] Graceful degradation when worker unavailable
- [ ] npm package publishable (`npm pack` succeeds)
