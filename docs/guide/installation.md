# Installation Guide

## For Humans

Paste this URL into your LLM agent to get guided installation:

```
https://raw.githubusercontent.com/3wz/opencode-mem/main/docs/guide/installation.md
```

---

## For LLM Agents

You are an AI assistant helping install `@shuian/opencode-claude-mem`, a persistent memory plugin for OpenCode that connects to the same claude-mem worker as Claude Code.

### Step 0: Check Prerequisites

Ask the user: **"Do you already have claude-mem installed (e.g., from Claude Code)?"**

- **If yes**: The plugin will connect to the existing worker automatically. No reinstallation needed.
- **If no**: The plugin will install claude-mem automatically on first load.

### Step 1: Verify OpenCode Installation

Run:
```bash
command -v opencode && opencode --version
```

If OpenCode is not found, direct the user to [opencode.ai](https://opencode.ai).

### Step 2: Install the Plugin

Run:
```bash
npx @shuian/opencode-claude-mem install --no-tui
```

**Optional flags:**
- `--skip-worker` — Skip worker startup if you manage the worker separately
- `--port 37777` — Specify a custom worker port (default: 37777)

### Step 3: Add Plugin to opencode.json

If not already added by the install command, add this to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@shuian/opencode-claude-mem"]
}
```

### Step 4: Verify Setup

Run:
```bash
curl -s http://localhost:37777/health
```

Expected response: `{"status":"ok"}` or similar health indicator.

If the worker is not running, start it manually:
```bash
claude-mem start
```

### Step 5: Restart OpenCode and Test

Restart OpenCode. The plugin will:
- Configure MCP search tools automatically
- Copy the `mem-search` skill to `~/.config/opencode/skills/`
- Inject relevant memories into your system prompt

Test with:
```
/mem-status
/mem-search <your-query>
```

---

## CLI Flags Reference

| Flag | Description | Default |
|------|-------------|---------|
| `--no-tui` | Skip interactive terminal UI (recommended for automation) | false |
| `--port <number>` | Specify custom worker port | 37777 |
| `--skip-worker` | Skip worker startup (if you manage it separately) | false |

---

## Manual Installation

For detailed installation options and troubleshooting, see the [Quick Start](../../README.md#quick-start) and [Installation](../../README.md#installation) sections in the README.

### What Gets Configured

The plugin automatically configures:

- **MCP entry** in `~/.config/opencode/opencode.json` under `mcp.claude-mem`
- **4 slash commands** for memory operations (`/mem-search`, `/mem-save`, `/mem-status`, `/mem-timeline`)
- **mem-search skill** copied to `~/.config/opencode/skills/mem-search/`

All steps are **idempotent** (safe to run multiple times) and **independent** (if one fails, the rest still run).

---

## Memory Commands

Once installed, use these slash commands in OpenCode:

| Command | Description |
|---------|-------------|
| `/mem-search <query>` | Search persistent memory for past observations |
| `/mem-save <text>` | Save a manual memory entry |
| `/mem-status` | Show memory connection status |
| `/mem-timeline` | Show recent memory timeline |

---

## Troubleshooting

For detailed troubleshooting, configuration options, and architecture details, see the [Troubleshooting](../../README.md#troubleshooting) section in the README.

**Quick checks:**
- Worker running? `curl http://localhost:37777/health`
- OpenCode config writable? `ls -la ~/.config/opencode/`
- npm available? `npm --version`

---

## Next Steps

- **Search your memory**: Use `/mem-search` to query past sessions
- **Share context**: Memories from Claude Code appear automatically in OpenCode
- **Learn the workflow**: See [Search Tools](../../README.md#search-tools) for the 3-layer memory search pattern
