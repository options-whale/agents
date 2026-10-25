import { Agent, callable, routeAgentRequest } from "agents";

const SERVER_ID = "options-whale";
const SERVER_URL = "https://www.options-whale.com/api/mcp";
const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,14}$/;

function ticker(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!TICKER_PATTERN.test(normalized)) {
    throw new Error("Invalid ticker.");
  }
  return normalized;
}

/**
 * A persistent Cloudflare Agent that uses Options Whale as a read-only MCP
 * source. Add model inference and product-specific tool selection around these
 * methods; this example deliberately does not place trades.
 */
export class OptionsWhaleAgent extends Agent {
  async onStart(): Promise<void> {
    const result = await this.addMcpServer("Options Whale", SERVER_URL, {
      id: SERVER_ID,
    });
    if (result.state === "authenticating") {
      throw new Error("The public Options Whale MCP endpoint requires no authentication.");
    }
  }

  private async callResearchTool(
    name: string,
    args: Record<string, unknown>,
  ) {
    return this.mcp.callTool({
      serverId: SERVER_ID,
      name,
      arguments: args,
    });
  }

  @callable()
  async earningsBrief(symbol: string) {
    return this.callResearchTool("earnings_brief", {
      ticker: ticker(symbol),
    });
  }

  @callable()
  async compareEarnings(symbols: string[]) {
    if (symbols.length < 2 || symbols.length > 4) {
      throw new Error("Provide two to four tickers.");
    }
    return this.callResearchTool("compare_earnings", {
      symbols: symbols.map(ticker),
    });
  }

  @callable()
  async earningsCalendar(from?: string, to?: string) {
    return this.callResearchTool("earnings_calendar", {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return Response.json({
        ok: true,
        service: "options-whale-research-agent",
        mcp: SERVER_URL,
        readOnly: true,
      });
    }
    return (
      (await routeAgentRequest(request, env, { cors: true })) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
