# OpenCode Plugin Hooks — Decision Matrix

This document records the audit of all 17 OpenCode plugin hooks and the decision made for each: whether the plugin uses it (USE), skips it (SKIP), or defers it for a potential future use case (FUTURE). It serves as a reference for contributors and maintainers to understand which hooks are wired, why others are omitted, and where future expansion is possible.

---

## Decision Matrix

| # | Hook Key | Decision | Implementation | Rationale |
|---|----------|----------|----------------|-----------|
| 1 | `event` | USE | Expanded — session.idle dispatches summary | Already wired for session.created/deleted; expanded for summary dispatch |
| 2 | `config` | SKIP | — | No memory-related configuration needed |
| 3 | `tool` | SKIP | — | Plugin doesn't define custom tools |
| 4 | `auth` | SKIP | — | No auth needed for memory operations |
| 5 | `chat.message` | USE | [`src/hooks/capture-prompt.ts`](src/hooks/capture-prompt.ts) | Captures user prompts for session tracking |
| 6 | `chat.params` | SKIP | — | Model parameters not useful for memory |
| 7 | `chat.headers` | SKIP | — | HTTP headers not memory-relevant |
| 8 | `permission.ask` | SKIP | — | Permission events not memory-relevant |
| 9 | `command.execute.before` | USE | [`src/hooks/command-execute.ts`](src/hooks/command-execute.ts) | Captures slash commands as high-signal observations |
| 10 | `tool.execute.before` | FUTURE | — | Low value — tool output (after) matters more than intent (before) |
| 11 | `shell.env` | SKIP | — | Shell environment not memory-relevant |
| 12 | `tool.execute.after` | USE | [`src/hooks/save-observation.ts`](src/hooks/save-observation.ts) | Captures tool results as observations |
| 13 | `experimental.chat.messages.transform` | FUTURE | — | Purpose unclear vs system.transform; defer until use case emerges |
| 14 | `experimental.chat.system.transform` | USE | [`src/hooks/context-inject.ts`](src/hooks/context-inject.ts) | Injects persistent memory context into system prompt |
| 15 | `experimental.session.compacting` | USE | [`src/hooks/compaction.ts`](src/hooks/compaction.ts) | Preserves memory through compaction |
| 16 | `experimental.text.complete` | USE | [`src/hooks/text-complete.ts`](src/hooks/text-complete.ts) | Captures assistant output for richer session context |
| 17 | `tool.definition` | SKIP | — | Tool definition metadata not memory-relevant |

**Summary: 7 USE · 8 SKIP · 2 FUTURE**

---

## FUTURE Hook Notes

**`tool.execute.before` (#10)**
Fires before a tool runs, capturing intent rather than result. The result (captured by `tool.execute.after`) is more useful for memory — the before-hook would add noise without signal. Revisit if pre-execution context proves valuable for specific tool types.

**`experimental.chat.messages.transform` (#13)**
Transforms the full chat message array before it is sent to the model. Its purpose overlaps with `experimental.chat.system.transform` (which handles system prompt injection). Deferred until a concrete use case emerges that cannot be served by the system transform hook.

---

## Hook Flow

```
opencode session
    |
    |-- plugin loads
    |   |-- detect claude-mem
    |   |-- auto-setup if needed (fire-and-forget)
    |   '-- connect to worker on port 37777
    |
    |-- event (session.created) ......... initSession
    |-- chat.message .................... capturePrompt       [USE #5]
    |-- command.execute.before .......... commandExecute      [USE #9]
    |-- tool.execute.after .............. saveObservation     [USE #12]
    |-- experimental.chat.system.transform  injectContext     [USE #14]
    |-- experimental.session.compacting . compactionHook      [USE #15]
    |-- experimental.text.complete ...... textComplete        [USE #16]
    |-- event (session.idle) ............ sendSummary         [USE #1]
    '-- event (session.deleted) ......... completeSession     [USE #1]
```

All memory operations are fire-and-forget. No hook blocks the OpenCode response pipeline.

---

## SKIP Rationale Summary

| Hook | Reason skipped |
|------|---------------|
| `config` | No plugin-level configuration surface needed |
| `tool` | Plugin registers no custom tools |
| `auth` | Worker communication is local; no auth layer |
| `chat.params` | Model parameters (temperature, tokens) carry no memory signal |
| `chat.headers` | HTTP request headers are infrastructure, not content |
| `permission.ask` | Permission prompts are transient UI events, not observations |
| `shell.env` | Environment variables are not memory-relevant |
| `tool.definition` | Tool metadata is static; not useful as an observation |
