# req-162 — Skip exercise flashes "Not found." for one render

**Status: BUILT — branch `req-162` (`c161939`), NOT merged.** (2026-09-25) — **Lane: bug.** Found by req-159's smoke test on main (it logs it as a `note:`).

After Skip exercise (two taps), the log screen renders "‹ Back / Not found." for one frame before the replace-redirect to
the overview lands: `WorkoutItemLog` returns `<MissingItem/>` for a marked-done item (`item.jsx:113-116`) while the
redirect effect is pending. Builder's suggested fix: render `null` for the marked-done case (the redirect follows). A
genuinely missing item (unknown id with an active workout) still shows "Not found.".

## Acceptance criteria

- A render test (the req-156 harness) that fails on main: a marked-done item's log screen renders no "Not found." text
  before redirecting; an unknown item id still renders "Not found.".
- `scripts/smoke.mjs`: the `note:` about the flash is turned into a hard check (a flash = red), and the run is green.
- `./check --smoke` green (paste).
