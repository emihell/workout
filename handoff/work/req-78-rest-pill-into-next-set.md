# req-78 — rest timer as a floating pill, folded into the next set (N5, gym-flow batch 2)

**Status: NEEDS DECISION (confirm scope) — saved 2026-09-14, not scheduled.** From Emilio's
2026-09-14 notes: *"When I finish last set I see the rest timer in the exercise menu — make it
much much smaller, a little pill/button floating in absolute. Maybe remove the timer screen and
move it into each following page … when I complete a set, move to next set but have the rest
pill on it — remove a button press, an extra page, make it simpler."*

**Gate: gym-flow feel (ux-feel).** Reworks the surface req-25/27 built.

## Why

[measured] rest is currently the persistent rest UI in `views/workout/rest.jsx` (req-25 put rest
on the overview; req-27 added the upcoming weight). Completing a set surfaces a rest bar/screen;
Emilio wants completing a set to advance **straight to the next set** with the rest shown as a
small floating pill — removing the intermediate screen and one tap.

## Open decision (Emilio)

Confirm **removing the dedicated rest view entirely** (recommended) vs keeping it as a fallback.

## The behaviour

On completing a set, advance immediately to the **next set's** log page. Render the running rest
countdown as a **small floating pill** (absolute-positioned), not a full bar/screen: shows the
remaining time; tap to skip/dismiss. Preserve the req-27 upcoming-weight on the next-set page.
Last set of an exercise: pill still shows during rest; the forward action advances to the next
exercise (or overview).

## Scope

- The rest UI surface + the set-advance flow.

## Out of scope

- Rest-duration logic (`restSec`) — unchanged.
- Any data change.

## Acceptance criteria

- **Fold works (browser):** complete a set → immediately on the next set with a floating rest
  pill; no intermediate rest screen, no extra tap.
- **Failure/edge (rest bug, req-25):** go Previous after a set then forward, and a set whose timer
  already ran — no double timer, and rest fires exactly when req-25 established. (this is the
  known rest-timer failure case; it must not regress)
- **No regression:** `./check` green; existing rest tests pass or are updated with justification.

## Decisions

- Remove the dedicated rest view (Emilio) — blocks READY.
