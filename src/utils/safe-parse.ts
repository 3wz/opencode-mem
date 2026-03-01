export function safeParseJson(jsonStr: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(jsonStr);
    return typeof parsed === "object" && parsed !== null ? parsed : { raw: jsonStr };
  } catch {
    return { raw: jsonStr };
  }
}
