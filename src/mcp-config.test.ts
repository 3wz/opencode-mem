import { describe, it, expect } from "bun:test";
import { generateMcpConfig, generateInstallInstructions } from "./mcp-config.js";

describe("generateMcpConfig", () => {
  it("returns object with claude-mem key", () => {
    const config = generateMcpConfig();
    expect(config).toHaveProperty("claude-mem");
  });

  it("returns URL with default port 37777", () => {
    const config = generateMcpConfig();
    expect(config["claude-mem"].url).toBe("http://localhost:37777/mcp");
  });

  it("returns URL with custom port", () => {
    const config = generateMcpConfig(38000);
    expect(config["claude-mem"].url).toBe("http://localhost:38000/mcp");
  });

  it("sets type to remote", () => {
    const config = generateMcpConfig();
    expect(config["claude-mem"].type).toBe("remote");
  });
});

describe("generateInstallInstructions", () => {
  it("returns string containing opencode.json", () => {
    const instructions = generateInstallInstructions();
    expect(instructions).toContain("opencode.json");
  });

  it("contains the JSON config snippet", () => {
    const instructions = generateInstallInstructions();
    expect(instructions).toContain('"claude-mem"');
    expect(instructions).toContain('"type": "remote"');
    expect(instructions).toContain('"url"');
  });

  it("uses default port in output", () => {
    const instructions = generateInstallInstructions();
    expect(instructions).toContain("37777");
  });

  it("uses custom port in output", () => {
    const instructions = generateInstallInstructions(38000);
    expect(instructions).toContain("38000");
    expect(instructions).not.toContain("37777");
  });

  it("includes available MCP tools list", () => {
    const instructions = generateInstallInstructions();
    expect(instructions).toContain("search");
    expect(instructions).toContain("timeline");
    expect(instructions).toContain("get_observations");
    expect(instructions).toContain("save_memory");
  });
});
