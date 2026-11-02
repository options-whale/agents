# Changelog

## 0.2.0 — 2026-11-02

Align the toolkit with the gated public surface deployed on 2026-10-31.

- Point the MCP client and generated client configurations at
  `/api/mcp/v2`. The unversioned URL now redirects there.
- Report research access from `doctor`: probe `earnings_calendar` (public) and
  `earnings_brief`, then print `researchAccess` as `locked`, `available`, or
  `unknown`. A locked research surface does not fail the health check.
- Add `OptionsWhaleLockedError` for HTTP 401 `research_locked` responses from
  the evidence API instead of a generic request error.
- Enforce the documented evidence limits: at most four unique symbols and at
  most 35 inclusive days per request.
- Use a fresh request timeout for each MCP call. A connection-wide timeout
  aborted every request made 20 seconds after the connection opened.
- Update README, AGENTS.md, the agent skill, and the Cloudflare example to state
  that only the earnings calendar is public and that research tools return
  locked previews to anonymous callers.

## 0.1.0 — 2026-10-25

Initial public toolkit: MCP client, doctor, configuration generator, evidence
client, agent skill, and Cloudflare Workers example.
