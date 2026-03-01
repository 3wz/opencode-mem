import type { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";

export function createSummaryHandler(
  memClient: ClaudeMemClient,
  state: PluginState,
) {
  return async (input: { event: any }): Promise<void> => {
    if (input.event.type !== "session.idle") return;

    const sessionId = input.event.properties?.sessionID ?? state.sessionId;
    if (!sessionId) return;
    if (!state.isWorkerRunning) return;

    void memClient.sendSummary({
      contentSessionId: sessionId,
      last_assistant_message: state.lastAssistantMessage || undefined,
    });
  };
}
