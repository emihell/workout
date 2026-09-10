# req-24 — replace native `confirm`/`alert` with inline UI

**Status: NEEDS DECISION** — one design call (below) before it is READY. Sourced from
`reports/req-15-findings.md` #11, and the standing backlog item "Replace native alert/confirm with
inline UI" (`work/BACKLOG.md`, Phase 1). Not part of the autoloop refactor batch.

**Gate: UX / feel** (DEC-009) — it changes how destructive actions feel on a phone. Planning builds
and presents; **Emilio uses it and merges on his OK.** This is the whole reason it's not code-only.

## Why

[measured] 10 native modal calls across the views (`grep -rn "window.confirm\|window.alert" src/views`):

| # | site | text | kind |
|---|------|------|------|
| 1 | `Exercises.jsx:319` | `Delete {name}?` | destructive confirm |
| 2 | `Schedule.jsx:81`   | `Remove {n} scheduled routine(s)?` | destructive confirm |
| 3 | `Schedule.jsx:126`  | `Remove {slot}?` | destructive confirm |
| 4 | `Routine.jsx:152`   | `Delete {routine}?` | destructive confirm |
| 5 | `Routine.jsx:390`   | `Remove {exercise}?` | destructive confirm |
| 6 | `History.jsx:354`   | `Delete {workout}?` | destructive confirm |
| 7 | `History.jsx:589`   | `Remove set?` | destructive confirm |
| 8 | `Workout.jsx:45`    | `Abandon?` | destructive confirm |
| 9 | `Today.jsx:81`      | import error | alert (error notice) |
| 10 | `Workout.jsx:331`  | `Pick effort.` | alert — **likely dead** (effort defaults to Moderate; verify + delete) |

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

Recommendation: **(a)** for the destructive confirms (explicit, safe, one component), and route the
two `alert`s to the existing `Banner` (error notice) — no confirm needed. Emilio to confirm (a) vs a
mix before build. Until this is decided the req stays NEEDS DECISION.

## Scope (once the pattern is chosen)

- One reusable inline-confirm primitive in `ui/` implementing the chosen pattern.
- Replace confirms #1–8 with it, preserving each exact message and the destructive action.
- Replace alert #9 with a `Banner` error notice (no blocking dialog).
- Verify #10 (`Pick effort.`) is unreachable given the Moderate default and **delete** it (do not port
  a dead guard); if it turns out reachable, report that — it's a real bug, not a port.

## Out of scope

- Changing *what* any action does or *whether* it confirms — only *how* the confirm is presented.
- The "Abandon should offer save-as-draft" behaviour question (`work/BACKLOG.md`) — that's a separate
  behaviour call; here `Abandon?` just becomes an inline confirm with the same effect.

## Acceptance criteria (written before implementation)

- **No native dialogs left:** `grep -rn "window.confirm\|window.alert" src/views` returns nothing
  (paste it).
- **Every destructive action still gates (Emilio, in-browser):** deleting an exercise / routine /
  scheduled slot / workout / set, removing a routine exercise, and abandoning a workout each still ask
  before acting, with the same message, and Cancel truly cancels.
- **Import error shows inline:** a failed import surfaces the error in-app (Banner), not an OS alert.
- **Dead guard gone:** `Pick effort.` removed (or reported reachable with a repro).
- **Feels right on a phone (Emilio):** the confirm is thumb-reachable and unmistakable; destructive
  vs cancel are visually distinct. His judgement is the gate.
- **No regression:** `./check` green (paste the line).

## Decisions

- **behaviour/design (Emilio, OPEN):** the inline-confirm pattern (a/b/c above). Blocks readiness.
- **implementation (CC's call once unblocked):** the primitive's API (`useConfirm()` vs `<Confirm>`);
  bottom-sheet vs inline bar; how it stacks with the RestBar/Banner already on-screen.
