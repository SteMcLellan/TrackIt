---
name: tickets-tooling
description: TrackIt ticket tooling helper. Use when asked how to validate/sync/summarize multi-agent tickets, update the derived active ticket index (active-tickets.yaml/md), or work with the in-repo script tools/tickets.mjs.
---

# TrackIt Ticket Tooling (`tools/tickets.mjs`)

## Commands

From the repo root:

- Validate tickets: `node tools/tickets.mjs validate`
  - Validates required metadata (frontmatter when present; otherwise parses legacy templates with warnings).
  - Enforces "one active ticket per agent" by choosing the best candidate if multiple exist and emitting a warning.

- Sync derived active index: `node tools/tickets.mjs sync-active`
  - Writes/overwrites `..\\TrackIt.wt\\agents\\active-tickets.yaml` and `..\\TrackIt.wt\\agents\\active-tickets.md`.
  - Effective status uses `progress.status` when a progress file exists, except coordinator terminal states win:
    - If `spec.status` is `done` or `blocked`, that wins (ticket is not active) even if progress is stale.

- Summarize a ticket: `node tools/tickets.mjs summary <ticketId>`
  - Prints a compact summary (assignee, effective status, updatedUtc, and branch/commit/verification when present).

## Agents Directory Resolution

The script discovers the agents folder in this order:
1) `TRACKIT_AGENTS_DIR` env var (absolute or relative to repo root)
2) `../agents`
3) `../TrackIt.wt/agents`

If discovery fails, set `TRACKIT_AGENTS_DIR` explicitly and retry.
