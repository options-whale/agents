import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DEFAULT_OPTIONS_WHALE_ORIGIN,
  optionsWhaleEndpoints,
} from "./endpoints.js";

export const TOOLKIT_VERSION = "0.1.0";

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
  error?: string;
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
  const signal =
    options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 20_000);
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { signal },
  });
  const client = new Client(
    { name: "options-whale-agents", version: TOOLKIT_VERSION },
    { capabilities: {} },
  );

  await client.connect(transport);
  return { client, transport, endpoint };
}

export async function diagnoseOptionsWhaleMcp(
  options: OpenMcpOptions = {},
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
    const checks = [
      {
        name: "mcp-handshake",
        ok: true,
        detail: "Connected to the public Streamable HTTP endpoint.",
      },
      ...assessCatalog(catalog),
    ];

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
          detail: error instanceof Error ? error.message : String(error),
        },
      ],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (connection) await connection.client.close().catch(() => undefined);
  }
}
