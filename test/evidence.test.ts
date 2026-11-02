import assert from "node:assert/strict";
import test from "node:test";
import {
  OptionsWhaleLockedError,
  OptionsWhaleRequestError,
  buildEvidenceUrl,
  fetchEvidence,
  normalizeSymbols,
} from "../src/index.js";

test("normalizes and validates tickers", () => {
  assert.deepEqual(normalizeSymbols([" aapl ", "brk.b"]), ["AAPL", "BRK.B"]);
  assert.throws(() => normalizeSymbols(["AAPL", "MSFT", "NVDA", "AMD", "META"]));
  assert.throws(() => normalizeSymbols(["$AAPL"]));
  assert.throws(() => normalizeSymbols(["AAPL", "aapl"]), /unique/);
});

test("rejects date ranges longer than 35 inclusive days", () => {
  assert.doesNotThrow(() =>
    buildEvidenceUrl({ from: "2026-10-01", to: "2026-11-04" }),
  );
  assert.throws(
    () => buildEvidenceUrl({ from: "2026-10-01", to: "2026-11-05" }),
    /35 inclusive days/,
  );
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

test("raises OptionsWhaleLockedError for 401 research_locked", async () => {
  await assert.rejects(
    fetchEvidence({
      symbols: ["AAPL"],
      fetch: async () =>
        new Response(
          JSON.stringify({
            locked: true,
            code: "research_locked",
            note: "Full research requires a paid plan.",
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
    }),
    (error: unknown) => {
      assert.ok(error instanceof OptionsWhaleLockedError);
      assert.equal(error.status, 401);
      assert.match(error.message, /locked for anonymous callers/);
      assert.match(error.message, /Paid plan/i);
      return true;
    },
  );
});

test("keeps other HTTP errors generic", async () => {
  await assert.rejects(
    fetchEvidence({
      fetch: async () =>
        new Response(JSON.stringify({ error: "nope" }), { status: 401 }),
    }),
    (error: unknown) =>
      error instanceof OptionsWhaleRequestError &&
      !(error instanceof OptionsWhaleLockedError),
  );
});
