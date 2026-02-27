import { describe, it, expect } from "bun:test";
import { stripMemoryTagsFromText, stripMemoryTagsFromJson } from "./strip-tags.js";

describe("stripMemoryTagsFromText", () => {
  it("strips <private> tags", () => {
    const result = stripMemoryTagsFromText("before <private>secret</private> after");
    expect(result).toBe("before  after");
  });

  it("strips <claude-mem-context> tags", () => {
    const result = stripMemoryTagsFromText("start <claude-mem-context>ctx</claude-mem-context> end");
    expect(result).toBe("start  end");
  });

  it("returns empty string unchanged", () => {
    expect(stripMemoryTagsFromText("")).toBe("");
  });

  it("returns text without tags unchanged", () => {
    expect(stripMemoryTagsFromText("hello world")).toBe("hello world");
  });

  it("handles multiline tag content", () => {
    const input = "before\n<private>\nline1\nline2\n</private>\nafter";
    const result = stripMemoryTagsFromText(input);
    expect(result).not.toContain("<private>");
    expect(result).toContain("before");
    expect(result).toContain("after");
  });

  it("strips both tag types from same string", () => {
    const input = "<private>a</private> mid <claude-mem-context>b</claude-mem-context>";
    const result = stripMemoryTagsFromText(input);
    expect(result).not.toContain("<private>");
    expect(result).not.toContain("<claude-mem-context>");
    expect(result).toContain("mid");
  });

  it("handles ReDoS protection with many tags", () => {
    const start = Date.now();
    const manyTags = "<private>x</private>".repeat(50);
    const result = stripMemoryTagsFromText(manyTags);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // Should complete in < 1 second
    expect(result).toBe("");
  });
});

describe("stripMemoryTagsFromJson", () => {
  it("strips tags from JSON string values", () => {
    const json = JSON.stringify({ message: "hello <private>secret</private> world" });
    const result = stripMemoryTagsFromJson(json);
    const parsed = JSON.parse(result);
    expect(parsed.message).not.toContain("<private>");
    expect(parsed.message).toContain("hello");
  });

  it("falls back to text stripping for invalid JSON", () => {
    const result = stripMemoryTagsFromJson("not json <private>x</private>");
    expect(result).not.toContain("<private>");
  });
});
