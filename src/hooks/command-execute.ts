import type { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";
import { stripMemoryTagsFromJson } from "../utils/strip-tags.js";

export function createCommandExecuteHook(
  memClient: ClaudeMemClient,
  state: PluginState,
) {
  void state;

  return async (
    input: { command: string; sessionID: string; arguments: any },
    _output: { parts: unknown[] },
  ): Promise<void> => {
    if (!input.sessionID || !input.command) return;

    void memClient.sendObservation({
      claudeSessionId: input.sessionID,
      toolName: `command:${input.command}`,
      toolInput: stripMemoryTagsFromJson(JSON.stringify(input.arguments ?? {})),
      toolResult: `Slash command executed: /${input.command}`,
    });
  };
}
