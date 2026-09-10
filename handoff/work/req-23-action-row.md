# req-23 — formalize the "row with a trailing action button" pattern

**Status: BUILT AND MERGED, 2026-09-10 — branch `req-23` (`e4905b5`…`e4905b5`, 1 commit).** Small `ui/` consolidation. The finding left "component vs convention" open;
**decided here: an `action` prop on `Row`** (rationale below). Sourced from
`reports/req-15-findings.md` #5 (DEC-021).

**Gate: code-only** (DEC-009, functional) — touches `Row` + several call sites; planning verifies the
affected screens and merges. Lowest-value of the refactor batch — fine to build late or drop if time
is short; it changes no behaviour.

## Why

A recurring pattern stuffs a `<Button>` into `Row`'s `value` slot to get "list row with a trailing
action":

- [measured] `Today.jsx:43` — `<Row value={action}>` where `action` is a `<Button>` (`StartButton`,
  the `Start`/`Resume`/`Done`/`Continue` control).
- The finding also lists: Start drafts, Schedule day (`Remove`) and add (`assign`), Routine detail
  (`Up`/`Down`), Exercise search (`Add`). [measured] each of `Today/Start/Schedule/Routine/Exercises`
  imports and uses `Button` inside list rows.

It works — `value` accepts any node — but the trailing-action case is ad hoc: no shared name, no
guaranteed alignment/gap, each caller re-does the layout. The finding wants it made a first-class
pattern so these rows stay consistent.

## The change — decided: an `action` prop on `Row`

Add an optional `action` prop to `Row` (`ui/index.jsx`) that renders a trailing action slot with
consistent alignment and spacing (its own `.ui-row__action` styling), distinct from the informational
`value` slot. A plain row with `action` renders `children … action`; `value` and `action` are
mutually-exclusive-ish (if both are passed, define the order — `value` then `action` — or reject it;
CC's call, state it).

**Why a prop, not a new `ActionRow` component:** rows already flex their trailing slot through `Row`;
a prop keeps one row primitive instead of a parallel component callers must choose between, and lets a
link row *also* eventually carry an action without a third component. (A standalone `ActionRow` is a
legitimate alternative — if CC finds the prop muddies `Row` badly, report it and propose the component
instead, don't just switch.)

## Scope

- `action` prop on `Row` with consistent trailing-control layout in `ui.css`.
- Migrate the listed call sites (`Today`, `Start` drafts, `Schedule` remove/assign, `Routine` up/down,
  `Exercises` add) from `value={<Button>}` to `action={<Button>}`.
- A Showcase entry.

## Out of scope

- Changing any button's behaviour, label, or handler — pure presentation move.
- Link-row actions (a trailing button on a `to` row) — not needed by current callers; note if any
  caller actually wants it, don't build speculatively.
- The link-row `value` work (req-20) — separate slot, separate req.

## Acceptance criteria (written before implementation)

- **All listed rows unchanged (planning, in-browser):** Today's Start/Resume/Done/Continue, Start
  drafts, Schedule Remove/assign, Routine Up/Down, Exercises Add all render and work exactly as today,
  now via `action=`.
- **Consistent spacing:** the trailing control aligns the same way across all these screens (the point
  of the req) — planning eyeballs two or three.
- **`value`-only rows unchanged:** informational `value` rows render identically.
- **No regression:** `./check` green (paste the line); Showcase renders.

## Decisions

- **design:** prop-vs-component decided above (prop). Behaviour of every migrated control is
  unchanged.
- **implementation (CC's call, note in report):** the `value` + `action` interaction rule; the
  `.ui-row__action` styling; whether any caller is left on `value` because `action` doesn't fit.
