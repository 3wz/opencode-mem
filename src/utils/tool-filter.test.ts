import { describe, it, expect } from "bun:test";
import { shouldSkipTool, SKIP_TOOLS } from "./tool-filter.js";

describe("shouldSkipTool", () => {
  it("skips TodoWrite", () => {
    expect(shouldSkipTool("TodoWrite")).toBe(true);
  });

  it("skips AskUserQuestion", () => {
    expect(shouldSkipTool("AskUserQuestion")).toBe(true);
  });

  it("skips ListMcpResourcesTool", () => {
    expect(shouldSkipTool("ListMcpResourcesTool")).toBe(true);
  });

  it("skips SlashCommand", () => {
    expect(shouldSkipTool("SlashCommand")).toBe(true);
  });

  it("skips Skill", () => {
    expect(shouldSkipTool("Skill")).toBe(true);
  });

  it("does NOT skip read", () => {
    expect(shouldSkipTool("read")).toBe(false);
  });

  it("does NOT skip bash", () => {
    expect(shouldSkipTool("bash")).toBe(false);
  });

  it("does NOT skip edit", () => {
    expect(shouldSkipTool("edit")).toBe(false);
  });

  it("does NOT skip write", () => {
    expect(shouldSkipTool("write")).toBe(false);
  });

  it("is case-insensitive for skip tools", () => {
    expect(shouldSkipTool("TODOWRITE")).toBe(true);
    expect(shouldSkipTool("todowrite")).toBe(true);
  });
});
