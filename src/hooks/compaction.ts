import type { ClaudeMemClient } from "../client.js";

export function createCompactionHook(
  memClient: ClaudeMemClient,
  projectName: string,
) {
  return async (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string },
  ): Promise<void> => {
    try {
      const result = await memClient.getContext(projectName);
      if (!result?.context) {
        return;
      }

      output.context.push(
        [
          "## Claude-Mem Persistent Memory (survives compaction)",
          "",
          result.context,
        ].join("\n"),
      );
    } catch {}
  };
}
