# req-153 — Back-button and guard leftovers from req-24 / req-152

**Status: BUILT — branch `req-153`, NOT merged; item 1 dropped (DEC-084).** (2026-09-24) — Phase 1, small. **Gate: functional**; planning browser-tests and merges (DEC-035). No
persisted-data change. Emilio: "complete them" (the leftovers in BACKLOG "req-152 follow-ups" + "req-24 reviewer nits").

## The five [measured / reported]

1. **A dead first Back after finishing an exercise** (req-152 reviewer, should-fix). Overview → tap exercise (pushes
   `/workout/x/item/…/log`) → log the last set → `go('/workout/x', { replace: true })` replaces the log entry with
   `/workout/x`, so browser history holds `[…, /workout/x, /workout/x]`. The first device Back lands on the same URL, fires
   no `hashchange`, and visibly does nothing. Sites: `item.jsx:99,110,304,316`, `replace.jsx:31`. **Fix:** a replace
   whose target equals the entry below never leaves a duplicate — one device Back from the overview leaves the workout.
   How is yours (e.g. `history.back()` when the previous entry is the target — the in-app visit stack can say).
2. **"Not found." on an old in-workout page** (Builder, req-152). After Save, a **second** Back reaches an earlier
   `/workout/x/item/…` page; with no active workout for that routine it renders `MissingItem` → "Not found."
   (`helpers.jsx:29-31`, `item.jsx:113,114,507`; also `finish.jsx:18`). **Fix (Planner's call, unconfirmed):** an
   in-workout route (item log/done/replace, finish) for a routine with **no active workout** redirects, replacing, to
   `/workout/<routineId>` — its preview / Done view — instead of "Not found.". A route that is genuinely wrong (unknown
   routine) still shows "Not found.".
3. **Guard gaps** (req-24 reviewer nit, `req-24.test.js:17,30`). The no-native-dialog guard misses `window['confirm']`,
   `const { confirm } = window` (destructuring), `.mjs` files, and skips any line starting with `*`. **Fix:** catch those
   forms; keep the comment skip only for real comment lines (`//`, a `/*…*/` block), with a test per form.
4. **Sticky import error on Today** (req-24 reviewer nit, `Today.jsx:270,321-337`). The first-run import error isn't
   cleared on a new file pick or a cancel. **Fix:** a new pick clears it; a cancel leaves no stale error.
5. **Brittle tests** (req-152 reviewer nit, `req-152.test.js:68,141–144,150,161`): 4 source-regex guards. **Fix:** replace
   with behaviour tests where a behaviour test is possible; a regex guard that stays must say why. Call out every test edit.

## Out of scope

The pill's reserved top space (Emilio judges on the phone). The Update? screen's numbers (Phase 2). Cardio `[0]`.

## Acceptance criteria (written before implementation)

- **1:** a test — after overview → item → last set, `history.length` didn't grow and one `history.back()` leaves
  `/workout/x`; plus a browser run pasted. Failure case: a plain (non-replace) `go` still pushes.
- **2:** a test — item/finish route with no active workout → redirect (replace) to `/workout/<id>`, no "Not found.";
  unknown routine → "Not found.". Browser: Save → Back → Back never renders "Not found." (paste).
- **3:** a test per form (`window['confirm'](`, `const { alert } = window`, a `.mjs` file, a `* confirm(` line inside
  code) — each caught; the current tree still passes; show one deliberate failure run.
- **4:** a test or browser run: bad file → error; pick again (valid, cancelled) → no error shown.
- **5:** list each replaced test and what it now asserts.
- `./check` green (paste the line).
