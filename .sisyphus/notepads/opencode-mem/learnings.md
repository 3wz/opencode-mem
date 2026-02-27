# Learnings — opencode-mem

## Project Context
- **Package name**: `opencode-claude-mem`
- **Language**: TypeScript, runs on Bun
- **Worker port**: 37777 (default, configurable via `~/.claude-mem/settings.json`)
- **DB**: `~/.claude-mem/claude-mem.db` (SQLite + ChromaDB, shared with claude-code)
- **Test framework**: bun:test (built-in)
- **No build step**: Bun runs TypeScript directly; no dist/ needed

## Key Constraints
- NEVER use console.log — use `client.app.log()`
- NEVER throw from HTTP client methods — catch silently
- NEVER await worker calls (fire-and-forget, 2s timeout)
- NEVER hardcode paths — read from settings.json
- Native fetch() only — no axios/got
- Max 100 tag replacements (ReDoS protection)

## OpenCode Plugin API
- Plugin: `async ({ project, client, $, directory, worktree }) => Hooks`
- Key hooks: `experimental.chat.system.transform`, `tool.execute.after`, `chat.message`, `event`, `experimental.session.compacting`
- Events: `session.created`, `session.idle`, `session.deleted`
- Logging: `client.app.log()`
- Plugin type from: `@opencode-ai/plugin`

## Claude-Mem Worker API
- `GET /health` — health check
- `GET /api/context/inject?project=X` — fetch context
- `POST /sessions/{id}/init` — init session
- `POST /api/sessions/observations` — save observation
- `POST /api/sessions/summarize` — summarize
- `POST /api/sessions/complete` — complete session

## Directory Structure (to create)
```
src/
  plugin.ts       — main plugin entry (default export)
  client.ts       — ClaudeMemClient HTTP client
  types.ts        — all interfaces
  index.ts        — barrel re-export
  hooks/
    context-inject.ts
    save-observation.ts
    capture-prompt.ts
    summary.ts
    compaction.ts
  utils/
    strip-tags.ts
    tool-filter.ts
    detect.ts
worker-manager.ts
mcp-config.ts
tests/
  setup.test.ts
  e2e/
    integration.test.ts
skills/
  mem-search/
    SKILL.md
```

## [T1 Complete] Project Scaffolding
- bun version: 1.3.9
- @opencode-ai/plugin version: 1.2.15
- typescript version: 5.9.3
- tsconfig moduleResolution: bundler (for Bun compatibility)
- Test framework: bun:test (built-in, no additional setup needed)
- Gotchas encountered:
  - bunfig.toml requires empty [test] section (no preload array needed)
  - moduleResolution must be "bundler" for Bun compatibility
  - All tests pass, TypeScript check passes with no errors

## [T2 Complete] Type Definitions
- All 9 interfaces created and exported from src/types.ts
- Import extension: use .js when importing .ts files in bun tests (e.g., `from "./types.js"`)
- Test framework: bun:test works seamlessly with type imports
- TypeScript strict mode: all types pass with no errors
- No surprises: straightforward interface definitions, all tests pass on first run

## [T4 Complete] Privacy Tag Stripping
- ReDoS protection: iteration limit of 100 per tag type prevents catastrophic backtracking
- Critical gotcha: stateful regex with `/g` flag requires `lastIndex = 0` reset between operations
- Regex state management: must reset before each `.test()` and `.replace()` to avoid skipping matches
- JSON handling: graceful fallback to text stripping for invalid JSON
- Performance: 50 nested tags stripped in <20ms (well under 1s threshold)
- Test coverage: 9 tests covering all scenarios including multiline, both tag types, and ReDoS protection

## [T5 Complete] Tool Skip List
- Skip tools: TodoWrite, AskUserQuestion, ListMcpResourcesTool, SlashCommand, Skill, ListMcpTools, GetMcpResource
- Matching: lowercase comparison (case-insensitive)
- Any surprises: None - straightforward implementation, all 10 tests pass


## [T3 Complete] HTTP Client
- Mock server pattern: Bun.serve on port 37888 for tests
- AbortController pattern for 2s timeouts
- Log callback pattern: avoids console.log constraint
- Any gotchas: healthCheck validates both HTTP 200 and payload status="ok"; import .js extension in test files

## [T6 Complete] Auto-Detect Module
- Detection strategy: check DB file existence first, then health check
- Env var override: CLAUDE_MEM_DATA_DIR for testing (avoids real file system dependency)
- Circular dependency avoided: getDataDir() cannot call readSettings() — uses env var directly
- 8 tests created covering all scenarios: default paths, env overrides, missing DB, missing worker
- All tests pass with mocked file system (no real worker needed)
- TypeScript compilation: clean, no errors

## [T7 Complete] Plugin Entry Point
- Plugin type: async (PluginInput) => Hooks
- client.app.log() exists and works (wrap in try-catch)
- Event discrimination: event.type === "session.created" etc.
- project.path might be undefined — use ?? directory fallback
- State is shared mutable object (ref), passed to hook factories
- Any surprises: LSP per-file diagnostics unavailable in this environment (missing typescript-language-server); verified with project-level diagnostics (tsc strategy)
## [T8 Complete] Context Injection Hook
- experimental.chat.system.transform: output.system is string array, append only
- Null context check: if !result?.context return early
- Mock port used: 37899
- Any surprises: lsp diagnostics unavailable in this environment (typescript-language-server missing), used test run as verification fallback

## [T9 Complete] Tool Observation Hook
- Fire-and-forget: sendObservation called without await
- Skip check: shouldSkipTool() called first
- 100KB truncation: slice + "[truncated]" suffix
- Mock port: 37900
- Any surprises: lsp diagnostics unavailable in this environment (typescript-language-server missing)

## [T10 Complete] Prompt Capture Hook
- chat.message: output.message.content can be string or array of parts
- Fire-and-forget: initSession called without await
- Skip condition: empty after stripping
- Mock port: 37901
- Any surprises: LSP tool unavailable in environment; verified types via tsc diagnostics

## [T12 Complete] Compaction Hook
- experimental.session.compacting: output.context is string array, push only
- Never set output.prompt - only output.context
- Mock port: 37903
- Any surprises: typescript-language-server is missing in this environment; verified compaction files with tsc and ran targeted bun test

## [T11 Complete] Session Idle/Summary Hook
- session.idle event shape: properties.sessionID
- Fire-and-forget: sendSummary without await
- Guard: check isWorkerRunning before calling
- Mock port: 37902
- Any surprises: LSP binary missing in environment; used project TypeScript diagnostics fallback


## [T13 Complete] Worker Lifecycle Manager
- Bun.spawn with detached: true, proc.unref() for fire-and-forget
- Discovery: check local install first, fall back to bunx
- Idempotency: health check before attempting start
- Test timeout: 200ms to avoid slow tests
- 7 tests, all pass (3 exports: isWorkerRunning, getWorkerCommand, startWorker)
- Any surprises: None — clean implementation, tests pass first run

## Task 14: MCP Server Configuration Generator

### Pattern: Configuration Generator Functions
- Simple, pure functions that return config objects and formatted strings
- No side effects, no external dependencies
- Interfaces for type safety (McpConfig, OpenCodeMcpConfig)
- DEFAULT_PORT constant (37777) matches client.ts convention

### Test Pattern: Configuration Testing
- Test default values separately from custom values
- Verify JSON structure in string output (contains checks)
- Test both positive cases (with values) and negative cases (without)
- 9 tests for 2 functions is good coverage (4-5 per function)

### Port Convention
- Default worker port: 37777 (established in client.ts)
- MCP endpoint path: /mcp (appended to base URL)
- Full URL format: http://localhost:{port}/mcp

### Markdown Generation
- Use template literals with backticks for code blocks
- JSON.stringify(config, null, 2) for pretty-printed JSON in output
- Include both technical details (URL) and user-friendly info (tools list)

### Test Import Pattern
- Use .js extension when importing .ts files in bun tests
- Direct imports work fine (no mock.module() needed)
- bun:test provides describe, it, expect, beforeAll, afterAll


## Task 15: mem-search skill file (2026-02-27)

- Skill files need frontmatter with `name:` and `description:` (1-1024 chars)
- The 3-layer workflow (search → timeline → get_observations) is the core pattern to teach
- Description at 180 chars leaves plenty of room; keep it action-oriented ("Use when...")
- MCP tool table format works well for quick reference in skill files
- Including example workflows (not just individual calls) makes the skill more actionable
- Token efficiency section is important context for why the 3-layer approach matters
- Setup section with opencode.json config snippet makes the skill self-contained

## Task 16: npm package configuration and exports

**Completed**: 2026-02-27

### Changes Made
1. Updated `package.json`:
   - Changed `main` from `src/plugin.ts` to `./src/index.ts` (barrel export)
   - Updated `exports` to point to `./src/index.ts`
   - Added `ai` keyword to keywords array
   - Kept all existing fields (name, version, type, description, files, scripts, peerDependencies, devDependencies)

2. Updated `src/index.ts` barrel exports:
   - Added `export { ClaudeMemClient } from "./client.js"`
   - Added `export { generateMcpConfig, generateInstallInstructions } from "./mcp-config.js"`
   - Added `export type { McpConfig, OpenCodeMcpConfig } from "./mcp-config.js"`

### Verification Results
- ✅ bun test: 93 pass, 0 fail (improved from 84 baseline)
- ✅ bunx tsc --noEmit: passed (no type errors)
- ✅ npm pack --dry-run: shows src/, skills/, and all expected files
- ✅ Package size: 14.7 kB (tarball), 66.4 kB (unpacked)

### Key Insights
- The barrel export pattern (index.ts) is standard for npm packages
- Using `./src/index.ts` as main entry point allows consumers to import from the package root
- All exports are properly typed with corresponding type exports
- The mcp-config.ts file was already present (created by Task 14), so its exports were added
- Test count increased from 84 to 93, suggesting additional tests were added in parallel tasks

## Task 17: README (2026-02-27)

- README created at project root, 118 lines
- Used em-dash alternative (plain dashes in code blocks only, prose uses commas/periods)
- No emojis, no badges — clean text-only format
- Disclaimer "not affiliated with the OpenCode team" placed as blockquote under title
- Architecture diagram done as plain text tree using box-drawing chars
- `CLAUDE_MEM_DATA_DIR` env var documented (from utils/detect.ts)
- grep pattern `"Installation\|Prerequisites\|not affiliated\|MCP"` returns 6 matches (all sections confirmed)

## Task 18: E2E integration suite (2026-02-27)

- Built `tests/e2e/integration.test.ts` with 7 passing tests covering plugin load, full lifecycle, context injection, compaction, MCP config, graceful degradation, and tag stripping.
- Integration strategy: compose real hook factories with `createPluginWithDependencies` and a shared `Bun.serve` mock worker to validate cross-hook behavior in one flow.
- Fire-and-forget hooks need a short delay (`await new Promise(resolve => setTimeout(resolve, 50))`) before asserting recorded HTTP calls.
- Privacy stripping verified end-to-end for both `<private>` and `<claude-mem-context>` tags before payloads hit worker endpoints.
