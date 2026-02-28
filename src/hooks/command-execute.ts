import type { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";
import { stripMemoryTagsFromJson } from "../utils/strip-tags.js";

function safeParseJson(jsonStr: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(jsonStr);
    return typeof parsed === 'object' && parsed !== null ? parsed : { raw: jsonStr };
  } catch {
    return { raw: jsonStr };
  }
}

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
      contentSessionId: input.sessionID,
      tool_name: `command:${input.command}`,
      tool_input: safeParseJson(stripMemoryTagsFromJson(JSON.stringify(input.arguments ?? {}))),
      tool_response: `Slash command executed: /${input.command}`,
    });
  };
}
