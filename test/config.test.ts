import assert from "node:assert/strict";
import test from "node:test";
import {
  formatConfiguration,
  mcpConfiguration,
  optionsWhaleEndpoints,
  resolveOptionsWhaleOrigin,
} from "../src/index.js";

test("builds production endpoints", () => {
  assert.deepEqual(optionsWhaleEndpoints(), {
    origin: "https://www.options-whale.com",
    mcp: "https://www.options-whale.com/api/mcp/v2",
    evidence: "https://www.options-whale.com/api/research/evidence",
    catalog: "https://www.options-whale.com/mcp-tools.json",
    agentGuide: "https://www.options-whale.com/llms.txt",
  });
});

test("allows loopback only for local HTTP development", () => {
  assert.equal(
    resolveOptionsWhaleOrigin("http://127.0.0.1:3100"),
    "http://127.0.0.1:3100",
  );
  assert.throws(
    () => resolveOptionsWhaleOrigin("http://example.com"),
    /must use HTTPS/,
  );
  assert.throws(
    () => resolveOptionsWhaleOrigin("https://user:pass@example.com"),
    /credentials/,
  );
});

test("generates generic and VS Code configuration", () => {
  assert.deepEqual(mcpConfiguration("generic"), {
    mcpServers: {
      "options-whale": {
        type: "streamable-http",
        url: "https://www.options-whale.com/api/mcp/v2",
      },
    },
  });
  assert.ok("servers" in mcpConfiguration("vscode"));
  assert.equal(
    mcpConfiguration("vscode").servers?.["options-whale"]?.type,
    "http",
  );
  assert.match(formatConfiguration("cursor"), /"mcpServers"/);
  assert.equal(mcpConfiguration("muse").schema_version, 1);
  assert.equal(
    mcpConfiguration("muse").mcpServers?.["options-whale"]?.type,
    "streamable-http",
  );
});
