import type { ClaudeMemClient } from "../client.js";

import { safeParseJson } from "../utils/safe-parse.js";
import { stripMemoryTagsFromJson } from "../utils/strip-tags.js";

export function createCommandExecuteHook(
  memClient: ClaudeMemClient,
) {

  return async (
    input: { command: string; sessionID: string; arguments: string },
    _output: { parts: unknown[] },
  ): Promise<void> => {
    if (!input.sessionID || !input.command) return;

    let argumentsText: string;
    try {
      argumentsText = JSON.stringify(input.arguments ?? {});
    } catch {
      argumentsText = "[unserializable input]";
    }

    void memClient.sendObservation({
      contentSessionId: input.sessionID,
      tool_name: `command:${input.command}`,
      tool_input: safeParseJson(stripMemoryTagsFromJson(argumentsText)),
      tool_response: `Slash command executed: /${input.command}`,
    });
  };
}
