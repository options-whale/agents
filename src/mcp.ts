import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DEFAULT_OPTIONS_WHALE_ORIGIN,
  optionsWhaleEndpoints,
} from "./endpoints.js";

export const TOOLKIT_VERSION = "0.2.0";

export const REQUIRED_TOOLS = [
  "earnings_calendar",
  "earnings_brief",
  "compare_earnings",
  "historical_earnings_moves",
  "earnings_iv",
  "earnings_term_structure",
  "strategy_risk",
] as const;

export interface McpConnection {
  client: Client;
  transport: StreamableHTTPClientTransport;
  endpoint: string;
}

export interface OpenMcpOptions {
  origin?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface DoctorOptions extends OpenMcpOptions {
  /**
   * Call the public calendar and one research tool to report whether research
   * evidence is available to this caller. Defaults to true.
   */
  probeResearch?: boolean;
}

export interface CatalogSnapshot {
  tools: Array<{ name: string; readOnly: boolean }>;
  prompts: Array<{ name: string }>;
  resources: Array<{ uri: string }>;
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * `locked` is the expected state for anonymous callers: the MCP server
 * discovers the full research catalog but returns locked previews.
 */
export type ResearchAccess = "available" | "locked" | "unknown";

export interface DoctorReport {
  status: "ready" | "unhealthy";
  endpoint: string;
  latencyMs: number;
  server?: {
    name?: string;
    version?: string;
    protocolVersion?: string;
  };
  catalog?: CatalogSnapshot;
  checks: DoctorCheck[];
  researchAccess: ResearchAccess;
  researchNote?: string;
  calendarEvents?: number;
  error?: string;
}

interface ToolResultLike {
  structuredContent?: unknown;
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toolPayload(result: ToolResultLike): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = result.content?.find(
    (item) => item.type === "text" && typeof item.text === "string",
  )?.text;
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Classify a research tool result. The server returns
 * `{ locked: true, code: "research_locked" }` instead of evidence for
 * anonymous callers; anything else that parsed is treated as available.
 */
export function classifyResearchAccess(payload: unknown): ResearchAccess {
  if (!isRecord(payload)) return "unknown";
  if (payload.locked === true || payload.code === "research_locked") {
    return "locked";
  }
  return "available";
}

export function assessCatalog(catalog: CatalogSnapshot): DoctorCheck[] {
  const actual = new Map(catalog.tools.map((tool) => [tool.name, tool]));
  const missing = REQUIRED_TOOLS.filter((name) => !actual.has(name));
  const unsafe = catalog.tools
    .filter((tool) => !tool.readOnly)
    .map((tool) => tool.name);

  return [
    {
      name: "required-tools",
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `Found all ${REQUIRED_TOOLS.length} required research tools.`
          : `Missing tools: ${missing.join(", ")}.`,
    },
    {
      name: "read-only",
      ok: unsafe.length === 0,
      detail:
        unsafe.length === 0
          ? "Every discovered tool is marked read-only."
          : `Tools without a read-only annotation: ${unsafe.join(", ")}.`,
    },
    {
      name: "agent-guidance",
      ok: catalog.prompts.length >= 3 && catalog.resources.length >= 1,
      detail: `${catalog.prompts.length} prompts and ${catalog.resources.length} resource${
        catalog.resources.length === 1 ? "" : "s"
      } discovered.`,
    },
  ];
}

export async function openOptionsWhaleMcp(
  options: OpenMcpOptions = {},
): Promise<McpConnection> {
  const endpoint = optionsWhaleEndpoints(
    options.origin ?? DEFAULT_OPTIONS_WHALE_ORIGIN,
  ).mcp;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const baseFetch = globalThis.fetch;
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    // A fresh timeout per request: a connection-wide AbortSignal.timeout()
    // would abort every call made 20 seconds after the connection opened.
    fetch: (input, init) => {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const signal = init?.signal
        ? AbortSignal.any([init.signal, timeoutSignal])
        : timeoutSignal;
      return baseFetch(input, { ...init, signal });
    },
    requestInit: options.signal ? { signal: options.signal } : undefined,
  });
  const client = new Client(
    { name: "options-whale-agents", version: TOOLKIT_VERSION },
    { capabilities: {} },
  );

  await client.connect(transport);
  return { client, transport, endpoint };
}

export async function diagnoseOptionsWhaleMcp(
  options: DoctorOptions = {},
): Promise<DoctorReport> {
  const started = performance.now();
  let connection: McpConnection | undefined;
  const endpoint = optionsWhaleEndpoints(
    options.origin ?? DEFAULT_OPTIONS_WHALE_ORIGIN,
  ).mcp;

  try {
    connection = await openOptionsWhaleMcp(options);
    const [tools, prompts, resources] = await Promise.all([
      connection.client.listTools(),
      connection.client.listPrompts(),
      connection.client.listResources(),
    ]);
    const server = connection.client.getServerVersion();
    const catalog: CatalogSnapshot = {
      tools: tools.tools.map((tool) => ({
        name: tool.name,
        readOnly: tool.annotations?.readOnlyHint === true,
      })),
      prompts: prompts.prompts.map((prompt) => ({ name: prompt.name })),
      resources: resources.resources.map((resource) => ({
        uri: resource.uri,
      })),
    };
    const checks: DoctorCheck[] = [
      {
        name: "mcp-handshake",
        ok: true,
        detail: "Connected to the public Streamable HTTP endpoint.",
      },
      ...assessCatalog(catalog),
    ];

    let researchAccess: ResearchAccess = "unknown";
    let researchNote: string | undefined;
    let calendarEvents: number | undefined;

    if (options.probeResearch !== false) {
      let probeTicker: string | undefined;
      try {
        const calendarResult = (await connection.client.callTool({
          name: "earnings_calendar",
          arguments: {},
        })) as ToolResultLike;
        const calendar = toolPayload(calendarResult);
        const events =
          isRecord(calendar) && Array.isArray(calendar.events)
            ? calendar.events
            : undefined;
        if (events) {
          calendarEvents = events.length;
          checks.push({
            name: "public-calendar",
            ok: true,
            detail: `earnings_calendar returned ${events.length} event${
              events.length === 1 ? "" : "s"
            }.`,
          });
          const first = events[0];
          if (isRecord(first) && typeof first.ticker === "string") {
            probeTicker = first.ticker;
          }
        } else {
          checks.push({
            name: "public-calendar",
            ok: false,
            detail: "earnings_calendar did not return an events array.",
          });
        }
      } catch (error) {
        checks.push({
          name: "public-calendar",
          ok: false,
          detail: `earnings_calendar failed: ${errorMessage(error)}`,
        });
      }

      if (calendarEvents !== undefined) {
        const ticker = probeTicker ?? "AAPL";
        try {
          const briefResult = (await connection.client.callTool({
            name: "earnings_brief",
            arguments: { ticker },
          })) as ToolResultLike;
          const brief = toolPayload(briefResult);
          if (briefResult.isError) {
            researchNote = `earnings_brief returned an error for ${ticker}.`;
          } else {
            researchAccess = classifyResearchAccess(brief);
            if (researchAccess === "locked") {
              const note =
                isRecord(brief) && typeof brief.note === "string"
                  ? brief.note
                  : undefined;
              researchNote =
                note ??
                "Research tools return locked previews for anonymous callers.";
            }
          }
        } catch (error) {
          researchNote = `Research probe failed: ${errorMessage(error)}`;
        }
      }
    }

    return {
      status: checks.every((check) => check.ok) ? "ready" : "unhealthy",
      endpoint,
      latencyMs: Math.round(performance.now() - started),
      server: {
        name: server?.name,
        version: server?.version,
        protocolVersion: connection.transport.protocolVersion,
      },
      catalog,
      checks,
      researchAccess,
      researchNote,
      calendarEvents,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      endpoint,
      latencyMs: Math.round(performance.now() - started),
      checks: [
        {
          name: "mcp-handshake",
          ok: false,
          detail: errorMessage(error),
        },
      ],
      researchAccess: "unknown",
      error: errorMessage(error),
    };
  } finally {
    if (connection) await connection.client.close().catch(() => undefined);
  }
}
