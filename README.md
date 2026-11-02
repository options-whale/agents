# Options Whale Agents

Developer tools for connecting AI agents to [Options Whale](https://www.options-whale.com)
earnings evidence.

[![CI](https://github.com/options-whale/agents/actions/workflows/ci.yml/badge.svg)](https://github.com/options-whale/agents/actions/workflows/ci.yml)

The hosted surface is public, keyless, and read-only, but research is gated:

- **Public:** `earnings_calendar`, MCP discovery (seven tools, three prompts, one
  methodology resource), and the tool catalog.
- **Locked previews:** every other MCP research tool returns
  `{"locked": true, "code": "research_locked", ...}` to anonymous callers. Full
  research requires a paid Research account for a ticker inside T-28 to T-1;
  MCP does not currently support authentication.
- **Evidence REST API:** anonymous requests return HTTP 401 `research_locked`.

This is a product decision recorded in the
[MCP changelog](https://www.options-whale.com/mcp-changelog.json) (v0.2.0,
effective 2026-10-31), not an outage.

## Endpoints

- MCP: `https://www.options-whale.com/api/mcp/v2` (the unversioned URL redirects here)
- Evidence API: `https://www.options-whale.com/api/research/evidence`
- Tool catalog: `https://www.options-whale.com/mcp-tools.json`
- Agent guide: `https://www.options-whale.com/llms.txt`

## Quick start

From this repository:

```sh
npm install
npm run build
npm run doctor
```

The doctor performs a real MCP handshake, discovers tools, prompts, and
resources, and probes the public calendar and one research tool. It reports both
catalog health and whether research evidence is available to the caller:

```text
OK  mcp-handshake: Connected to the public Streamable HTTP endpoint.
OK  required-tools: Found all 7 required research tools.
OK  read-only: Every discovered tool is marked read-only.
OK  agent-guidance: 3 prompts and 1 resource discovered.
OK  public-calendar: earnings_calendar returned 100 events.
Research: locked for anonymous callers (earnings_calendar is public)
Result: ready
```

`Result: ready` means the endpoint and catalog are healthy. Locked research is
the expected state for anonymous callers, so it does not fail the check. Use
`--no-probe` to skip the two tool calls, or `--json` for a machine-readable
report.

Generate a client configuration:

```sh
node dist/cli.js config --client cursor
node dist/cli.js config --client vscode
node dist/cli.js config --client muse
```

Configuration formats can change between client versions. Compare the generated
shape with the installed client's current MCP documentation. On a checkout,
`npx options-whale-agents <command>` resolves the local binary after a build.

## Library

```ts
import {
  OptionsWhaleLockedError,
  fetchEvidence,
  openOptionsWhaleMcp,
} from "@options-whale/agents";

try {
  const evidence = await fetchEvidence({ symbols: ["AAPL", "MSFT"] });
  console.log(evidence);
} catch (error) {
  if (error instanceof OptionsWhaleLockedError) {
    // Expected for anonymous callers until account authentication exists.
  } else {
    throw error;
  }
}

const { client } = await openOptionsWhaleMcp();
const tools = await client.listTools();
await client.close();
```

Use `fetchMcpCatalog()` for schemas and `diagnoseOptionsWhaleMcp()` for a
structured readiness report (`status`, `checks`, `researchAccess`).

## Cloudflare Agents

The [`examples/cloudflare-worker`](examples/cloudflare-worker) directory is a
deployable Cloudflare Workers project using the `agents` package. Its persistent
`OptionsWhaleAgent` adds Options Whale as an MCP server and exposes callable
methods. Research methods return locked previews for anonymous callers today.

## Agent skill

[`skills/options-whale/SKILL.md`](skills/options-whale/SKILL.md) gives a
model-readable integration workflow and evidence rules. It is useful with agent
systems that support local skill files.

## Public capabilities

The MCP server exposes seven read-only tools:

- `earnings_calendar` — public
- `earnings_brief`
- `compare_earnings`
- `historical_earnings_moves`
- `earnings_iv`
- `earnings_term_structure`
- `strategy_risk`

It also provides three research prompts and a methodology resource. The server
uses published stored evidence; a tool call does not fetch live market data.

A research tool that returns `locked: true` has not returned evidence. Do not
infer, backfill, or present the locked preview as a result. Otherwise: do not
treat missing values as zero, historical reconstructions as a live track record,
or returned evidence as a personalized trading recommendation. Preserve source
links, `asOf` dates, modeled labels, and coverage limitations.

## Development

```sh
npm run typecheck
npm test
npm run build
npm run check
```

The package requires Node.js 20 or newer. The public surface needs no private
credential or account.
