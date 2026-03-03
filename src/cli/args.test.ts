import { describe, it, expect } from "bun:test";
import { parseArgs } from "./args.js";

describe("parseArgs", () => {
  it("returns defaults when no args provided", () => {
    expect(parseArgs([])).toEqual({
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    });
  });

  it("parses --help flag", () => {
    expect(parseArgs(["--help"])).toEqual({
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: true,
    });
  });

  it("parses --no-tui flag", () => {
    expect(parseArgs(["--no-tui"])).toEqual({
      noTui: true,
      port: 37777,
      skipWorker: false,
      help: false,
    });
  });

  it("parses --port with valid number", () => {
    expect(parseArgs(["--port", "3000"])).toEqual({
      noTui: false,
      port: 3000,
      skipWorker: false,
      help: false,
    });
  });

  it("falls back to default port when --port value is invalid", () => {
    expect(parseArgs(["--port", "invalid"])).toEqual({
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    });
  });

  it("falls back to default port when --port value is out of range (too low)", () => {
    expect(parseArgs(["--port", "0"])).toEqual({
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    });
  });

  it("falls back to default port when --port value is out of range (too high)", () => {
    expect(parseArgs(["--port", "65536"])).toEqual({
      noTui: false,
      port: 37777,
      skipWorker: false,
      help: false,
    });
  });

  it("parses --skip-worker flag", () => {
    expect(parseArgs(["--skip-worker"])).toEqual({
      noTui: false,
      port: 37777,
      skipWorker: true,
      help: false,
    });
  });

  it("parses combined flags", () => {
    expect(parseArgs(["--no-tui", "--port", "8080", "--skip-worker"])).toEqual({
      noTui: true,
      port: 8080,
      skipWorker: true,
      help: false,
    });
  });

  it("parses combined flags with --help", () => {
    expect(parseArgs(["--help", "--no-tui", "--port", "5000"])).toEqual({
      noTui: true,
      port: 5000,
      skipWorker: false,
      help: true,
    });
  });

  it("ignores unknown flags", () => {
    expect(parseArgs(["--unknown", "--no-tui"])).toEqual({
      noTui: true,
      port: 37777,
      skipWorker: false,
      help: false,
    });
  });

  it("handles --port at boundary (1)", () => {
    expect(parseArgs(["--port", "1"])).toEqual({
      noTui: false,
      port: 1,
      skipWorker: false,
      help: false,
    });
  });

  it("handles --port at boundary (65535)", () => {
    expect(parseArgs(["--port", "65535"])).toEqual({
      noTui: false,
      port: 65535,
      skipWorker: false,
      help: false,
    });
  });
});
