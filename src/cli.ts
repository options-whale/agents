#!/usr/bin/env node

import {
  fetchEvidence,
  fetchMcpCatalog,
  formatConfiguration,
  diagnoseOptionsWhaleMcp,
  type McpClientTarget,
} from "./index.js";

interface ParsedArgs {
  command: string;
  positionals: string[];
  flags: Map<string, string | true>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const [rawName, inlineValue] = arg.slice(2).split("=", 2);
    if (!rawName) continue;
    if (inlineValue !== undefined) {
      flags.set(rawName, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(rawName, next);
      index += 1;
    } else {
      flags.set(rawName, true);
    }
  }

  return {
    command: positionals.shift() ?? "help",
    positionals,
    flags,
  };
}

function flagString(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function hasFlag(args: ParsedArgs, name: string): boolean {
  return args.flags.has(name);
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function help(): void {
  process.stdout.write(`Options Whale agents

Usage:
  options-whale-agents doctor [--json] [--origin URL] [--timeout MS] [--no-probe]
  options-whale-agents config [--client generic|cursor|muse|vscode] [--origin URL] [--compact]
  options-whale-agents catalog [--json] [--origin URL]
  options-whale-agents evidence [SYMBOL ...] [--from YYYY-MM-DD --to YYYY-MM-DD] [--origin URL]

Examples:
  options-whale-agents doctor
  options-whale-agents config --client cursor
  options-whale-agents evidence AAPL MSFT

The MCP catalog and earnings calendar are public and read-only. Other research
tools currently return locked previews to anonymous callers, and the evidence
API returns HTTP 401 research_locked. No API key or account login is supported.
`);
}

function timeoutOption(args: ParsedArgs): number {
  const raw = flagString(args, "timeout");
  if (!raw) return 20_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 120_000) {
    throw new Error("--timeout must be an integer from 1000 to 120000.");
  }
  return value;
}

async function doctor(args: ParsedArgs): Promise<number> {
  const report = await diagnoseOptionsWhaleMcp({
    origin: flagString(args, "origin"),
    timeoutMs: timeoutOption(args),
    probeResearch: !hasFlag(args, "no-probe"),
  });

  if (hasFlag(args, "json")) {
    writeJson(report);
  } else {
    process.stdout.write("Options Whale MCP doctor\n\n");
    process.stdout.write(`Endpoint: ${report.endpoint}\n`);
    for (const check of report.checks) {
      process.stdout.write(
        `${check.ok ? "OK" : "FAIL"}  ${check.name}: ${check.detail}\n`,
      );
    }
    if (report.server?.name) {
      process.stdout.write(
        `Server: ${report.server.name} ${report.server.version ?? ""} (${report.server.protocolVersion ?? "protocol unknown"})\n`,
      );
    }
    if (report.researchAccess === "locked") {
      process.stdout.write(
        "Research: locked for anonymous callers (earnings_calendar is public)\n",
      );
    } else if (report.researchAccess === "available") {
      process.stdout.write("Research: available\n");
    } else {
      process.stdout.write(
        `Research: ${hasFlag(args, "no-probe") ? "not probed" : "unknown"}\n`,
      );
    }
    if (report.researchNote) {
      process.stdout.write(`Note: ${report.researchNote}\n`);
    }
    process.stdout.write(
      `Latency: ${report.latencyMs} ms\nResult: ${report.status}\n`,
    );
    if (report.status === "ready") {
      process.stdout.write(
        "\nNext: run `options-whale-agents config` or see examples/cloudflare-worker.\n",
      );
    }
  }

  return report.status === "ready" ? 0 : 1;
}

function config(args: ParsedArgs): number {
  const target = (flagString(args, "client") ?? "generic") as McpClientTarget;
  if (!["generic", "cursor", "muse", "vscode"].includes(target)) {
    throw new Error("--client must be generic, cursor, muse, or vscode.");
  }
  process.stdout.write(
    `${formatConfiguration(target, flagString(args, "origin"), hasFlag(args, "compact"))}\n`,
  );
  return 0;
}

async function catalog(args: ParsedArgs): Promise<number> {
  const result = await fetchMcpCatalog({
    origin: flagString(args, "origin"),
    timeoutMs: timeoutOption(args),
  });
  if (hasFlag(args, "json")) {
    writeJson(result);
  } else {
    process.stdout.write(
      [
        `Options Whale MCP ${result.serverVersion}`,
        `Endpoint: ${result.endpoint}`,
        `Tools (${result.tools.length}): ${result.tools.map((tool) => tool.name).join(", ")}`,
        `Prompts (${result.prompts.length}): ${result.prompts.map((prompt) => prompt.name).join(", ")}`,
      ].join("\n") + "\n",
    );
  }
  return 0;
}

async function evidence(args: ParsedArgs): Promise<number> {
  const result = await fetchEvidence({
    symbols: args.positionals,
    from: flagString(args, "from"),
    to: flagString(args, "to"),
    origin: flagString(args, "origin"),
    timeoutMs: timeoutOption(args),
  });
  writeJson(result);
  return 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let exitCode: number;

  switch (args.command) {
    case "doctor":
    case "onboard":
      exitCode = await doctor(args);
      break;
    case "config":
      exitCode = config(args);
      break;
    case "catalog":
      exitCode = await catalog(args);
      break;
    case "evidence":
      exitCode = await evidence(args);
      break;
    case "help":
    case "--help":
    case "-h":
      help();
      exitCode = 0;
      break;
    default:
      help();
      throw new Error(`Unknown command: ${args.command}`);
  }

  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
