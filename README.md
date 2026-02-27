# opencode-claude-mem

An opencode plugin that connects to [claude-mem](https://github.com/thedotmack/claude-mem) persistent memory, enabling the same memory system used by claude-code to work seamlessly inside opencode.

> This project is not affiliated with the OpenCode team.

## What It Does

- Injects relevant memory context into every opencode session
- Captures tool observations and user prompts for future recall
- Shares the same claude-mem worker, database, and memory as claude-code
- Provides MCP search tools for querying past sessions
- Gracefully degrades when the claude-mem worker is unavailable

## Prerequisites

- [claude-mem](https://github.com/thedotmack/claude-mem) must be installed and initialized
- The claude-mem worker must be running (port 37777 by default)
- opencode installed

## Installation

### As an opencode Plugin

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-claude-mem"]
}
```

Or install locally:

```bash
npm install opencode-claude-mem
```

Then reference the local path in `opencode.json`:

```json
{
  "plugin": ["./node_modules/opencode-claude-mem"]
}
```

### Local Copy

Copy the plugin to your opencode plugins directory:

```bash
cp -r node_modules/opencode-claude-mem .opencode/plugins/opencode-claude-mem
```

## MCP Search Setup

To enable memory search via MCP tools, add to your `opencode.json`:

```json
{
  "mcp": {
    "claude-mem": {
      "type": "remote",
      "url": "http://localhost:37777/mcp"
    }
  }
}
```

## Skill Setup

Copy the mem-search skill to enable guided memory search:

```bash
cp -r node_modules/opencode-claude-mem/skills/mem-search .opencode/skills/
```

## How It Works

```
opencode session
    │
    ├── session.created → initSession (claude-mem worker)
    ├── chat.message → capturePrompt (fire-and-forget)
    ├── tool.execute.after → saveObservation (fire-and-forget)
    ├── experimental.chat.system.transform → injectContext (appends memory to system prompt)
    ├── experimental.session.compacting → injectCompactionContext
    ├── session.idle → sendSummary (fire-and-forget)
    └── session.deleted → completeSession (claude-mem worker)
```

The plugin connects to the same claude-mem worker (port 37777) and SQLite database (`~/.claude-mem/claude-mem.db`) used by claude-code, enabling shared memory across both tools.

## Configuration

The plugin auto-detects claude-mem configuration from `~/.claude-mem/settings.json`. No manual configuration required.

Environment variables:
- `CLAUDE_MEM_DATA_DIR` — override the data directory path (useful for testing)

## Troubleshooting

**Plugin loads but no memory appears:**
- Verify claude-mem worker is running: `curl http://localhost:37777/health`
- Check that claude-mem has been used with claude-code to build up memory

**Worker not starting:**
- Install claude-mem: follow instructions at https://github.com/thedotmack/claude-mem
- Start the worker manually: `claude-mem start`

**Port conflict:**
- Check `~/.claude-mem/settings.json` for the configured port
- The plugin reads this file automatically

## License

MIT
