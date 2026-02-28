# Decisions — opencode-mem

## Architecture Decisions

### Worker Strategy: Shared (port 37777)
- Reuse existing claude-mem worker if running
- Start if not running (bunx claude-mem worker:start)
- Graceful degradation if unavailable

### Distribution: Both npm + local
- npm: `opencode-claude-mem`
- Local: `.opencode/plugins/` compatible

### No build step
- Bun runs TypeScript directly
- `main: "src/plugin.ts"`, `exports: { ".": "./src/plugin.ts" }`

### Session ID mapping
- Use opencode's session ID as `claude_session_id` in worker calls

### TDD approach
- RED (failing test) → GREEN (minimal impl) → REFACTOR
- Every task writes tests first

- 2026-02-27: Kept summary handling inside event hook instead of adding a session.idle key, aligning with OpenCode hook model and existing summary factory filter.
- 2026-02-27: Retained buildHooks typing via Plugin return-derived type with hook-specific casts to satisfy @opencode-ai/plugin hook signatures without modifying existing hook factories.
