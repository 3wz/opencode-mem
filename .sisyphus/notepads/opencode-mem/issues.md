# Issues — opencode-mem

## Open Issues
(none yet)

## Resolved Issues
(none yet)


## Audit (2026-02-27)
- F1 found literal `~/.claude-mem` references in source comments/tests (e.g. `src/types.ts:1`, `src/utils/detect.ts:20`, `src/utils/detect.ts:38`, `src/types.test.ts:16`, `src/utils/detect.test.ts:5`). Runtime code uses `getDataDir()` + `homedir()` (no tilde hardcoding), but the string-match guardrail currently fails.
