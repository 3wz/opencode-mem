import type { ClaudeMemClient } from "../client.js";

/**
 * Creates the experimental.chat.system.transform hook.
 * Injects persistent memory context from claude-mem into the system prompt.
 */
export function createContextInjectionHook(
  memClient: ClaudeMemClient,
  projectName: string,
  port = 37777,
) {
  return async (
    input: { sessionID?: string },
    output: { system: string[] },
  ): Promise<void> => {
    void input;
    try {
      const result = await memClient.getContext(projectName);
      if (!result?.context) {
        return;
      }

      const contextBlock = [
        "## Claude-Mem Persistent Memory",
        "",
        result.context,
        "",
        `Memory viewer: http://localhost:${port}`,
      ].join("\n");

      output.system.push(contextBlock);
    } catch {
      // Never crash opencode - silently skip context injection
    }
  };
}
