# req-59 — Restore front-page upcoming preview; keep only the Schedule link removed

## Technical

Corrects req-57's over-removal. req-57 deleted the *entire* front-page upcoming
schedule preview from `src/views/Today.jsx`; Emilio wanted only the `<Row
to="/schedule">Schedule</Row>` nav link gone. Restored the preview minus that link.

Changes, all in `src/views/Today.jsx`, matched against `git show
558135d^:src/views/Today.jsx`:

1. **Import** — re-added `remainingInLoop` to the `../schedule` import (line 4).
2. **`UpcomingRow` component** — restored verbatim (with its comment), placed before
   `TodayWorkout` as in the pre-req-57 source.
3. **`upcoming` computation** — re-added `const upcoming = remainingInLoop(routines,
   schedule, now).slice(0, 2)` in `Today()`, after `todays`. Comment trimmed to drop
   the stale "Show all"/Schedule-page framing.
4. **Upcoming `<List>` in render** — re-added the headerless list with
   `upcoming.map(... <UpcomingRow ... todayKey={todayKey} />)` and the
   `{upcoming.length === 0 ? <p className="ui-sub">Nothing scheduled.</p> : null}`
   line after it. Updated the section-order comment to reflect the restored preview
   and note the Schedule link stays gone.

**Not restored:** `<Row to="/schedule">Schedule</Row>` in the main render — that one
nav row stays removed (Schedule lives in the Library segment, req-56). The upcoming
list is headerless.

**Left untouched:** the today hero (`TodayHero`/`TodayWorkout`/`TodayEmpty`),
Completed-today, and the recent + `<Row to="/history">History</Row>` section. The
`to="/schedule"` at line 251 is in the *no-data empty-state/import screen* (the
`if (!routines.length)` branch), which req-57 never touched and this req leaves as-is
— it is not part of the front-page preview.

## Verification

- `./check` → `check: green — lint, 18 test file(s), and the build all passed.`
  (213 tests pass, 0 fail.)
- `grep -n "UpcomingRow" src/views/Today.jsx` → definition (94) + render use (277).
- `grep -n "remainingInLoop" src/views/Today.jsx` → import (4) + call (209).
- `grep -n 'to="/schedule"' src/views/Today.jsx` → only line 251, inside the
  no-routines empty-state block; none in the main front-page render.
- `grep -n "Nothing scheduled\." src/views/Today.jsx` → line 280.

Could not verify in a browser (no runtime session): the visual result — upcoming
items showing inline Start / `Done …`, and "Nothing scheduled." when the loop is
empty — is a look-and-feel check for Emilio.

## Workflow

No scope changes; no mid-build decisions. Followed the requirement's implementation
call (restore verbatim minus the link; headerless list). Comments were trimmed of
stale Schedule/Show-all references per the requirement's allowance rather than
restored word-for-word.
