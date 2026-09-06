# Now

Set up 2026-09-06 (workflow adopted). Keep under 50 lines; **what is done lives in
`log/SHIPPED.md`** — this is only what is next. Full req list: `work/req-*.md`.

## Milestone

> **The one loop is trustworthy.** Set up exercises and routines, schedule them,
> start a workout, log sets, keep an editable record — with the record never wrong
> and never invented. Deploys clean to Pages.

## Where we're starting

The app already exists and works: React + Vite, browser-only, `localStorage`
(`workout-mvp-v8`), 54 unit tests green, auto-deploys to GitHub Pages on push to
`main`. This is the **first session of the planning workflow**, not the first line of
the app — so there is no shipped-under-this-workflow history yet, and the first job is
to pick the first requirement.

## Next — READY (only READY goes to CC)

*(none yet — write the first requirement.)* Candidates live in `work/BACKLOG.md`;
none is `READY` until its behaviour questions are answered (see `rules/WORKFLOW.md`,
Readiness).

## Needs decisions — the near ones

- **What's the first requirement?** Pick from `work/BACKLOG.md` or from something
  Emilio wants fixed. Turn it into `work/req-01-*.md`, answer its behaviour questions,
  tag it `READY`, publish.
- **Confirm the deferred-scope line** in `README.md` still holds (no accounts,
  sharing, charts, insights, visual-design pass for the MVP).

## Where to read

**Start every session at `START-HERE.md`** (read-order + the close-out process;
`rules/CLOSEOUT.md` before any merge). Then `work/BACKLOG.md` for candidate work.
`rules/DESIGN.md` before any UI/UX change; `rules/WORKFLOW.md` for process. `README.md`
is the product contract.
