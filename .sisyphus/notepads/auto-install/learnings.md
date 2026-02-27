# Learnings — auto-install

## Inherited from opencode-mem Phase 1

### Critical Rules
- NEVER use `console.log` — use `client.app.log()`
- NEVER use `mock.module()` in tests — causes cross-file pollution. Use dependency injection instead.
- ALWAYS use `.js` extension when importing `.ts` files in bun tests (e.g., `from "./types.js"`)
- `moduleResolution: "bundler"` in tsconfig (Bun requirement)
- bun version: 1.3.9, typescript: 5.9.3, @opencode-ai/plugin: 1.2.15

### Critical Discovery from Metis
- `directory` from PluginInput = PROJECT directory, NOT the plugin's own directory
- Use `import.meta.dir` to find plugin's own directory (where `skills/` lives)
- From any file in `src/setup/`, `join(import.meta.dir, "..", "..")` gives plugin root

### TDD Pattern
- RED (write failing test) → GREEN (minimal impl) → REFACTOR
- Framework: bun:test (`describe`, `it`, `expect`)
- Evidence saved to `.sisyphus/evidence/task-{N}-{slug}.txt`

### DI Pattern (from plugin.ts:78-148)
- `createPluginWithDependencies(clientFactory, detectFn, getPortFn)` — inject all external deps
- Tests create mock implementations instead of mocking modules
- All external calls go through injected deps

### MCP Config Fix
- Current `generateMcpConfig()` does NOT include `enabled: true`
- User's opencode.json has `"enabled": true` — must match this format
- T6 fixes this in Wave 2

## [T1 Complete] Setup Types
- Created `src/setup/types.ts` with SetupDeps interface following DI pattern from plugin.ts
- SetupDeps abstracts filesystem (fileExists, readJson, writeFile, copyDir, mkdirp), process execution (exec, which), logging, and worker port detection
- Used Bun APIs: `Bun.which()`, `Bun.file().exists()`, `Bun.file().json()`, `Bun.write()`, `Bun.spawn()`
- Used Node.js APIs: `cp()` and `mkdir()` from `node:fs/promises` for directory operations
- `pluginDir` computed as `join(import.meta.dir, "..", "..")` which resolves to plugin root from src/setup/
- `getWorkerPort` imported from `../utils/detect.js` and exposed via SetupDeps
- Created SetupStepResult and SetupResult types for setup operation results
- TDD approach: wrote 13 tests first, then implemented to pass all tests
- All tests pass (13/13), TypeScript clean (0 errors)
- Created barrel export in `src/setup/index.ts` for clean imports
- Created `src/setup/steps/` directory for Task 2 concurrent work

## [T2 Complete] Detect Binary Step
- Created `src/setup/steps/detect-binary.ts` with two-stage detection: PATH via `which()` then `~/.claude-mem` directory check
- TDD approach: wrote 5 tests first covering success (binary in PATH), success (data dir exists), failure (neither), error handling
- All tests pass (5/5), TypeScript clean (0 errors)
- Key pattern: try-catch wrapping async operations, always return SetupStepResult (never throw)
- Mock deps pattern: inject all dependencies for testability, no real filesystem access in tests
- Used `.js` extension for imports per Bun bundler requirement

## [T3 Complete] Install Claude-Mem Step

### Implementation Details
- Created `src/setup/steps/install-claude-mem.ts` following the check→act→verify pattern from worker-manager.ts
- Idempotent design: checks if binary exists via `deps.which()` before attempting install
- Uses `deps.exec()` to call `npm install -g claude-mem`
- Proper error handling with try-catch wrapping entire function body
- Returns appropriate status: "skipped" if already installed, "success" on successful install, "failed" on error

### Test Coverage (6 tests)
1. Already installed (which returns path) → returns `{ status: "skipped" }`, exec NOT called
2. Not installed, exec exits 0 → returns `{ status: "success" }`, exec called with ["npm", "install", "-g", "claude-mem"]
3. Not installed, exec exits 1 → returns `{ status: "failed" }` with exit code in message
4. exec throws Error → returns `{ status: "failed" }` with error message, no crash
5. Returns failed when npm install exits with non-zero code
6. Logs "Installing claude-mem..." before exec is called

### Key Patterns Followed
- Mock pattern from detect-binary.test.ts with full SetupDeps interface
- No real npm calls in tests (all mocked)
- No mock.module() usage
- Proper TypeScript with .js extensions in imports
- All 6 tests passing, 0 TypeScript errors

### Evidence
- Test output: `.sisyphus/evidence/task-3-install.txt` (6 pass, 0 fail)
- TypeScript: `bunx tsc --noEmit` → 0 errors

## [T5 Complete] Copy Skills Step

- ✅ Created `src/setup/steps/copy-skills.ts` with idempotent copy logic
- ✅ Skips if destination exists (protects user customizations)
- ✅ Validates source exists before copying
- ✅ Creates parent directory before copy operation
- ✅ Proper error handling with try-catch
- ✅ Created `src/setup/steps/copy-skills.test.ts` with 6 comprehensive tests:
  1. Destination exists → skipped, no copy
  2. Source missing → failed with clear message
  3. Happy path → mkdirp called before copyDir
  4. Copy succeeds → returns success with destination path
  5. Copy throws → graceful error handling
  6. Custom pluginDir → verified in path checks
- ✅ All 6 tests passing (18 expect() calls)
- ✅ Evidence saved to `.sisyphus/evidence/task-5-copy-skills.txt`
- ✅ TypeScript: Files compile without errors (pre-existing tsconfig issue in types.ts unrelated)
- Pattern: Follows detect-binary.ts structure (try-catch, SetupDeps injection, SetupStepResult)
- Mock strategy: Call tracking with fileExists path discrimination for dest vs source

## [T6 Complete] Fix MCP Config

- Added `enabled?: boolean` to `McpConfig` interface in `src/mcp-config.ts`
- Updated `generateMcpConfig()` to return `enabled: true` in the MCP config object
- Updated tests in `src/mcp-config.test.ts` to verify `enabled: true` is present
- All 137 tests pass (9 mcp-config tests + 128 others)
- TypeScript compilation: 0 errors
- Evidence saved to `.sisyphus/evidence/task-6-mcp-config.txt`

## [T4 Complete] Configure MCP Step
- Created `src/setup/steps/configure-mcp.ts` — reads opencode.json, adds claude-mem MCP entry if missing
- Idempotent: skips if `mcp["claude-mem"]` already exists, never overwrites
- Preserves ALL existing keys ($schema, plugin, existing mcp entries) via spread operator
- Port sourced from `deps.getWorkerPort()` — never hardcoded
- MCP entry includes `enabled: true` as required by opencode.json format
- Defensive JSON: inner try-catch on readJson, returns failed on parse error
- 7 tests all passing (22 expect() calls):
  1. Already configured → skipped, writeFile NOT called
  2. Missing → adds with correct port 37777
  3. Custom port 38888 → URL uses 38888
  4. opencode.json missing → failed, writeFile NOT called
  5. Invalid JSON → failed, no crash
  6. Preserves $schema and existing keys
  7. Preserves existing MCP entries alongside new claude-mem
- Evidence: `.sisyphus/evidence/task-4-configure-mcp.txt`
- TypeScript: 0 errors

## [T7 Complete] Auto-Setup Orchestrator
- Created `src/setup/auto-setup.ts` — orchestrates detectBinary → installClaudeMem → configureMcp → copySkills → startWorker
- Created `src/setup/auto-setup.test.ts` — 9 tests, all passing
- Added `startWorker?: (port: number) => Promise<boolean>` to `SetupDeps` interface for testability
- Updated `createDefaultDeps` with dynamic import of worker-manager
- Pattern: `AutoSetupSteps` interface allows injecting all step functions in tests (no mock.module needed)
- Pattern: `runStep()` helper wraps each step in try-catch, never throws, returns `{ status: "failed", message }` on error
- Key: detectBinary success → skip installClaudeMem (returns `{ status: "skipped" }`)
- Key: Outer try-catch is catastrophic fallback — returns all-failed SetupResult if inner logic somehow throws
- `toContain` is case-sensitive — `"Worker"` ≠ `"worker"` (caught in first test run)
- Full suite: 46 tests across 6 setup files, all green
- `bunx tsc --noEmit` → 0 errors

## [T8 Complete] Plugin Integration

### Changes Made
1. **src/plugin.ts**: Added imports for `autoSetup` and `createDefaultDeps`
2. **src/plugin.ts**: Added fire-and-forget autoSetup call in main OpenCodeMem plugin when worker not running
3. **src/plugin.ts**: Added `autoSetupFn` optional parameter to `createPluginWithDependencies` for testability
4. **src/plugin.ts**: Added same autoSetup logic to `createPluginWithDependencies` function
5. **src/index.ts**: Re-exported `autoSetup` and setup types
6. **src/plugin.test.ts**: Added 2 new tests:
   - Test that autoSetup is called when worker not running
   - Test that autoSetup is NOT called when worker is running

### Test Results
- Plugin tests: 11 pass, 0 fail
- Full suite: 148 pass, 0 fail
- TypeScript: 0 errors

### Key Implementation Details
- Used `void autoSetup(...)` for fire-and-forget pattern
- Used `.then()` to handle success and update state if worker started
- Dependency injection via `autoSetupFn` parameter for testability
- Used `createDefaultDeps(log)` to create setup dependencies
- Checked `result.worker.status === "success"` to verify worker started

## [T9 Complete] README Update

- Added "Automatic Setup" section after "Installation" documenting the 5-step setup sequence
- Added "What Gets Configured" subsection with table of files modified
- Updated Prerequisites: removed hard claude-mem requirement, noted npm is needed
- Updated Troubleshooting: added auto-setup failure tips (npm missing, permission issues, MCP/skills config failures)
- Updated MCP Search Setup and Skill Setup sections to note auto-configuration
- No emojis, no excessive docs, structure preserved
- Evidence: .sisyphus/evidence/task-9-readme.txt
