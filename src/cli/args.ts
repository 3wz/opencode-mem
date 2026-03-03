import type { CliOptions } from "./types.js";

const DEFAULT_PORT = 37777;
const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * Parse command-line arguments into CliOptions
 * @param argv - Array of command-line arguments (e.g., process.argv.slice(2))
 * @returns Parsed CLI options with defaults
 */
export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    noTui: false,
    port: DEFAULT_PORT,
    skipWorker: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help") {
      options.help = true;
    } else if (arg === "--no-tui") {
      options.noTui = true;
    } else if (arg === "--skip-worker") {
      options.skipWorker = true;
    } else if (arg === "--port") {
      // Get the next argument as the port value
      const nextArg = argv[i + 1];
      if (nextArg !== undefined) {
        const portNum = Number.parseInt(nextArg, 10);
        // Validate port is a valid number in range [1, 65535]
        if (!Number.isNaN(portNum) && portNum >= MIN_PORT && portNum <= MAX_PORT) {
          options.port = portNum;
        }
        // If invalid, keep default port (37777)
        i++; // Skip the next argument since we consumed it
      }
    }
    // Unknown flags are silently ignored
  }

  return options;
}
