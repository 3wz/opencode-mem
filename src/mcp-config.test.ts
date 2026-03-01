import { describe, it, expect } from "bun:test";
import { generateMcpConfig, generateInstallInstructions } from "./mcp-config.js";

describe("generateMcpConfig", () => {
  it("returns object with claude-mem key", () => {
    const config = generateMcpConfig("/path/to/mcp-server.cjs");
    expect(config).toHaveProperty("claude-mem");
    expect(config["claude-mem"].enabled).toBe(true);
  });

  it("returns command array with provided path", () => {
    const config = generateMcpConfig("/path/to/mcp-server.cjs");
    expect(config["claude-mem"].command).toEqual(["/path/to/mcp-server.cjs"]);
  });

  it("returns command array with custom path", () => {
    const config = generateMcpConfig("/custom/path/server.cjs");
    expect(config["claude-mem"].command).toEqual(["/custom/path/server.cjs"]);
  });

  it("sets type to local", () => {
    const config = generateMcpConfig("/path/to/mcp-server.cjs");
    expect(config["claude-mem"].type).toBe("local");
    expect(config["claude-mem"].enabled).toBe(true);
  });
});

describe("generateInstallInstructions", () => {
  it("returns string containing opencode.json", () => {
    const instructions = generateInstallInstructions("/path/to/mcp-server.cjs");
    expect(instructions).toContain("opencode.json");
  });

  it("contains the JSON config snippet with local type", () => {
    const instructions = generateInstallInstructions("/path/to/mcp-server.cjs");
    expect(instructions).toContain('"claude-mem"');
    expect(instructions).toContain('"type": "local"');
    expect(instructions).toContain('"command"');
  });

  it("uses provided path in output", () => {
    const instructions = generateInstallInstructions("/path/to/mcp-server.cjs");
    expect(instructions).toContain("/path/to/mcp-server.cjs");
  });

  it("uses default example path when not provided", () => {
    const instructions = generateInstallInstructions();
    expect(instructions).toContain("/path/to/mcp-server.cjs");
    expect(instructions).toContain('"type": "local"');
  });

  it("includes available MCP tools list", () => {
    const instructions = generateInstallInstructions("/path/to/mcp-server.cjs");
    expect(instructions).toContain("search");
    expect(instructions).toContain("timeline");
    expect(instructions).toContain("get_observations");
    expect(instructions).toContain("save_memory");
  });
});
