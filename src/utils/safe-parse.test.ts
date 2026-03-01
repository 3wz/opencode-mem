import { describe, expect, it } from "bun:test";
import { safeParseJson } from "./safe-parse.js";

describe("safeParseJson", () => {
  it("returns parsed object for valid object JSON", () => {
    expect(safeParseJson('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
  });

  it("returns raw fallback for invalid JSON", () => {
    expect(safeParseJson("{invalid")).toEqual({ raw: "{invalid" });
  });

  it("returns raw fallback for non-object JSON", () => {
    expect(safeParseJson('"text"')).toEqual({ raw: '"text"' });
  });
});
