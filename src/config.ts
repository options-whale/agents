import {
  DEFAULT_OPTIONS_WHALE_ORIGIN,
  optionsWhaleEndpoints,
} from "./endpoints.js";

export type McpClientTarget = "generic" | "cursor" | "muse" | "vscode";

export interface McpServerEntry {
  type?: string;
  url: string;
}

export interface McpConfiguration {
  schema_version?: number;
  mcpServers?: Record<string, McpServerEntry>;
  servers?: Record<string, McpServerEntry>;
}

/**
 * Generate the configuration shape used by a supported client family.
 * Client applications can change their configuration schema, so the result
 * should be reviewed against the installed client's documentation.
 */
export function mcpConfiguration(
  target: McpClientTarget = "generic",
  origin = DEFAULT_OPTIONS_WHALE_ORIGIN,
): McpConfiguration {
  const { mcp } = optionsWhaleEndpoints(origin);

  if (target === "vscode") {
    return {
      servers: { "options-whale": { type: "http", url: mcp } },
    };
  }
  if (target === "cursor") {
    return { mcpServers: { "options-whale": { url: mcp } } };
  }
  if (target === "muse") {
    return {
      schema_version: 1,
      mcpServers: {
        "options-whale": { type: "streamable-http", url: mcp },
      },
    };
  }

  return {
    mcpServers: {
      "options-whale": { type: "streamable-http", url: mcp },
    },
  };
}

export function formatConfiguration(
  target: McpClientTarget = "generic",
  origin = DEFAULT_OPTIONS_WHALE_ORIGIN,
  compact = false,
): string {
  return JSON.stringify(
    mcpConfiguration(target, origin),
    null,
    compact ? 0 : 2,
  );
}
