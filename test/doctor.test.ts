import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  REQUIRED_TOOLS,
  TOOLKIT_VERSION,
  assessCatalog,
  classifyResearchAccess,
} from "../src/index.js";

test("accepts the complete read-only catalog", () => {
  const checks = assessCatalog({
    tools: REQUIRED_TOOLS.map((name) => ({ name, readOnly: true })),
    prompts: [{ name: "one" }, { name: "two" }, { name: "three" }],
    resources: [{ uri: "options-whale://methodology" }],
  });
  assert.ok(checks.every((check) => check.ok));
});

test("reports missing and non-read-only tools", () => {
  const checks = assessCatalog({
    tools: [
      { name: "earnings_brief", readOnly: false },
      { name: "compare_earnings", readOnly: true },
    ],
    prompts: [],
    resources: [],
  });
  const failed = checks.filter((check) => !check.ok).map((check) => check.name);
  assert.deepEqual(failed, ["required-tools", "read-only", "agent-guidance"]);
});

test("classifies locked and available research payloads", () => {
  assert.equal(
    classifyResearchAccess({ locked: true, code: "research_locked" }),
    "locked",
  );
  assert.equal(classifyResearchAccess({ locked: true }), "locked");
  assert.equal(classifyResearchAccess({ ticker: "AAPL", event: {} }), "available");
  assert.equal(classifyResearchAccess(undefined), "unknown");
  assert.equal(classifyResearchAccess("not json"), "unknown");
});

test("toolkit version matches the package manifest", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  assert.equal(TOOLKIT_VERSION, manifest.version);
});
