import {
  DEFAULT_OPTIONS_WHALE_ORIGIN,
  optionsWhaleEndpoints,
} from "./endpoints.js";

const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,14}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface EvidenceQuery {
  symbols?: readonly string[];
  from?: string;
  to?: string;
}

export interface EvidenceResponse {
  schema?: string;
  generatedAt?: string;
  marketDate?: string;
  query?: unknown;
  events?: unknown;
  truncated?: boolean;
  companies?: unknown;
  limitations?: unknown;
  [key: string]: unknown;
}

export interface FetchEvidenceOptions extends EvidenceQuery {
  origin?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export interface McpCatalog {
  schema: string;
  transport: string;
  endpoint: string;
  serverVersion: string;
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
    annotations?: Record<string, unknown>;
  }>;
  prompts: Array<{
    name: string;
    description?: string;
  }>;
  resources: Array<{
    name: string;
    uri: string;
    description?: string;
    mimeType?: string;
  }>;
}

export class OptionsWhaleRequestError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "OptionsWhaleRequestError";
    this.status = status;
    this.url = url;
  }
}

export function normalizeSymbols(symbols: readonly string[]): string[] {
  if (symbols.length > 4) {
    throw new Error("The public API accepts at most four symbols.");
  }
  return symbols.map((value) => {
    const symbol = value.trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol)) {
      throw new Error(
        `Invalid ticker "${value}". Use 1–15 letters, digits, dots, or hyphens, starting with a letter.`,
      );
    }
    return symbol;
  });
}

function validDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function buildEvidenceUrl(
  query: EvidenceQuery = {},
  origin = DEFAULT_OPTIONS_WHALE_ORIGIN,
): string {
  const symbols = normalizeSymbols(query.symbols ?? []);
  if ((query.from && !query.to) || (!query.from && query.to)) {
    throw new Error("Evidence date ranges require both from and to.");
  }
  if (query.from && query.to) {
    if (!validDate(query.from) || !validDate(query.to)) {
      throw new Error("Evidence dates must be valid YYYY-MM-DD dates.");
    }
    if (query.from > query.to) {
      throw new Error("Evidence from must be on or before to.");
    }
  }

  const url = new URL(optionsWhaleEndpoints(origin).evidence);
  if (symbols.length) url.searchParams.set("symbols", symbols.join(","));
  if (query.from) url.searchParams.set("from", query.from);
  if (query.to) url.searchParams.set("to", query.to);
  return url.toString();
}

async function readJsonResponse<T>(response: Response, url: string): Promise<T> {
  const body = await response.text();
  if (!response.ok) {
    let detail = body.slice(0, 300).trim();
    try {
      const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
      const message = parsed.error ?? parsed.message;
      if (typeof message === "string") detail = message;
    } catch {
      // Keep the bounded text response.
    }
    throw new OptionsWhaleRequestError(
      `Options Whale returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      response.status,
      url,
    );
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new OptionsWhaleRequestError(
      "Options Whale returned a non-JSON response.",
      response.status,
      url,
    );
  }
}

export async function fetchEvidence(
  options: FetchEvidenceOptions = {},
): Promise<EvidenceResponse> {
  const url = buildEvidenceUrl(options, options.origin);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
  });
  return readJsonResponse<EvidenceResponse>(response, url);
}

export async function fetchMcpCatalog(options: {
  origin?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
} = {}): Promise<McpCatalog> {
  const url = optionsWhaleEndpoints(options.origin).catalog;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
  });
  const catalog = await readJsonResponse<McpCatalog>(response, url);
  if (
    catalog.schema !== "options-whale-mcp-catalog/1" ||
    !Array.isArray(catalog.tools) ||
    !Array.isArray(catalog.prompts) ||
    !Array.isArray(catalog.resources)
  ) {
    throw new Error(
      "Options Whale returned an unsupported MCP catalog schema.",
    );
  }
  return catalog;
}
