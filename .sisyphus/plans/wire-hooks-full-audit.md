# Wire All Hooks & Full 17-Hook Audit

## TL;DR

> **Quick Summary**: Wire 5 implemented-but-disconnected hook factories into plugin.ts (the root cause of "no observations saved"), implement 2 new high-value hook factories, and document use/skip/future decisions for all 17 OpenCode plugin hooks.
>
> **Deliverables**:
> - `src/plugin.ts` — All hooks wired via extracted `buildHooks()` helper
> - `src/hooks/command-execute.ts` + tests — New factory for slash command capture
> - `src/hooks/text-complete.ts` + tests — New factory for assistant output capture
> - `HOOKS.md` — Decision matrix for all 17 OpenCode hooks
> - Updated `src/plugin.test.ts` — Tests for all hook wiring
>
> **Estimated Effort**: Medium (5 implementation tasks + verification)
> **Parallel Execution**: YES - 3 waves + final verification
> **Critical Path**: Task 1 → Task 4 → Final Verification

---

## Context

### Original Request

The opencode-mem plugin was not saving observations to claude-mem. After restarting OpenCode and working, the claude-mem web viewer (localhost:37777) showed only data from Claude Code sessions — nothing from OpenCode.

### Interview Summary

**Key Discussions**:
- **Root Cause Found**: `src/plugin.ts` only returns an `event` handler for `session.created`/`session.deleted`. All 5 hook factories are fully implemented, tested, and signature-compatible — but never wired into the returned Hooks object.
- **Full Audit Requested**: User wants ALL 17 OpenCode hooks evaluated with use/skip/future decisions, not just the immediate fix.
- **New Hook Opportunities**: Analysis identified `command.execute.before` (high value) and `experimental.text.complete` (medium value) as worth implementing.

**Research Findings**:
- Claude-mem uses 5 hooks in Claude Code: SessionStart → contextHandler, UserPromptSubmit → sessionInitHandler, PostToolUse → observationHandler, Stop(idle) → summarizeHandler, Stop(complete) → sessionCompleteHandler.
- All 5 have OpenCode equivalents with working factories in `src/hooks/`.
- OpenCode Plugin Hooks interface has 17 hooks total (from `@opencode-ai/plugin@1.2.15`).
- `experimental.chat.messages.transform` was evaluated but DEFERRED — its purpose is unclear vs `system.transform` and risks adding complexity without clear benefit.

### Metis Review

**Identified Gaps** (addressed):
- **Summary handler cannot be a separate hook key**: The `event` hook is the ONLY valid integration point. Summary handler must be COMPOSED into the event handler, not wired as a separate key. → Plan structures this correctly.
- **Two code paths must both be updated**: `OpenCodeMem` (default export) and `createPluginWithDependencies` (DI/testing) both return hooks. → Plan extracts shared `buildHooks()` helper called by both.
- **Fire-and-forget constraint needs refinement**: POST operations are fire-and-forget (`void`). GET operations for context injection/compaction MAY await with the 2s AbortController timeout. → Documented in constraints.
- **MockClaudeMemClient is incomplete**: Only has `initSession` + `completeSession`. Needs `sendObservation`, `sendSummary`, `getContext` for new hook tests. → Task 1 includes mock expansion.

---

## Work Objectives

### Core Objective

Make the opencode-mem plugin actually capture prompts, save observations, inject context, handle compaction, and trigger summaries — by wiring the 5 existing hook factories into the plugin return value, implementing 2 new hook factories, and documenting all 17 hook decisions.

### Concrete Deliverables

- `src/plugin.ts` — `buildHooks()` helper function + both export paths call it
- `src/hooks/command-execute.ts` — Factory for `command.execute.before` hook
- `src/hooks/command-execute.test.ts` — Tests for command execute factory
- `src/hooks/text-complete.ts` — Factory for `experimental.text.complete` hook
- `src/hooks/text-complete.test.ts` — Tests for text complete factory
- `src/plugin.test.ts` — Updated to verify all hook keys + summary dispatch
- `HOOKS.md` — Decision matrix for all 17 OpenCode plugin hooks

### Definition of Done

- [ ] `bun test` → 0 failures, test count increased from 148
- [ ] `bunx tsc --noEmit` → clean (no output)
- [ ] Returned Hooks object has keys: `event`, `chat.message`, `tool.execute.after`, `experimental.chat.system.transform`, `experimental.session.compacting`, `command.execute.before`, `experimental.text.complete`
- [ ] Both `OpenCodeMem` and `createPluginWithDependencies` return identical hook sets
- [ ] HOOKS.md documents all 17 hooks with use/skip/future decision + rationale

### Must Have

- All 5 existing hook factories wired into plugin.ts
- Summary handler composed into event handler (dispatched on `session.idle`)
- Shared `buildHooks()` helper eliminates duplication between two code paths
- 2 new hook factories following existing patterns
- Decision matrix covering all 17 hooks

### Must NOT Have (Guardrails)

- **No changes to existing hook factory implementations** — `src/hooks/*.ts` factories are correct; only `src/plugin.ts` wiring changes
- **No `console.log`** — use `client.app.log()` exclusively
- **No thrown errors from HTTP methods** — catch silently per project convention
- **No awaiting POST operations** — fire-and-forget via `void` (GET operations for context/compaction MAY await with 2s timeout)
- **No `isWorkerRunning` guard normalization** — existing inconsistency is documented but out of scope
- **No `tool.execute.before` hook** — deferred to future (low value)
- **No `experimental.chat.messages.transform` hook** — deferred to future (unclear purpose vs system.transform)
- **No barrel export `src/hooks/index.ts`** — not required, individual imports are fine
- **No integration tests against real claude-mem worker** — mock server pattern only
- **No changes to `src/client.ts`** — existing client methods cover all needs

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES (bun:test, 148 tests across 21 files)
- **Automated tests**: YES (tests-after, per existing project pattern)
- **Framework**: bun:test
- **Baseline**: 148 pass, 0 fail, 314 expect() calls

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Plugin wiring**: Use Bash (bun test) — Run specific test files, assert pass counts
- **Hook factories**: Use Bash (bun test) — Run hook test files with mock HTTP servers
- **Type safety**: Use Bash (bunx tsc --noEmit) — Assert zero output
- **Hook key verification**: Use Bash (bun test) — Assert returned object shape

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Core Fix — sequential, this is the critical path):
└── Task 1: Extract buildHooks + wire 5 existing hooks + update plugin tests [deep]

Wave 2 (New Factories — MAX PARALLEL):
├── Task 2: Create command-execute factory + tests [quick]
└── Task 3: Create text-complete factory + tests [quick]

Wave 3 (Integration + Docs — PARALLEL):
├── Task 4: Wire new factories into buildHooks + final test pass [quick]
└── Task 5: Create HOOKS.md decision matrix [writing]

Wave FINAL (After ALL tasks — 4 parallel verification agents):
├── F1: Plan compliance audit [oracle]
├── F2: Code quality review [unspecified-high]
├── F3: Real QA - run full suite + verify hook shape [unspecified-high]
└── F4: Scope fidelity check [deep]

Critical Path: Task 1 → Task 4 → Final Verification
Parallel Speedup: ~40% faster than sequential
Max Concurrent: 2 (Waves 2 & 3)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2, 3, 4 | 1 |
| 2 | 1 | 4 | 2 |
| 3 | 1 | 4 | 2 |
| 4 | 1, 2, 3 | F1-F4 | 3 |
| 5 | — | F1 | 3 |
| F1-F4 | 4, 5 | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: 1 task — T1 → `deep`
- **Wave 2**: 2 tasks — T2 → `quick`, T3 → `quick`
- **Wave 3**: 2 tasks — T4 → `quick`, T5 → `writing`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

### Task 1 — Extract `buildHooks` helper + wire 5 existing hooks + tests
- **Wave**: 1 (Foundation)
- **Category**: `deep`
- **Skills**: `[]`
- **Depends on**: —
- **Blocks**: Tasks 2, 3, 4
- **Files to modify**: `src/plugin.ts`, `src/plugin.test.ts`
- **Files READ ONLY (do not modify)**: `src/hooks/capture-prompt.ts`, `src/hooks/save-observation.ts`, `src/hooks/context-inject.ts`, `src/hooks/compaction.ts`, `src/hooks/summary.ts`, `src/client.ts`, `src/types.ts`

**What to do**:

1. **Extract `buildHooks()` helper** in `src/plugin.ts`:
   - Create a function `buildHooks(memClient: ClaudeMemClient, state: PluginState, projectName: string, port: number, cwd: string)`
   - Import all 5 existing hook factories from `src/hooks/`
   - Return a Hooks object with ALL keys
   - Both `OpenCodeMem` (line 13) and `createPluginWithDependencies` (line 91) call `buildHooks()` to get their return value

2. **Wire 4 new hook keys** in the returned object:
   ```typescript
   "chat.message": createCapturePromptHook(memClient, state),
   "tool.execute.after": createSaveObservationHook(memClient, state, cwd),
   "experimental.chat.system.transform": createContextInjectionHook(memClient, projectName, port),
   "experimental.session.compacting": createCompactionHook(memClient, projectName),
   ```

3. **Compose summary handler into event handler**:
   ```typescript
   const summaryHandler = createSummaryHandler(memClient, state);
   return {
     event: async ({ event }) => {
       if (event.type === "session.created") { /* existing logic */ }
       if (event.type === "session.deleted") { /* existing logic */ }
       // Dispatch to summary handler (it filters for session.idle internally)
       await summaryHandler({ event });
     },
     // ... other hooks
   };
   ```

4. **Update `createPluginWithDependencies`** to also call `buildHooks()`:
   - The DI version passes its `clientFactory`-created memClient to `buildHooks()`
   - Both code paths now return identical hook sets

5. **Update `src/plugin.test.ts`**:
   - Expand `MockClaudeMemClient` to include: `sendObservation()`, `sendSummary()`, `getContext()` methods (all mock/no-op)
   - Add test: `"returns hooks object with all expected keys"` — verify `event`, `chat.message`, `tool.execute.after`, `experimental.chat.system.transform`, `experimental.session.compacting` keys exist
   - Add test: `"event handler dispatches session.idle to summary"` — verify `sendSummary` is called when event type is `session.idle`
   - Ensure all existing tests still pass (session.created, session.deleted, unknown event, worker unavailable, etc.)

**Constraints**:
- MUST NOT modify any file in `src/hooks/` — factories are correct as-is
- MUST NOT use `console.log` — use existing `log()` function
- MUST NOT await POST operations — fire-and-forget via `void`
- GET operations in context-inject and compaction hooks MAY await (they need the result, 2s timeout is the cap)
- The `event` hook is the ONLY place for summary dispatch — there is no separate `session.idle` hook key

**QA scenarios** (agent-executed):
```bash
mkdir -p .sisyphus/evidence

# Run plugin tests specifically
bun test src/plugin.test.ts 2>&1 | tee .sisyphus/evidence/task-1-plugin-tests.txt | tail -5
# Assert: all pass, pass count increased

# Run all hook tests to verify no regression
bun test src/hooks/ 2>&1 | tee .sisyphus/evidence/task-1-hook-tests.txt | tail -5
# Assert: all pass, 0 fail

# Type check
bunx tsc --noEmit 2>&1 | tee .sisyphus/evidence/task-1-tsc.txt
# Assert: no output (clean)
```

---

### Task 2 — Create `command-execute` hook factory + tests
- **Wave**: 2 (New Factories — PARALLEL with Task 3)
- **Category**: `quick`
- **Skills**: `[]`
- **Depends on**: Task 1
- **Blocks**: Task 4
- **Files to CREATE**: `src/hooks/command-execute.ts`, `src/hooks/command-execute.test.ts`
- **Files READ ONLY**: `src/hooks/save-observation.ts` (pattern reference), `src/hooks/capture-prompt.test.ts` (test pattern reference)

**What to do**:

1. **Create `src/hooks/command-execute.ts`**:
   - Export: `createCommandExecuteHook(memClient: ClaudeMemClient, state: PluginState)`
   - Returns: `async (input: { command: string; sessionID: string; arguments: any }, output: { parts: unknown[] }) => Promise<void>`
   - Skip if `input.sessionID` is empty
   - Skip if `input.command` is empty
   - Fire-and-forget: `void memClient.sendObservation({...})`
   - Payload:
     ```typescript
     {
       claudeSessionId: input.sessionID,
       toolName: `command:${input.command}`,
       toolInput: stripMemoryTagsFromJson(JSON.stringify(input.arguments ?? {})),
       toolResult: `Slash command executed: /${input.command}`,
     }
     ```
   - Import `stripMemoryTagsFromJson` from `../utils/strip-tags.js`
   - Follow the exact style of `save-observation.ts` (same import pattern, void prefix, type annotations)

2. **Create `src/hooks/command-execute.test.ts`**:
   - Use mock server on port **37904** (next available after existing 37900-37903 range)
   - Follow exact test pattern from `capture-prompt.test.ts` (beforeAll/afterAll server lifecycle, receivedBody, requestCount)
   - Tests:
     - `"captures command as observation"` — verify POST body has `toolName: "command:test-cmd"`
     - `"skips when sessionID is empty"` — verify requestCount === 0
     - `"skips when command is empty"` — verify requestCount === 0
     - `"strips privacy tags from arguments"` — verify `<private>` tags removed from toolInput

**Constraints**:
- MUST follow existing factory pattern exactly (imports, typing, void prefix)
- MUST NOT mutate `output.parts`
- MUST use `void memClient.sendObservation()` (fire-and-forget)
- Mock server port: 37904 (MUST NOT conflict with existing 37900-37903)

**QA scenarios**:
```bash
bun test src/hooks/command-execute.test.ts 2>&1 | tee .sisyphus/evidence/task-2-command-execute-tests.txt | tail -5
# Assert: all pass, 4+ tests

bunx tsc --noEmit 2>&1 | tee .sisyphus/evidence/task-2-tsc.txt
# Assert: clean
```

---

### Task 3 — Create `text-complete` hook factory + tests
- **Wave**: 2 (New Factories — PARALLEL with Task 2)
- **Category**: `quick`
- **Skills**: `[]`
- **Depends on**: Task 1
- **Blocks**: Task 4
- **Files to CREATE**: `src/hooks/text-complete.ts`, `src/hooks/text-complete.test.ts`
- **Files READ ONLY**: `src/hooks/save-observation.ts` (pattern reference), `src/hooks/capture-prompt.test.ts` (test pattern reference)

**What to do**:

1. **Create `src/hooks/text-complete.ts`**:
   - Export: `createTextCompleteHook(memClient: ClaudeMemClient, state: PluginState)`
   - Returns: `async (input: { sessionID: string; messageID: string; partID: string }, output: { text: string }) => Promise<void>`
   - Skip if `input.sessionID` is empty
   - Skip if `output.text` is empty/whitespace
   - **CRITICAL**: MUST NOT mutate `output.text` — read it, copy for observation, leave original untouched
   - Truncate text if > 100KB (`MAX_OUTPUT_BYTES = 100 * 1024`, matching save-observation.ts)
   - Strip privacy tags: `stripMemoryTagsFromText(output.text)`
   - Fire-and-forget: `void memClient.sendObservation({...})`
   - Payload:
     ```typescript
     {
       claudeSessionId: input.sessionID,
       toolName: "assistant_response",
       toolInput: JSON.stringify({ messageID: input.messageID, partID: input.partID }),
       toolResult: cleanText,
     }
     ```

2. **Create `src/hooks/text-complete.test.ts`**:
   - Use mock server on port **37905**
   - Follow exact test pattern from `capture-prompt.test.ts`
   - Tests:
     - `"captures assistant text as observation"` — verify POST body has `toolName: "assistant_response"` and text in toolResult
     - `"does NOT mutate output.text"` — create output object, call hook, verify `output.text` unchanged
     - `"skips when sessionID is empty"` — verify requestCount === 0
     - `"skips when text is empty"` — verify requestCount === 0
     - `"truncates very long text"` — create 200KB string, verify toolResult is truncated

**Constraints**:
- MUST NOT mutate `output.text` — this is an output hook, not a transform hook
- MUST use `void memClient.sendObservation()` (fire-and-forget)
- MUST truncate at 100KB (matching save-observation.ts `MAX_OUTPUT_BYTES`)
- Mock server port: 37905

**QA scenarios**:
```bash
bun test src/hooks/text-complete.test.ts 2>&1 | tee .sisyphus/evidence/task-3-text-complete-tests.txt | tail -5
# Assert: all pass, 5+ tests

bunx tsc --noEmit 2>&1 | tee .sisyphus/evidence/task-3-tsc.txt
# Assert: clean
```

---

### Task 4 — Wire new factories into `buildHooks` + final test pass
- **Wave**: 3 (Integration)
- **Category**: `quick`
- **Skills**: `[]`
- **Depends on**: Tasks 1, 2, 3
- **Blocks**: Final Verification
- **Files to modify**: `src/plugin.ts`, `src/plugin.test.ts`

**What to do**:

1. **Update `buildHooks()` in `src/plugin.ts`**:
   - Import new factories: `createCommandExecuteHook`, `createTextCompleteHook`
   - Add to returned Hooks object:
     ```typescript
     "command.execute.before": createCommandExecuteHook(memClient, state),
     "experimental.text.complete": createTextCompleteHook(memClient, state),
     ```

2. **Update `src/plugin.test.ts`**:
   - Add `command.execute.before` and `experimental.text.complete` to the hook-key-existence test
   - Verify final hook count: 7 keys total (`event` + 6 named hooks)

3. **Run full test suite**:
   ```bash
   bun test 2>&1 | tail -5
   # Assert: 0 fail, pass count > 148
   
   bunx tsc --noEmit 2>&1
   # Assert: clean
   ```

**Constraints**:
- MUST only add 2 lines to buildHooks return object + 2 imports
- MUST only add 2 lines to plugin.test.ts hook key verification
- This is a SMALL integration task — resist scope creep

**QA scenarios**:
```bash
# Full suite
bun test 2>&1 | tee .sisyphus/evidence/task-4-full-suite.txt | tail -5
# Assert: 0 fail, all pass

# Plugin-specific
bun test src/plugin.test.ts 2>&1 | tee .sisyphus/evidence/task-4-plugin-tests.txt | tail -5
# Assert: all pass
```

---

### Task 5 — Create `HOOKS.md` decision matrix
- **Wave**: 3 (Documentation — PARALLEL with Task 4)
- **Category**: `writing`
- **Skills**: `[]`
- **Depends on**: —
- **Blocks**: Final Verification (F1)
- **Files to CREATE**: `HOOKS.md`

**What to do**:

1. **Create `HOOKS.md` at project root** with:
   - Title: "OpenCode Plugin Hooks — Decision Matrix"
   - Brief intro: what this document covers
   - Table with columns: #, Hook Key, Decision (USE/SKIP/FUTURE), Implementation, Rationale
   - Use the decision data from the Appendix in this plan (all 17 hooks)
   - For USE hooks: link to the factory file (e.g., `src/hooks/capture-prompt.ts`)
   - For SKIP hooks: one-sentence rationale why it's not needed
   - For FUTURE hooks: brief description of potential future use case
   - Summary stats: "7 USE · 8 SKIP · 2 FUTURE"
   - Add architecture diagram showing hook flow (text-based, matching README style)

**Constraints**:
- MUST cover all 17 hooks — no gaps
- MUST match the decisions in this plan's Appendix exactly
- Keep it concise — this is reference documentation, not a tutorial
- No emojis unless the project README uses them (it does — green/skip/future indicators are OK)
---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run `bun test`). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `bunx tsc --noEmit` + `bun test`. Review all changed files for: `as any`/`@ts-ignore` (warn only — existing code uses `as any` in type assertions), empty catches (OK if by convention), `console.log` in prod (REJECT), unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real QA** — `unspecified-high`
  Start from clean state. Run `bun test` full suite. Verify hook key shape by importing plugin and checking returned object. Run each hook test file individually. Verify new test files exist and pass. Save output to `.sisyphus/evidence/final-qa/`.
  Output: `Tests [N/N pass] | Hook Keys [N/N] | New Files [N/N exist] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (`git diff`). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance: no changes to hook factory source files, no console.log, no thrown errors. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Guardrails [N/N respected] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After | Message | Files | Pre-commit |
|-------|---------|-------|------------|
| Task 1 | `fix(plugin): wire all existing hook factories via buildHooks helper` | `src/plugin.ts`, `src/plugin.test.ts` | `bun test && bunx tsc --noEmit` |
| Tasks 2+3 | `feat(hooks): add command-execute and text-complete factories` | `src/hooks/command-execute.ts`, `src/hooks/command-execute.test.ts`, `src/hooks/text-complete.ts`, `src/hooks/text-complete.test.ts` | `bun test && bunx tsc --noEmit` |
| Task 4 | `feat(plugin): wire command-execute and text-complete hooks` | `src/plugin.ts`, `src/plugin.test.ts` | `bun test && bunx tsc --noEmit` |
| Task 5 | `docs: add hook decision matrix for all 17 OpenCode hooks` | `HOOKS.md` | — |

---

## Success Criteria

### Verification Commands

```bash
bun test 2>&1 | tail -5
# Expected: "0 fail" and pass count > 148

bunx tsc --noEmit 2>&1
# Expected: no output (clean)

bun test src/plugin.test.ts 2>&1 | tail -5
# Expected: all pass, includes new hook key verification tests

bun test src/hooks/command-execute.test.ts 2>&1 | tail -3
# Expected: all pass

bun test src/hooks/text-complete.test.ts 2>&1 | tail -3
# Expected: all pass
```

### Final Checklist

- [ ] All 5 existing hook factories wired
- [ ] Summary handler composed into event handler
- [ ] `buildHooks()` helper shared by both code paths
- [ ] 2 new hook factories implemented and tested
- [ ] HOOKS.md decision matrix covers all 17 hooks
- [ ] All tests pass
- [ ] TypeScript clean
- [ ] No console.log in production code
- [ ] No thrown errors from HTTP client methods
- [ ] No awaited POST operations (fire-and-forget)

---

## Appendix: Hook Decision Matrix (Reference for Task 5)

| # | Hook Key | Decision | Implementation | Rationale |
|---|----------|----------|----------------|-----------|
| 1 | `event` | USE | Expanded (session.idle → summary) | Already wired for session.created/deleted; expanded for summary dispatch |
| 2 | `config` | SKIP | — | No memory-related configuration needed |
| 3 | `tool` | SKIP | — | Plugin doesn't define custom tools |
| 4 | `auth` | SKIP | — | No auth needed for memory operations |
| 5 | `chat.message` | USE | Wired: `createCapturePromptHook` | Captures user prompts for session tracking |
| 6 | `chat.params` | SKIP | — | Model parameters not useful for memory |
| 7 | `chat.headers` | SKIP | — | HTTP headers not memory-relevant |
| 8 | `permission.ask` | SKIP | — | Permission events not memory-relevant |
| 9 | `command.execute.before` | USE | New: `createCommandExecuteHook` | Capture slash commands as high-signal observations |
| 10 | `tool.execute.before` | FUTURE | — | Low value — tool output (after) matters more than intent (before) |
| 11 | `shell.env` | SKIP | — | Shell environment not memory-relevant |
| 12 | `tool.execute.after` | USE | Wired: `createSaveObservationHook` | Captures tool results as observations |
| 13 | `experimental.chat.messages.transform` | FUTURE | — | Purpose unclear vs system.transform; defer until use case emerges |
| 14 | `experimental.chat.system.transform` | USE | Wired: `createContextInjectionHook` | Injects persistent memory context into system prompt |
| 15 | `experimental.session.compacting` | USE | Wired: `createCompactionHook` | Preserves memory through compaction |
| 16 | `experimental.text.complete` | USE | New: `createTextCompleteHook` | Capture assistant output for richer session context |
| 17 | `tool.definition` | SKIP | — | Tool definition metadata not memory-relevant |

**Summary**: 7 USE · 8 SKIP · 2 FUTURE
