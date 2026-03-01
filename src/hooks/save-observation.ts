import type { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";
import { safeParseJson } from "../utils/safe-parse.js";
import { shouldSkipTool } from "../utils/tool-filter.js";
import { stripMemoryTagsFromJson, stripMemoryTagsFromText } from "../utils/strip-tags.js";
import { MAX_OUTPUT_BYTES } from "../constants.js";



export function createSaveObservationHook(
  memClient: ClaudeMemClient,
  state: PluginState,
  cwd = "",
) {


  return async (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: { title: string; output: string; metadata: any },
  ): Promise<void> => {


    if (shouldSkipTool(input.tool)) return;

    if (!input.sessionID) return;

    let toolOutput = output.output ?? "";
    if (toolOutput.length > MAX_OUTPUT_BYTES) {
      toolOutput = toolOutput.slice(0, MAX_OUTPUT_BYTES) + "\n[truncated]";
    }

    let inputText: string;
    try {
      inputText = JSON.stringify(input.args ?? {});
    } catch {
      inputText = "[unserializable input]";
    }

    if (inputText.length > MAX_OUTPUT_BYTES) {
      inputText = inputText.slice(0, MAX_OUTPUT_BYTES) + "\n[truncated]";
    }

    const cleanInput = stripMemoryTagsFromJson(inputText);
    const cleanOutput = stripMemoryTagsFromText(toolOutput);

    void memClient.sendObservation({
      contentSessionId: input.sessionID,
      tool_name: input.tool,
      tool_input: safeParseJson(cleanInput),
      tool_response: cleanOutput,
      cwd: cwd || undefined,
      last_user_message: state.lastUserMessage || undefined,
      last_assistant_message: state.lastAssistantMessage || undefined,
      prompt_number: state.promptNumber > 0 ? state.promptNumber : undefined,
    });
  };
}
