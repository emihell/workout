# req-197 — analytics counted per day and per build; Export analytics resets them

**Status: READY** (2026-10-07). **Lane: batch** (settled, mechanical). **Gate: functional.**
Not persisted-data: the analytics key is separate from the workout history (DEC-011).

Emilio, 2026-10-07, after sending an export: "have in mind that its used during chages as well, so might have to update
analytics to have dates as well so we can track it, and reset when exporting".
**Why:** today's export is a single all-time total. It can't separate gym use from test clicking during builds. In his
export, the screens visited most were Home 113, Library 64 and Settings 43, against 2 finished workouts. The pairs were
Home ↔ Library 46/42, Home ↔ Settings 32/25 and Library ↔ Settings 15/10: tab-hopping, most likely while checking new
builds.

## Code today (main `568a09a`)
- `src/analytics.js` stores the shape `{ screens, transitions, buttons }` under its own key `workout-mvp-analytics`, never in
  the backup (DEC-011).
  - `applyScreen` and `applyButton` are pure functions.
  - `recordScreen` and `recordButton` swallow every error.
  - `exportAnalytics()` returns the live object.
- `recordScreen` is called from `route.js:55`.
- The Settings "Export analytics" button is at `views/Settings.jsx:49-57`. It calls `recordButton('export-analytics')` and
  then `downloadJson`.
- The app has no build id today: no vite `define`, no version string.

## Scope
1. **Shape:** `{ v: 2, days: { "YYYY-MM-DD": { screens, transitions, buttons, builds: { "<sha>": n } } } }`.
   - The day is the local date when the event happens (`dateKey`).
   - `builds` counts screen events per build, so a day can be split into before and after a deploy.
2. **Build id:** inject the short git sha at build time, through vite `define` or similar. Use `"dev"` when git is
   unavailable or under `npm run dev`. Builder chooses the mechanism. It must not break `./check` or the Pages deploy.
3. **Transitions don't cross a day boundary.** If the previous screen was recorded on another day, count no transition.
   `(unconfirmed)`
4. **Export analytics resets.** It downloads the current object and then clears the stored analytics.
   - The message becomes "Analytics downloaded. Counting starts again." `(unconfirmed)`
   - The `export-analytics` press is counted in the *new* (post-reset) data, not in the downloaded file `(unconfirmed)`.
   - Only Export analytics resets. The workout **Export** does not touch analytics.
5. **Old-format data is not lost.** On load, a v1 blob (`{screens, transitions, buttons}` with no `v`) is kept as
   `days["before-dates"]`. That way the first export after the update still carries it, and the reset then clears it.
6. The existing guarantees still hold: writes are best-effort and silent (DEC-011), and analytics never enter the workout
   backup.

## Out of scope
- An in-app analytics view.
- Per-event timestamps or an ordered event log. DEC-011 rejected that as unbounded. Day buckets plus the reset keep the
  data small.
- Moving the Export analytics button. Where Settings content lives is req-196 Q1.

## Acceptance
1. Unit test: two events on different mocked days land in two `days` keys, each with its own `builds` count.
2. Unit test: a v1 blob in storage loads as `days["before-dates"]` with its counts unchanged.
3. Unit test or browser check: Export analytics downloads the populated object, and afterwards the stored key holds only
   the post-reset `export-analytics` count.
4. **Failure case:** a corrupt or non-object analytics blob, or a `localStorage.setItem` that throws, still never throws
   into navigation or a button. Same test style as today.
5. `buildBackup` output contains no analytics. Use the existing test, kept.
6. The production build exposes a non-`"dev"` build id. Receipt: grep `dist/` for the sha after `npm run build`.
