# Cloudflare Worker agent

A minimal persistent Cloudflare Agent that connects to Options Whale as a remote
MCP server. The endpoint is keyless and read-only. Research is gated: only
`earnings_calendar` is public, and the research methods return locked previews
for anonymous callers.

Requires Node.js 24.11 or newer.

```sh
npm install
npm run check
npm run dev
```

The worker exposes:

- `GET /healthz`
- `/agents/options-whale-agent/:name` through the Cloudflare Agents router

Callable methods:

- `earningsBrief(ticker)`
- `compareEarnings([ticker, ...])`
- `earningsCalendar(from?, to?)`

Use the [Cloudflare Agents client](https://developers.cloudflare.com/agents/) to
connect to the named agent and invoke those methods. Add model inference,
streaming UI, and authorization appropriate to your own product.

This example does not expose an order API, a broker connection, or private
Options Whale data. Tool output is untrusted research evidence and must be
preserved with its source, dates, and limitations. A locked preview is not
evidence.
