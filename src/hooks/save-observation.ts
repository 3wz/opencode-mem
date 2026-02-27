import type { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";
import { shouldSkipTool } from "../utils/tool-filter.js";
import { stripMemoryTagsFromJson, stripMemoryTagsFromText } from "../utils/strip-tags.js";

const MAX_OUTPUT_BYTES = 100 * 1024;

export function createSaveObservationHook(
  memClient: ClaudeMemClient,
  state: PluginState,
  cwd = "",
) {
  void state;

  return async (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: { title: string; output: string; metadata: any },
  ): Promise<void> => {
    void input.callID;
    void output.title;
    void output.metadata;

    if (shouldSkipTool(input.tool)) return;

    if (!input.sessionID) return;

    let toolOutput = output.output ?? "";
    if (toolOutput.length > MAX_OUTPUT_BYTES) {
      toolOutput = toolOutput.slice(0, MAX_OUTPUT_BYTES) + "\n[truncated]";
    }

    const cleanInput = stripMemoryTagsFromJson(JSON.stringify(input.args ?? {}));
    const cleanOutput = stripMemoryTagsFromText(toolOutput);

    void memClient.sendObservation({
      claudeSessionId: input.sessionID,
      toolName: input.tool,
      toolInput: cleanInput,
      toolResult: cleanOutput,
      cwd: cwd || undefined,
    });
  };
}
