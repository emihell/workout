# req-78 — rest timer as a floating pill, folded into the next set (N5, gym-flow batch 2)

**Status: BUILT AND MERGED, 2026-09-16 — branch `req-78` (`dee674d`…`dee674d`, 1 commit).**
From Emilio's 2026-09-14 notes: *"When I finish last set I see the rest timer in the exercise menu
— make it much much smaller, a little pill/button floating in absolute. Maybe remove the timer
screen and move it into each following page … when I complete a set, move to next set but have the
rest pill on it — remove a button press, an extra page, make it simpler."*

**Gate: gym-flow feel (ux-feel).** Reworks the surface req-25/27 built.

## Why

[measured] rest is currently the persistent rest UI in `views/workout/rest.jsx` (req-25 put rest
on the overview; req-27 added the upcoming weight). Completing a set surfaces a rest bar/screen;
Emilio wants completing a set to advance **straight to the next set** with the rest shown as a
small floating pill — removing the intermediate screen and one tap.

## Decisions made (Emilio, 2026-09-16)

- **D1 — remove the dedicated rest view entirely.** No fallback. The pill fully replaces the
  `rest.jsx` `RestUpcoming` panel and the `RestBar` overlay; req-25's overview-rest and req-27's
  editable-upcoming-weight surfaces are reworked accordingly (their tests updated with
  justification — a test edit is called out in the diff).
- **D2 — the next set is immediately loggable during rest (self-paced).** Completing a set shows
  the next set's live form at once; **Complete is NOT locked** while rest runs. The pill is
  informational and dismissable; rest never blocks input.

## The behaviour

On completing a set, show the **next set's log form immediately** — no intermediate rest panel,
no extra tap, and its Complete is live during rest (D2). Render the running rest countdown as a
**small floating pill** (absolute-positioned): shows remaining time, tap to skip/dismiss. req-27's
upcoming-weight edit **folds into the now-always-present next-set form** (the form already shows
and lets you edit the seeded weight — no separate panel). Last set of an exercise: pill still shows
during rest; the forward action advances to the next exercise (or overview).

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
- **Self-paced (browser):** while the pill is counting down, the next set's Complete works — you
  can log the next set without waiting for rest to end (D2).
- **No regression:** `./check` green; existing rest tests pass or are updated with justification.
