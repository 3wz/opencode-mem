# opencode-claude-mem

An opencode plugin that connects to [claude-mem](https://github.com/thedotmack/claude-mem) persistent memory, enabling the same memory system used by claude-code to work seamlessly inside opencode.

> This project is not affiliated with the OpenCode team.

## What It Does

- Injects relevant memory context into every opencode session
- Captures tool observations and user prompts for future recall
- Shares the same claude-mem worker, database, and memory as claude-code
- Provides MCP search tools for querying past sessions
- Gracefully degrades when the claude-mem worker is unavailable
- Automatically installs and configures claude-mem on first load

## Prerequisites

- opencode installed
- npm available in PATH (used to install claude-mem if not already present)

claude-mem is installed automatically when the plugin first loads. You don't need to install it manually.

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

## Automatic Setup

When the plugin loads for the first time, it runs an automatic setup sequence. No manual steps required.

The setup runs these steps in order:

1. **Detect** — checks if `claude-mem` is already installed (looks in PATH and `~/.claude-mem`)
2. **Install** — runs `npm install -g claude-mem` if not found; skipped if already installed
3. **Configure MCP** — adds the `claude-mem` MCP entry to `~/.config/opencode/opencode.json` if missing
4. **Copy skills** — copies the `mem-search` skill to `~/.config/opencode/skills/mem-search/` if missing
5. **Start worker** — starts the claude-mem worker process if not already running

All steps are idempotent — safe to run multiple times without side effects. All steps fail gracefully; if any step fails, the plugin continues loading and the remaining steps still run.

### What Gets Configured

| File | What changes |
|------|-------------|
| `~/.config/opencode/opencode.json` | MCP entry for `claude-mem` added under `mcp` key |
| `~/.config/opencode/skills/mem-search/` | Skill files copied from the plugin package |

## MCP Search Setup

MCP search is configured automatically by the plugin. If you prefer to configure it manually, add to your `opencode.json`:

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

The mem-search skill is copied automatically by the plugin. To install it manually:

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
- Check if the worker is already running on a different port
- Start the worker manually: `claude-mem start`
- If auto-setup failed to install claude-mem, install it manually: `npm install -g claude-mem`

**Auto-setup failed to install claude-mem:**
- Confirm npm is available: `npm --version`
- Check for permission issues with global npm installs; you may need to configure npm's prefix or use a version manager like nvm
- Install manually: `npm install -g claude-mem`, then restart opencode

**Auto-setup failed to configure MCP or copy skills:**
- Check that `~/.config/opencode/` exists and is writable
- Run the setup manually: copy the MCP config and skill files as shown in the sections above
- The plugin still works for memory injection even if MCP search setup fails

**Port conflict:**
- Check `~/.claude-mem/settings.json` for the configured port
- The plugin reads this file automatically

## License

MIT
