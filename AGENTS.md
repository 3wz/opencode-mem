<!-- Generated: 2026-03-01 | Updated: 2026-03-01 -->

# opencode-claude-mem

## Purpose
opencode-mem is a TypeScript/Bun plugin for OpenCode that bridges persistent memory between OpenCode and Claude Code via a shared claude-mem worker running on port 37777. It captures tool executions, prompts, and responses as observations using the ClaudeMemClient HTTP client, injects relevant context into every session via semantic search, and shares the same SQLite database as Claude Code. The plugin implements a fire-and-forget pattern for all memory writes (initSession, sendObservation, sendSummary, completeSession) and degrades gracefully when the claude-mem worker is unavailable, ensuring OpenCode sessions always start even without a running memory backend.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Project manifest. Type: "module" (ESM). Peer dep: `@opencode-ai/plugin`. Dev deps: `typescript`, `@types/bun`. Scripts: `build` (tsc), `test` (bun test), `check` (tsc --noEmit). |
| `tsconfig.json` | TypeScript config for development. Strict mode, ES2022 target, bundler module resolution. |
| `tsconfig.build.json` | Build config targeting Node16 module resolution with declaration maps and source maps. Excludes test files. Output: `dist/`. |
| `bunfig.toml` | Bun test runner configuration for the project. |
| `README.md` | User-facing documentation: quick start, architecture diagram, MCP search tools, troubleshooting. |
| `HOOKS.md` | Hook decision matrix: 7 USE, 8 SKIP, 2 FUTURE decisions with rationale for all 17 OpenCode plugin hooks. |
| `bun.lock` | Bun lockfile for reproducible installs. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | Application source code: plugin entry, ClaudeMemClient HTTP client, event hooks, setup pipeline, utilities. See `src/AGENTS.md`. |
| `tests/` | Integration and E2E tests separate from co-located unit tests in `src/`. Contains `setup.test.ts` and `e2e/integration.test.ts`. |
| `skills/` | Bundled mem-search skill (`skills/mem-search/SKILL.md`) copied to `~/.config/opencode/skills/` during auto-setup. |
| `dist/` | Build output from `tsc`. Mirrors `src/` structure. **Never edit files here** — always edit `src/` and rebuild. |

## For AI Agents

### Working In This Directory
- Run `bun test` after any changes to verify all 213 tests pass
- Run `bunx tsc --noEmit` for type checking before committing
- Build with `npm run build` (outputs to `dist/`)
- Never use `console.log` — use `client.app.log()` for all logging
- Use native `fetch()` only — no axios, got, or other HTTP libraries
- Must not add runtime dependencies — only `peerDependencies` and `devDependencies` are allowed

### Testing Requirements
- **Unit tests**: Co-located with source files in `src/` as `*.test.ts` files (23 test files)
- **Integration tests**: `tests/setup.test.ts` — setup pipeline integration
- **E2E tests**: `tests/e2e/integration.test.ts` — full session lifecycle (366 lines)
- Test runner: Bun native (`bun test`). Pattern: `describe()` + `it()` with `mock()` from `bun:test`
- Mock pattern: `Bun.serve()` for HTTP mocking, dependency injection for plugin factory

### Common Patterns
- **Fire-and-forget**: All memory write operations (`initSession`, `sendObservation`, `sendSummary`, `completeSession`) are non-blocking void calls — never await them in hook handlers
- **Graceful degradation**: Plugin loads and works even if the claude-mem worker on port 37777 is unavailable; all ClaudeMemClient calls catch and swallow errors silently
- **Idempotent setup**: All 5 setup steps (skill copy, config write, etc.) are safe to run multiple times without side effects
- **Dependency injection**: Plugin factory accepts mock dependencies (`clientFactory`, `detectFn`, `autoSetupFn`) for testability without a live claude-mem worker

## Dependencies

### External
- `@opencode-ai/plugin` (peer) — OpenCode Plugin API: `Plugin` type, hook event types, `app.log()`
- `typescript` (dev) — TypeScript compiler for building `dist/` from `src/`
- `@types/bun` (dev) — Bun runtime type definitions for `Bun.serve()`, `bun:test`, and Bun globals

<!-- MANUAL: -->
