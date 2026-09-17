# req-92 — rest pill bigger / more legible (gym-flow batch 3, note n2)

**Status: READY.** From Emilio's in-app note (2026-09-16, `/workout/.../item/.../log`):
*"Rest pill can be but bigger and have the old +- 30 sek."*

**Gate: ux-feel** (visual size only; no data/logic change).

## Decided with Emilio (2026-09-17)

- **Bigger / more legible only.** Make the floating rest pill larger and easier to read
  at a glance mid-set.
- **±30s is NOT coming back.** This half of the note contradicts **DEC-048**, which
  removed Pause/+30s on purpose (rest no longer blocks — you can log the next set
  whenever, so extending a non-blocking countdown is moot). Emilio confirmed
  (2026-09-17): keep DEC-048, drop ±30s. **DEC-048 stands.**

## Why

[measured] The pill is `.ui-restpill` in `src/ui/ui.css:485–520`, rendered by the
`RestPill` component (`src/ui/index.jsx:228`). req-78/DEC-036 made it deliberately small
and solid. Emilio wants it bigger — the remaining time is the one thing he reads while
resting, and it's currently too small to catch at a glance.

## Scope

- `src/ui/ui.css` — `.ui-restpill`, `.ui-restpill__time`, `.ui-restpill__skip` sizing
  (padding, font-size of the time, tap-target).

## Out of scope

- Any ±30s / pause control (DEC-048 — explicitly not re-adding).
- The self-paced behaviour, skip-on-tap, positioning logic (req-78 — unchanged).
- Making it block input again (DEC-048).

## Watch-outs (CC)

- It's `position: fixed` and sits over the live set form — bigger must not cover the
  next-set inputs or the Complete button on a small phone. Check it on a narrow viewport.
- Keep it clear of the iOS safe-area / bottom dock as it is now.

## Acceptance criteria

- **Bigger (browser):** during rest, the pill's remaining-time is clearly larger and
  readable at arm's length; the pill remains a single tap-to-skip target.
- **No overlap (browser, narrow viewport):** the larger pill does not cover the next-set
  form fields or Complete.
- **Unchanged behaviour:** tap still skips rest; no ±30s/pause added; next set still
  loggable during rest (DEC-048).
- **No regression:** `./check` green.

## Decisions

- Bigger pill, no ±30s (Emilio, 2026-09-17 — reaffirms DEC-048).
- Exact sizes — implementation (CC), within "clearly bigger, still doesn't overlap the form."
