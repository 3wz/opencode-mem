<h1 align="center">
  opencode-claude-mem
</h1>

<h4 align="center">Persistent memory for <a href="https://opencode.ai" target="_blank">OpenCode</a>, powered by <a href="https://github.com/thedotmack/claude-mem" target="_blank">claude-mem</a>.</h4>

<p align="center">
  <a href="package.json">
    <img src="https://img.shields.io/badge/version-0.1.0-green.svg" alt="Version">
  </a>
  <a href="https://github.com/thedotmack/claude-mem">
    <img src="https://img.shields.io/badge/powered%20by-claude--mem-blue.svg" alt="Powered by claude-mem">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="License">
  </a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#automatic-setup">Automatic Setup</a> &bull;
  <a href="#search-tools">Search Tools</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#troubleshooting">Troubleshooting</a>
</p>

<p align="center">
  Share persistent memory between Claude Code and OpenCode. This plugin connects to the same claude-mem worker, database, and memory store — context from Claude Code sessions appears in OpenCode, and vice versa. Install the plugin, and everything else happens automatically.
</p>

> **Note:** This project is not affiliated with the OpenCode team.

---

## Quick Start

Add one line to your `opencode.json`:

```json
{
  "plugin": ["@bloodf/opencode-claude-mem"]
}
```

Restart OpenCode. That's it.

The plugin automatically installs claude-mem, starts the worker, configures MCP search tools, and copies the mem-search skill. Context from previous sessions will appear in new sessions.

---

## Key Features

- **Shared Memory** — Same worker, database, and memory as Claude Code. Work in either tool seamlessly.
- **Automatic Setup** — Zero manual configuration. The plugin installs and configures everything on first load.
- **Context Injection** — Relevant memories are appended to the system prompt every session.
- **MCP Search** — Query your project history with the 3-layer search workflow (search, timeline, get_observations).
- **Graceful Degradation** — If the worker is unavailable, the plugin loads without errors. Memory features activate when the worker starts.
- **Fire-and-Forget** — All memory operations (save, capture, summarize) are non-blocking. The plugin never slows down your session.

---

## How It Works

```
opencode session
    |
    |-- plugin loads
    |   |-- detect claude-mem
    |   |-- auto-setup if needed (fire-and-forget)
    |   '-- connect to worker on port 37777
    |
    |-- session.created .............. initSession
    |-- chat.message ................. capturePrompt
    |-- tool.execute.after ........... saveObservation
    |-- system.transform ............. injectContext (memory -> system prompt)
    |-- session.compacting ........... injectCompactionContext
    |-- session.idle ................. sendSummary
    '-- session.deleted .............. completeSession
```

The plugin maps OpenCode lifecycle events to claude-mem hooks. Observations and prompts are captured during your session, summaries are generated at idle, and relevant context is injected into every new session automatically.

**Shared infrastructure:**

| Component | Path |
|-----------|------|
| Worker | `http://localhost:37777` |
| Database | `~/.claude-mem/claude-mem.db` |
| Settings | `~/.claude-mem/settings.json` |
| Web Viewer | `http://localhost:37777` |

Both Claude Code and OpenCode connect to the same worker and database. Memories are shared across tools.

---

## Automatic Setup

When the plugin loads for the first time, it runs a 5-step setup sequence. No manual intervention required.

| Step | What happens | When skipped |
|------|-------------|-------------|
| **Detect** | Checks if `claude-mem` is in PATH or `~/.claude-mem` exists | -- |
| **Install** | Runs `npm install -g claude-mem` | Already installed |
| **Configure MCP** | Adds `claude-mem` entry to `~/.config/opencode/opencode.json` | Entry already exists |
| **Copy Skills** | Copies `mem-search` skill to `~/.config/opencode/skills/` | Skill directory already exists |
| **Start Worker** | Launches the claude-mem worker process | Worker already running |

All steps are **idempotent** (safe to run multiple times) and **independent** (if one fails, the rest still run). Setup runs in the background and never blocks plugin initialization.

### What Gets Configured

| File | Change |
|------|--------|
| `~/.config/opencode/opencode.json` | MCP entry added under `mcp.claude-mem` |
| `~/.config/opencode/skills/mem-search/` | Skill files copied from plugin package |

---

## Installation

### npm (recommended)

```bash
npm install @bloodf/opencode-claude-mem
```

Then in `opencode.json`:

```json
{
  "plugin": ["@bloodf/opencode-claude-mem"]
}
```

### Local path

```json
{
  "plugin": ["./node_modules/@bloodf/opencode-claude-mem"]
}
```

### Copy to plugins directory

```bash
cp -r node_modules/@bloodf/opencode-claude-mem .opencode/plugins/opencode-claude-mem
```

### Prerequisites

- [OpenCode](https://opencode.ai) installed
- npm available in PATH

claude-mem is installed automatically on first plugin load. If you already have claude-mem installed via Claude Code, the plugin connects to the existing worker and database — no reinstallation needed.

---

## Search Tools

The plugin configures MCP search tools automatically. These tools follow a **3-layer workflow** that saves ~10x tokens by filtering before fetching full details.

### The 3-Layer Workflow

```
Step 1: search(query)           ~50-100 tokens/result
          |
Step 2: timeline(anchor=ID)     ~200-500 tokens/result
          |
Step 3: get_observations([IDs]) full content
```

### Available MCP Tools

| Tool | Purpose | Key Params |
|------|---------|-----------|
| `search` | Search memory index | `query`, `limit`, `project`, `type`, `dateStart`, `dateEnd` |
| `timeline` | Get context around a result | `anchor` (ID) or `query`, `depth_before`, `depth_after` |
| `get_observations` | Fetch full details by IDs | `ids` (array, required) |
| `save_memory` | Save a manual observation | `text` (required), `title`, `project` |

### Example

```
1. search(query="authentication bug", limit=10)
2. timeline(anchor=42, depth_before=3, depth_after=3)
3. get_observations(ids=[42, 43])
```

### Manual MCP Configuration

MCP is configured automatically. If you need to set it up manually:

```json
{
  "mcp": {
    "claude-mem": {
      "type": "remote",
      "url": "http://localhost:37777/mcp",
      "enabled": true
    }
  }
}
```

### Manual Skill Setup

The mem-search skill is copied automatically. To install manually:

```bash
cp -r node_modules/@bloodf/opencode-claude-mem/skills/mem-search ~/.config/opencode/skills/
```

---

## Configuration

The plugin auto-detects settings from `~/.claude-mem/settings.json`. No configuration required.

| Setting | Source | Default |
|---------|--------|---------|
| Worker port | `~/.claude-mem/settings.json` | `37777` |
| Data directory | `~/.claude-mem/` | auto |
| Database | `~/.claude-mem/claude-mem.db` | auto |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_MEM_DATA_DIR` | Override the data directory path (useful for testing) |

---

## Troubleshooting

**Plugin loads but no memory appears**
- Verify the worker is running: `curl http://localhost:37777/health`
- Check that claude-mem has been used with Claude Code to build up memory
- If this is a fresh install, memories will start appearing after your first session

**Worker not starting**
- Check if the worker is already running on a different port
- Start manually: `claude-mem start`
- If auto-setup failed: `npm install -g claude-mem`, then restart OpenCode

**Auto-setup failed to install claude-mem**
- Confirm npm is available: `npm --version`
- Check for permission issues with global installs — use a version manager like nvm or configure npm's prefix
- Install manually: `npm install -g claude-mem`

**Auto-setup failed to configure MCP or skills**
- Check that `~/.config/opencode/` exists and is writable
- Configure manually using the instructions in [Manual MCP Configuration](#manual-mcp-configuration) and [Manual Skill Setup](#manual-skill-setup)
- The plugin still works for memory injection even if MCP search setup fails

**Port conflict**
- Check `~/.claude-mem/settings.json` for the configured port
- The plugin reads this file automatically

**Sharing memory between Claude Code and OpenCode**
- Both tools must point to the same worker (default: port 37777)
- If Claude Code is already running claude-mem, OpenCode connects to the same worker automatically
- Memories are shared via the SQLite database at `~/.claude-mem/claude-mem.db`

---

## Architecture

```
                    opencode-claude-mem
                           |
                    OpenCode Plugin API
                           |
              +------------+------------+
              |                         |
         Auto-Setup               Event Hooks
         (first load)            (every session)
              |                         |
    +---------+---------+     +---------+---------+
    | detect binary     |     | initSession       |
    | install npm       |     | capturePrompt     |
    | configure MCP     |     | saveObservation   |
    | copy skills       |     | injectContext     |
    | start worker      |     | sendSummary       |
    +-------------------+     | completeSession   |
                              +-------------------+
                                        |
                                claude-mem worker
                                  (port 37777)
                                        |
                              +-------------------+
                              | SQLite database   |
                              | ~/.claude-mem/    |
                              | claude-mem.db     |
                              +-------------------+
```

---

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bunx tsc --noEmit
```

---

## License

MIT

---

<p align="center">
  <strong>Powered by <a href="https://github.com/thedotmack/claude-mem">claude-mem</a></strong> &bull; <strong>Built for <a href="https://opencode.ai">OpenCode</a></strong> &bull; <strong>Made with TypeScript</strong>
</p>

<!-- OMO_INTERNAL_INITIATOR -->