<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-01 | Updated: 2026-03-01 -->

# hooks

## Purpose
7 event hook handlers that bridge OpenCode lifecycle events to the claude-mem worker API. Each hook is a standalone module registered in `plugin.ts` via `buildHooks()`. Hooks capture user prompts, tool executions, and assistant responses as observations; inject persistent memory context into the system prompt; and manage session lifecycle (init, summarize, complete).

## Key Files
| File | Description |
|------|-------------|
| `capture-prompt.ts` | Captures user messages on `chat.message`. Initializes the session on the first prompt via `initSession()`. Updates `state.lastUserMessage` and increments `state.promptNumber`. |
| `save-observation.ts` | Records tool executions on `tool.execute.after` via `sendObservation()`. Filters tools in the SKIP_TOOLS set. Truncates output >100KB. Strips memory tags from input and output. |
| `context-inject.ts` | Injects persistent memory context on `experimental.chat.system.transform` via `getContext()`. Also prepends a worker status block (connection status, version, available commands). **DO NOT TOUCH without explicit permission.** |
| `compaction.ts` | Re-injects memory context on `experimental.session.compacting` to survive context window compaction. **DO NOT TOUCH without explicit permission.** |
| `summary.ts` | Generates a session summary on `session.idle` via `sendSummary()`. Sets `state.summarySent = true` to prevent duplicate summaries per session. |
| `command-execute.ts` | Captures slash command executions on `command.execute.before` as observations with `tool_name: "command:{commandName}"`. |
| `text-complete.ts` | Captures assistant responses on `experimental.text.complete` as observations with `tool_name: "assistant_response"`. Updates `state.lastAssistantMessage`. |

## For AI Agents

### Working In This Directory
- Each hook is a standalone module registered in `plugin.ts` via `buildHooks()`.
- **DO NOT touch `context-inject.ts` or `compaction.ts` without explicit permission** — these are the memory injection hooks and are sensitive to changes.
- See `HOOKS.md` in the project root for the complete hook decision matrix (7 USE, 8 SKIP, 2 FUTURE) with rationale for all 17 OpenCode plugin hooks.

### Testing Requirements
- Each hook has a co-located `*.test.ts` file using Bun's native test runner.
- Tests use a mock `ClaudeMemClient` with call tracking.
- Fire-and-forget operations use `waitForFireAndForget(ms = 50)` helper to allow async writes to complete before assertions.

### Common Patterns
- **Fire-and-forget**: All write hooks (`capture-prompt`, `save-observation`, `summary`, `command-execute`, `text-complete`) call worker methods with `void` prefix — never awaited.
- **Memory tag stripping**: All input/output text is sanitized via `stripMemoryTagsFromText()` and `stripMemoryTagsFromJson()` before sending to the worker.
- **Shared state via closure**: All hooks access `PluginState` via closure from `buildHooks()` — no global state.
- **Skip list**: `save-observation.ts` uses `shouldSkipTool()` from `utils/tool-filter.ts` to exclude meta-tools (todowrite, slashcommand, skill, etc.).

## Dependencies

### Internal
- `../client.ts` — `ClaudeMemClient` for all worker API calls
- `../types.ts` — `PluginState` and all payload types
- `../utils/strip-tags.ts` — `stripMemoryTagsFromText()`, `stripMemoryTagsFromJson()`
- `../utils/tool-filter.ts` — `shouldSkipTool()`

### External
- `@opencode-ai/plugin` (peer) — Hook event types from OpenCode Plugin API

<!-- MANUAL: -->
