export const DEFAULT_OPTIONS_WHALE_ORIGIN = "https://www.options-whale.com";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface OptionsWhaleEndpoints {
  origin: string;
  mcp: string;
  evidence: string;
  catalog: string;
  agentGuide: string;
}

/**
 * Normalize an Options Whale origin while preventing credentials, fragments,
 * query strings, and path prefixes from leaking into generated endpoints.
 */
export function resolveOptionsWhaleOrigin(
  input = DEFAULT_OPTIONS_WHALE_ORIGIN,
): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid Options Whale origin: ${input}`);
  }

  if (url.username || url.password) {
    throw new Error("Options Whale origins cannot contain credentials.");
  }
  if (url.search || url.hash) {
    throw new Error("Options Whale origins cannot contain a query or fragment.");
  }
  if (url.pathname !== "/") {
    throw new Error("Options Whale origins cannot contain a path prefix.");
  }
  if (url.protocol !== "https:") {
    const local =
      url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
    if (!local) {
      throw new Error(
        "Options Whale origins must use HTTPS; plain HTTP is allowed only for loopback development.",
      );
    }
  }

  return url.origin;
}

export function optionsWhaleEndpoints(
  origin = DEFAULT_OPTIONS_WHALE_ORIGIN,
): OptionsWhaleEndpoints {
  const normalizedOrigin = resolveOptionsWhaleOrigin(origin);
  return {
    origin: normalizedOrigin,
    mcp: `${normalizedOrigin}/api/mcp/v2`,
    evidence: `${normalizedOrigin}/api/research/evidence`,
    catalog: `${normalizedOrigin}/mcp-tools.json`,
    agentGuide: `${normalizedOrigin}/llms.txt`,
  };
}
