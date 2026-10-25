import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvidenceUrl,
  fetchEvidence,
  normalizeSymbols,
} from "../src/index.js";

test("normalizes and validates tickers", () => {
  assert.deepEqual(normalizeSymbols([" aapl ", "brk.b"]), ["AAPL", "BRK.B"]);
  assert.throws(() => normalizeSymbols(["AAPL", "MSFT", "NVDA", "AMD", "META"]));
  assert.throws(() => normalizeSymbols(["$AAPL"]));
});

test("builds a bounded evidence request", () => {
  const url = new URL(
    buildEvidenceUrl({
      symbols: ["aapl", "msft"],
      from: "2026-10-25",
      to: "2026-10-31",
    }),
  );
  assert.equal(url.pathname, "/api/research/evidence");
  assert.equal(url.searchParams.get("symbols"), "AAPL,MSFT");
  assert.equal(url.searchParams.get("from"), "2026-10-25");
  assert.throws(
    () => buildEvidenceUrl({ from: "2026-10-25" }),
    /require both from and to/,
  );
  assert.throws(
    () =>
      buildEvidenceUrl({
        from: "2026-10-31",
        to: "2026-10-25",
      }),
    /on or before/,
  );
});

test("surfaces bounded HTTP errors", async () => {
  await assert.rejects(
    fetchEvidence({
      fetch: async () =>
        new Response(JSON.stringify({ error: "rate limited" }), {
          status: 429,
        }),
    }),
    /HTTP 429: rate limited/,
  );
});
