<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-01 | Updated: 2026-03-01 -->

# utils

## Purpose
Shared utility functions used across the plugin for detection, JSON parsing, tool filtering, and privacy tag stripping. All functions are pure (no side effects except `detect.ts` which reads the filesystem) and have try-catch with sensible defaults — they never throw.

## Key Files
| File | Description |
|------|-------------|
| `detect.ts` | Detects claude-mem installation and reads `~/.claude-mem/settings.json`. Exports: `detectClaudeMem()` (checks if installed and worker is running), `getWorkerPort()` (default 37777, reads settings), `getWorkerHost()` (default localhost, respects `CLAUDE_MEM_WORKER_HOST` env var), `getMcpServerPath()` (3-strategy discovery: plugin cache → npm global → bun which), `getDataDir()` (respects `CLAUDE_MEM_DATA_DIR` env var). |
| `safe-parse.ts` | Safe JSON parsing with fallback. Returns the parsed object on success, or `{ raw: string }` if the input is invalid JSON. Never throws. |
| `tool-filter.ts` | Defines the `SKIP_TOOLS` set of tool names to exclude from observation capture (todowrite, askuserquestion, listmcpresourcestool, slashcommand, skill, listmcptools, getmcpresource). Exports `shouldSkipTool(toolName)` (case-insensitive check). |
| `strip-tags.ts` | Strips `<private>...</private>` and `<claude-mem-context>...</claude-mem-context>` tags from text and JSON string values. Includes ReDoS protection via `MAX_REPLACEMENTS = 100` iteration limit. Exports: `stripMemoryTagsFromText()`, `stripMemoryTagsFromJson()`. |

## For AI Agents

### Working In This Directory
- Pure utility functions — no side effects except `detect.ts` (reads `~/.claude-mem/settings.json`).
- All functions have try-catch with sensible defaults and never throw.
- No external dependencies — self-contained utilities only.

### Testing Requirements
- Each utility has a co-located `*.test.ts` file using Bun's native test runner.
- `strip-tags.ts` tests include ReDoS attack vectors (deeply nested tags, large inputs).
- `detect.ts` tests mock filesystem access via environment variable overrides (`CLAUDE_MEM_DATA_DIR`, `CLAUDE_MEM_WORKER_HOST`).

### Common Patterns
- **Environment variable overrides**: `detect.ts` respects `CLAUDE_MEM_DATA_DIR` and `CLAUDE_MEM_WORKER_HOST` for testing and custom deployments.
- **Safe defaults**: All `detect.ts` functions return sensible defaults (port 37777, localhost) when settings file is missing or malformed.
- **ReDoS protection**: `strip-tags.ts` uses an iteration limit (`MAX_REPLACEMENTS = 100`) to prevent regex denial-of-service on malicious input.

## Dependencies

### Internal
- None (self-contained utilities)

### External
- None

<!-- MANUAL: -->
