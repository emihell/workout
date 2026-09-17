# req-93 — workout exercise list: main implied+bold, only warm-up/finisher labelled (gym-flow batch 3, note n3)

**Status: BUILT AND MERGED, 2026-09-17 — branch `req-93` (`e4bcd71`…`e4bcd71`, 1 commit).** From Emilio's in-app note (2026-09-16, `/workout/sess-push-pull`):
*"Maybe the warm up and finisher should have slightly different text and main should be
bold? And we don't have to say main for all of main — I think we should only show info on
the exercises that are not main."*

**Gate: ux-feel** (labelling/emphasis only; no data/logic change).

## Why

[measured] The in-workout overview lists every exercise as `Name — <roleLabel>`
(`src/views/workout/overview.jsx:132`, live branch). Roles are `warmup` → "WU routine",
`main` → "Main", `finisher` → "Finisher" (`src/ids.js:62–70`). Most exercises are `main`,
so the list repeats "— Main" on nearly every row — noise. The role only carries
information when it's *not* main.

## The behaviour (decided with Emilio, 2026-09-17)

- **Main is the default → no label.** Main-role exercises show just the name, **bold**
  (they're the substance of the session). Do not print "Main".
- **Warm-up / finisher keep a label**, and it should read as clearly distinct from a main
  exercise (e.g. a lighter/secondary treatment and/or its own wording) — these are the
  rows where the role is worth flagging.
- Warm-up-set marker (`· WU set`) and the `· done` suffix are unchanged.

## Scope

- `src/views/workout/overview.jsx` — the live in-workout list (line ~132) primarily.
- Keep consistent: the **preview** branch (`overview.jsx:55`) and the item-screen header
  (`src/views/workout/item.jsx:428`, `bits={[roleLabel(item.role)]}`) should follow the
  same rule so main isn't labelled in one place and labelled in another.
- Styling via `src/ui/ui.css` where a class is the right tool (prefer a class over inline).

## Out of scope

- Changing roles, role data, or `ROUTINE_ROLES`/`roleLabel` themselves.
- Reordering exercises; the routine editor's role picker (still shows all three labels).
- The finish/history screens.

## Watch-outs (CC)

- `roleLabel` defaults an absent role to "Main" (`ids.js:70`) — treat missing role as main
  (unlabelled), same as explicit main.
- Bolding main must not make completed (`ui-row--done`, muted) rows fight the mute — check a
  list with a mix of done/not-done main rows.

## Acceptance criteria

- **Main unlabelled + bold (browser):** in a live workout, main exercises show name only,
  bold; no "— Main" text on any row.
- **WU/finisher labelled (browser):** warm-up and finisher rows still carry a clear,
  visually-distinct label.
- **Consistent (browser):** the exercise's item screen and the pre-start preview follow the
  same rule (main unlabelled).
- **No regression:** `./check` green; any test asserting "— Main" in the list is updated with
  justification in the diff.

## Decisions

- Main implied+bold, only non-main labelled (Emilio, 2026-09-17).
- Exact label wording for WU/finisher and the "distinct" treatment — implementation (CC),
  within "reads clearly different from a main exercise."
