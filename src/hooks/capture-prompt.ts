import type { ClaudeMemClient } from "../client.js";
import type { PluginState } from "../types.js";
import { stripMemoryTagsFromText } from "../utils/strip-tags.js";

type MessageContentPart = {
  type?: string;
  text?: string;
};

type ChatMessage = {
  content?: string | MessageContentPart[];
  text?: string;
};

/**
 * Creates the chat.message hook.
 * Captures user prompts for claude-mem session tracking.
 * Uses fire-and-forget (never blocks opencode).
 */
export function createCapturePromptHook(
  memClient: ClaudeMemClient,
  state: PluginState,
) {
  return async (
    input: { sessionID: string; agent?: string },
    output: { message: ChatMessage; parts: unknown[] },
  ): Promise<void> => {
    void output.parts;

    if (!input.sessionID) {
      return;
    }

    const message = output.message;
    let textContent = "";

    if (typeof message?.content === "string") {
      textContent = message.content;
    } else if (Array.isArray(message?.content)) {
      textContent = message.content
        .filter((part): part is MessageContentPart => part?.type === "text")
        .map((part) => part.text ?? "")
        .join("\n");
    } else if (message?.text) {
      textContent = message.text;
    }

    const cleanText = stripMemoryTagsFromText(textContent);
    if (!cleanText.trim()) {
      return;
    }

    void memClient.initSession({
      contentSessionId: input.sessionID,
      project: state.projectName,
      prompt: cleanText,
    });
  };
}
