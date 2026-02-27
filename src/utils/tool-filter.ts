/**
 * Tools that should NOT be captured as observations.
 * These are low-value, meta-level, or internal tools.
 * Matches claude-mem's SKIP_TOOLS list.
 */
export const SKIP_TOOLS = new Set([
  "todowrite",
  "askuserquestion",
  "listmcpresourcestool",
  "slashcommand",
  "skill",
  "listmcptools",
  "getmcpresource",
]);

/**
 * Returns true if the tool should be skipped (not captured as observation).
 * Case-insensitive matching.
 */
export function shouldSkipTool(toolName: string): boolean {
  return SKIP_TOOLS.has(toolName.toLowerCase());
}
