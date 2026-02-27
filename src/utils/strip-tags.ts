/**
 * Strips memory-related tags from text to protect privacy.
 * Uses iteration limit (100) for ReDoS protection.
 */

const PRIVATE_TAG_REGEX = /<private>[\s\S]*?<\/private>/g;
const CONTEXT_TAG_REGEX = /<claude-mem-context>[\s\S]*?<\/claude-mem-context>/g;
const MAX_REPLACEMENTS = 100;

/**
 * Strip <private>...</private> and <claude-mem-context>...</claude-mem-context> from text.
 * Uses iteration limit to protect against ReDoS.
 */
export function stripMemoryTagsFromText(text: string): string {
  if (!text) return text;
  
  let result = text;
  let count = 0;
  
  // Strip <private> tags
  while (count < MAX_REPLACEMENTS && PRIVATE_TAG_REGEX.test(result)) {
    PRIVATE_TAG_REGEX.lastIndex = 0;
    result = result.replace(PRIVATE_TAG_REGEX, "");
    count++;
  }
  PRIVATE_TAG_REGEX.lastIndex = 0;
  
  // Strip <claude-mem-context> tags
  while (count < MAX_REPLACEMENTS && CONTEXT_TAG_REGEX.test(result)) {
    CONTEXT_TAG_REGEX.lastIndex = 0;
    result = result.replace(CONTEXT_TAG_REGEX, "");
    count++;
  }
  CONTEXT_TAG_REGEX.lastIndex = 0;
  
  return result.trim();
}

/**
 * Strip memory tags from a JSON string (strips from all string values).
 */
export function stripMemoryTagsFromJson(jsonString: string): string {
  if (!jsonString) return jsonString;
  try {
    // Try to parse and re-serialize with stripped values
    const parsed = JSON.parse(jsonString);
    const stripped = stripFromObject(parsed);
    return JSON.stringify(stripped);
  } catch {
    // If not valid JSON, treat as plain text
    return stripMemoryTagsFromText(jsonString);
  }
}

function stripFromObject(obj: unknown): unknown {
  if (typeof obj === "string") return stripMemoryTagsFromText(obj);
  if (Array.isArray(obj)) return obj.map(stripFromObject);
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = stripFromObject(v);
    }
    return result;
  }
  return obj;
}
