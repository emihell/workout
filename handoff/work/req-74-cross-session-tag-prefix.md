# req-74 — Cross-session messages tag `from [PLANNER]` / `from [BUILDER]`

**Status: SHIPPED 2026-09-14** — planning-owned, published to `main`. req-68 refinement (Emilio).

## Why

req-68 gave each session a first-line tag so Emilio can tell the two terminals apart. But an
*incoming* cross-session message showed the sender's bare tag — e.g. Builder's window displaying
`[PLANNER]` at the top of a message — which reads as if that window *is* the Planner. Emilio flagged
the confusion. The tag must distinguish "this window is X" from "this is a message from X."

## Scope

Refine the convention in the three req-68 docs (`PLANNING.md`, `CLAUDE.md`, `handoff/README.md`):

- A session's **own** messages, in its own terminal (to Emilio), start with its bare tag on the first
  line: `[PLANNER]` / `[BUILDER]` — "which window this is."
- A **cross-session** message (a `SendMessage` to the other session) starts with **`from [PLANNER]`** /
  **`from [BUILDER]`** — so in the receiving window it reads as clearly *incoming from* the sender, not
  as a relabel of that window.

## Out of scope

- Renaming the handles; any non-tagging change. Ephemeral agents still don't tag (req-68).

## Acceptance

- PLANNING.md and CLAUDE.md each state both forms (own-window bare tag; cross-session `from […]`).
- `handoff/README.md` "The two sessions" reflects it.
- `check_handoff` passes.
