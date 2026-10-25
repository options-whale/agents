# Options Whale Agents

Developer tools for connecting AI agents to [Options Whale](https://www.options-whale.com)
earnings evidence.

The production surface is public, keyless, and read-only:

- MCP: `https://www.options-whale.com/api/mcp`
- Evidence API: `https://www.options-whale.com/api/research/evidence`
- Tool catalog: `https://www.options-whale.com/mcp-tools.json`
- Agent guide: `https://www.options-whale.com/llms.txt`

## Quick start

From this repository:

```sh
npm install
npm run build
npm test
npx options-whale-agents doctor
```

The doctor performs a real MCP handshake, discovers tools, prompts, and
resources, and verifies the expected read-only research surface.

Generate a client configuration:

```sh
npx options-whale-agents config --client cursor
npx options-whale-agents config --client vscode
npx options-whale-agents config --client muse
```

Configuration formats can change between client versions. Compare the generated
shape with the installed client's current MCP documentation.

## Library

```ts
import {
  fetchEvidence,
  openOptionsWhaleMcp,
} from "@options-whale/agents";

const evidence = await fetchEvidence({
  symbols: ["AAPL", "MSFT"],
});

const { client } = await openOptionsWhaleMcp();
const tools = await client.listTools();
await client.close();
```

Use `fetchMcpCatalog()` for schemas and `diagnoseOptionsWhaleMcp()` for a
structured readiness report.

## Cloudflare Agents

The [`examples/cloudflare-worker`](examples/cloudflare-worker) directory is a
deployable Cloudflare Workers project using the `agents` package. Its persistent
`OptionsWhaleAgent` adds Options Whale as an MCP server and exposes callable
research methods.

## Agent skill

[`skills/options-whale/SKILL.md`](skills/options-whale/SKILL.md) gives a
model-readable integration workflow and evidence rules. It is useful with agent
systems that support local skill files.

## Public capabilities

The current public MCP server exposes seven read-only tools:

- `earnings_calendar`
- `earnings_brief`
- `compare_earnings`
- `historical_earnings_moves`
- `earnings_iv`
- `earnings_term_structure`
- `strategy_risk`

It also provides three research prompts and a methodology resource. The server
uses published stored evidence; a tool call does not fetch live market data.

Do not treat missing values as zero, historical reconstructions as a live track
record, or returned evidence as a personalized trading recommendation. Preserve
source links, `asOf` dates, modeled labels, and coverage limitations.

## Development

```sh
npm run typecheck
npm test
npm run build
npm run check
```

The package requires Node.js 20 or newer. It has no private credential or
account dependency for the public surface.
