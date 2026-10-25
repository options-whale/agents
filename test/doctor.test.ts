import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_TOOLS, assessCatalog } from "../src/index.js";

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
