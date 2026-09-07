# Now

Updated 2026-09-07 (first code review done). Keep under 50 lines; **what is done lives
in `log/SHIPPED.md`** — this is only what is next. Full req list: `work/req-*.md`.

## Milestone

> **The one loop is trustworthy.** Set up exercises and routines, schedule them,
> start a workout, log sets, keep an editable record — with the record never wrong
> and never invented. Deploys clean to Pages.

## Where we're at

The app exists and works: React + Vite, browser-only, `localStorage` (`workout-mvp-v8`),
54 unit tests green, auto-deploys to Pages. First planning-workflow review done
(2026-09-07): the logic core is solid (recommendation engine correct, "no invented
data" enforced, archive-vs-delete right). Findings folded into `work/BACKLOG.md`.

## Next — READY (only READY goes to CC)

*(none yet.)* `req-01` is drafted but `NEEDS DECISIONS` — one question below answers it.

## Needs decisions — the near ones

- **`req-01` guard `saveState`** — the one real data-integrity gap: the persist path
  can throw (quota / Safari private mode) and lose data silently. Spec is written
  (`work/req-01-guard-savestate.md`); the only open question is **how a save failure
  is surfaced** — planning recommends a persistent banner (option A). Confirm A (or
  pick B/C) → it flips to READY → hand to CC as the first real loop.
- **History recalc from a non-latest workout** (behaviour call) — see BACKLOG. Decide
  before speccing.

## Where to read

**Start every session at `START-HERE.md`** (read-order + close-out; `rules/CLOSEOUT.md`
before any merge). `work/BACKLOG.md` for candidates. `rules/DESIGN.md` before any
UI/UX; `rules/WORKFLOW.md` for process. `README.md` is the product contract.
