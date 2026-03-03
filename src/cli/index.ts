#!/usr/bin/env node

import { parseArgs } from "./args.js";
import { runSetup } from "./runner.js";
import { TuiAdapter } from "./tui.js";
import { NonTuiAdapter } from "./non-tui.js";

const HELP_TEXT = `
opencode-claude-mem Installation Wizard

Usage:
  bun src/cli/index.ts [options]

Options:
  --help              Show this help message
  --no-tui            Disable interactive TUI output (use plain text)
  --port <number>     Specify worker port (default: 37777)
  --skip-worker       Skip worker startup during setup

Examples:
  bun src/cli/index.ts
  bun src/cli/index.ts --no-tui
  bun src/cli/index.ts --port 3000
  bun src/cli/index.ts --no-tui --skip-worker
`;

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  const adapter =
    !process.stdout.isTTY || options.noTui
      ? new NonTuiAdapter()
      : new TuiAdapter();

  const result = await runSetup(options, adapter);

  const anyFailed = Object.values(result).some((r) => r.status === "failed");
  process.exit(anyFailed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exit(1);
});
