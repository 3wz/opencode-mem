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
