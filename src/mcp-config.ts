const DEFAULT_PORT = 37777;

export interface McpConfig {
  type: "remote";
  url: string;
  enabled?: boolean;
}

export interface OpenCodeMcpConfig {
  "claude-mem": McpConfig;
}

/**
 * Generate opencode.json-compatible MCP config for claude-mem.
 * Points to the claude-mem worker's MCP endpoint.
 */
export function generateMcpConfig(port = DEFAULT_PORT): OpenCodeMcpConfig {
  return {
    "claude-mem": {
      type: "remote",
      url: `http://localhost:${port}/mcp`,
      enabled: true,
    },
  };
}

/**
 * Generate markdown installation instructions for adding claude-mem MCP to opencode.
 */
export function generateInstallInstructions(port = DEFAULT_PORT): string {
  const config = generateMcpConfig(port);
  return `## Adding claude-mem MCP to opencode

Add the following to your \`opencode.json\` under the \`mcp\` key:

\`\`\`json
{
  "mcp": ${JSON.stringify(config, null, 2)}
}
\`\`\`

The claude-mem worker must be running on port ${port}.
Available MCP tools: search, timeline, get_observations, save_memory.`;
}
