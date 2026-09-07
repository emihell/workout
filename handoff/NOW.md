# Now

Updated 2026-09-07 (req-02 READY). Keep under 50 lines; **what is done lives in
`log/SHIPPED.md`**. Full req list: `work/req-*.md`; the phased plan: `work/BACKLOG.md`.

## Milestone — in Emilio's words (2026-09-07)

> Make the **in-gym usage flow flawless** first. Then the **program-creation flow**
> (the hard one). Only then the heavy build. Nothing heavy before the flow is flawless.

```
Phase 1  in-gym flow flawless    ← now (browser-only, UX hardening)
Phase 2  program-creation flow   ← next
Phase 3  database + users, own exercise DB, animations, AI, full styling
```

## Next — READY (only READY goes to CC)

`req-01` **guard `saveState`** — the persist path can throw (quota / Safari private
mode) and lose data silently; the floor under a "flawless" flow. Fix + persistent
banner (DEC-001) + failure-case tests. Spec: `work/req-01-guard-savestate.md`.
**Ready to build in Claude Code.**

`req-02` **carry kg + reps across sets for a no-history exercise** — type it in set 1, it
follows the rest (DEC-002). Phase-1, independent of `req-01`. Spec:
`work/req-02-carry-value-no-history.md`. **Ready to build.**

## Next planning step

**Gym-flow review is done** (2026-09-07) — findings are Phase-1 candidates in
`work/BACKLOG.md`. Headline: the logic layer is sound; "flawless" is mostly a design/UX
pass on ~4 screens (the app has **zero CSS** today) plus a rest-end cue + wake-lock and
replacing native modals. Next: **sequence the Phase-1 items with Emilio**, then spec one.

## Needs decisions — parked until their phase

- **The backend fork (gates all of Phase 3):** stay browser-only, or add a
  database/server? "A database" and "users" are one decision; an AI key can't live in
  a browser. Decide before any Phase-3 build — not now.
- **History recalc from a non-latest workout** (Phase 1 behaviour call) — see BACKLOG.
- **Program model** (Phase 2) — define program vs routine vs schedule before speccing.

## Where to read

`START-HERE.md` (read-order + close-out) → `work/BACKLOG.md` (the phased plan) →
`rules/DESIGN.md` before UI/UX → `rules/WORKFLOW.md` for process. `README.md` is the
product contract.
