const DEFAULT_PORT = 37777;

export interface McpConfig {
  type: "local";
  command: string[];
  enabled?: boolean;
  environment?: Record<string, string>;
}

export interface OpenCodeMcpConfig {
  "claude-mem": McpConfig;
}

/**
 * Generate opencode.json-compatible MCP config for claude-mem.
 * Points to the local claude-mem MCP server.
 */
export function generateMcpConfig(mcpServerPath: string): OpenCodeMcpConfig {
  return {
    "claude-mem": {
      type: "local",
      command: [mcpServerPath],
      enabled: true,
    },
  };
}

/**
 * Generate markdown installation instructions for adding claude-mem MCP to opencode.
 */
export function generateInstallInstructions(mcpServerPath?: string): string {
  const examplePath = mcpServerPath || "/path/to/mcp-server.cjs";
  const config = generateMcpConfig(examplePath);
  return `## Adding claude-mem MCP to opencode

Add the following to your \`opencode.json\` under the \`mcp\` key:

\`\`\`json
{
  "mcp": ${JSON.stringify(config, null, 2)}
}
\`\`\`

The \`command\` field should point to your local claude-mem MCP server executable.
Available MCP tools: search, timeline, get_observations, save_memory.`;
}
