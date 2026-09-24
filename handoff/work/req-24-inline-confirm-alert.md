# req-24 — replace native `confirm`/`alert` with inline UI

**Status: BUILT AND MERGED, 2026-09-24 — branch `req-24` (`135dc18`…`135dc18`, 1 commit).** Pattern chosen by Emilio: **(a) confirm sheet** (DEC-079). Sourced from
`reports/req-15-findings.md` #11, and the standing backlog item "Replace native alert/confirm with
inline UI" (`work/BACKLOG.md`, Phase 1). Not part of the autoloop refactor batch.

**Gate:** planning browser-tests every site and merges on that (DEC-035); Emilio feels it on the phone after (he
accepted on 2026-09-24 that touch/one-handed feel is caught in real use).

## Why

[measured 2026-09-24] **14** native modal calls on `main` (`git grep -n -E "(confirm|alert|prompt)\(" main -- src`,
tests excluded); the 2026-09 list of 10 is superseded — sites moved and new ones were added:

| # | site | text | kind |
|---|------|------|------|
| 1 | `import-backup.js:31,34` | `Replace all data on this device?` (default `confirm` = `window.confirm`) | destructive confirm |
| 2 | `Exercises.jsx:481` | delete exercise (`head + removes`) | destructive confirm |
| 3 | `Routine.jsx:206` | delete routine (`head + removes`) | destructive confirm |
| 4 | `Routine.jsx:502` | `Remove {exercise}?` | destructive confirm |
| 5 | `Schedule.jsx:86` | `Remove {n} scheduled routine(s)?` | destructive confirm |
| 6 | `Schedule.jsx:129` | `Remove {slot}?` | destructive confirm |
| 7 | `history/detail.jsx:86` | `Delete {workout}?` | destructive confirm |
| 8 | `history/edit.jsx:201` | `Remove set?` | destructive confirm |
| 9 | `workout/helpers.jsx:40` | `Abandon?` | destructive confirm |
| 10 | `workout-actions.js:51` | `ABANDON_ON_NEW_WARNING` | destructive confirm |
| 11 | `workout-actions.js:81` | `ABANDON_ON_NEW_WARNING` | destructive confirm |
| 12 | `workout-actions.js:91` | `Abandon this workout? It will not be saved.` | destructive confirm |
| 13 | `Today.jsx:328` | import error | alert → inline error |
| 14 | `workout/item.jsx:211` | `Pick effort.` | alert — likely dead; verify + delete |

**Found by planning's own browser run (2026-09-24):** importing a non-backup file (the analytics export) asks
`Replace all data on this device?` **before** checking the file, then shows "Not a workout database backup." — so a wrong
file still gets the destructive question. **Validate first, confirm only a valid backup.** The native dialog also froze
the automated browser until Emilio clicked it by hand — native dialogs block any in-browser test, not just feel.

Native `confirm`/`alert` are jarring on mobile, break the one-screen-per-action feel, and on iOS can
be styled by the browser, not the app. This app's whole gym-flow bar is "flawless on a phone,
one-handed" — a native OS dialog is the opposite of that. (`DEC-010`: mobile is primary.)

## The decision to make first (Emilio)

**What does an inline confirm look like?** The `Banner` component is a passive notice, not a yes/no
gate, so a destructive confirm needs a real affordance. Options:

- **(a) Inline confirm bar / sheet** — the action reveals a "Delete {x}? [Cancel] [Delete]" bar in
  place (bottom sheet on mobile), destructive action styled distinct. One reusable `ConfirmSheet` /
  `useConfirm()`.
- **(b) Two-tap inline** — the button turns into "Tap again to confirm" for ~3s. Lighter, no overlay,
  but less explicit; risky for truly destructive deletes.
- **(c) Undo-instead-of-confirm** — do the action immediately, show a Banner with **Undo** for a few
  seconds. Best feel, but needs each action to be reversible (a captured snapshot to restore) — more
  work, and this is a data-trust app.

**Chosen (Emilio, 2026-09-24, DEC-079): (a)** — a bottom confirm sheet: the message, [Cancel] and a destructive button
styled distinct; the two `alert`s become in-page error notices (`Banner`), no confirm.

## Scope (once the pattern is chosen)

- One reusable inline-confirm primitive in `ui/` implementing the chosen pattern.
- Replace confirms #1–12 with it, preserving each exact message and the destructive action.
- Import (#1): validate the file **before** asking; an invalid file shows its error and never the replace question.
- Replace alert #13 with a `Banner` error notice (no blocking dialog).
- A **guard test** that fails if `window.confirm`, `window.alert` or `window.prompt` (or a bare `confirm(`/`alert(`/
  `prompt(` global call) appears anywhere in `src/` outside tests — so a new native dialog can't come back (Emilio:
  "cover all prompts with our own code").
- Verify #14 (`Pick effort.`) is unreachable given the Moderate default and **delete** it (do not port
  a dead guard); if it turns out reachable, report that — it's a real bug, not a port.

## Out of scope

- Changing *what* any action does or *whether* it confirms — only *how* the confirm is presented.
- The "Abandon should offer save-as-draft" behaviour question (`work/BACKLOG.md`) — that's a separate
  behaviour call; here `Abandon?` just becomes an inline confirm with the same effect.

## Acceptance criteria (written before implementation)

- **No native dialogs left:** `git grep -n -E "window\.(confirm|alert|prompt)|[^.a-zA-Z](confirm|alert|prompt)\(" -- src
  ':!*.test.js'` shows no native call (paste it), and the guard test passes — and **fails** when a `window.confirm` is
  added (show that run).
- **Import validates first:** a non-backup file shows the error and never the confirm sheet; a valid backup shows the
  sheet, Cancel leaves data unchanged, Replace replaces (test).
- **Every destructive action still gates (Emilio, in-browser):** deleting an exercise / routine /
  scheduled slot / workout / set, removing a routine exercise, and abandoning a workout each still ask
  before acting, with the same message, and Cancel truly cancels.
- **Import error shows inline:** a failed import surfaces the error in-app (Banner), not an OS alert.
- **Dead guard gone:** `Pick effort.` removed (or reported reachable with a repro).
- **Feels right on a phone (Emilio):** the confirm is thumb-reachable and unmistakable; destructive
  vs cancel are visually distinct. His judgement is the gate.
- **No regression:** `./check` green (paste the line).

## Decisions

- **behaviour/design (Emilio, 2026-09-24, DEC-079):** (a) the confirm sheet.
- **implementation (CC's call once unblocked):** the primitive's API (`useConfirm()` vs `<Confirm>`);
  bottom-sheet vs inline bar; how it stacks with the RestBar/Banner already on-screen.
