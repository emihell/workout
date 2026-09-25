# req-171 — Back returns to the screen you came from

**Status: BUILT — branch `req-171` (`9dd0c00`, 3 commits), NOT merged.** (2026-09-25) **Lane: bug.** Source: Emilio's in-app note on `/history/wo-mu6t2qbm-ne2q5c`
(2026-09-24): "Sent from main page here, when i press back i go to history? This is weird behaviour - i think pages we
can access from several pages must be able to get us back to where we got here from". A binary fix under DEC-091 §4 —
no behaviour question open.

## Reproduction (main `50720ef`, `./plan qa main`, Chrome, 2026-09-25) [measured]

Today (`#/`) → tap the first past-workout row → lands on `#/history/wo-w42-sess-upper`; the in-app ‹ Back's href is
`#/history`, not `#/`:

```
{ "clicked": "#/history/wo-w42-sess-upper", "nowAt": "#/history/wo-w42-sess-upper", "backHref": "#/history" }
```

Cause: `<Back to="/history" />` is a fixed link (`views/history/detail.jsx:38`; `Back` is a plain `NavLink`,
`views/shared.jsx:43-49`, DEC-082 §1).

## Screens with more than one way in (rescan 2026-09-25, grep of link targets in `src/views`)

| screen | entered from | Back today |
|---|---|---|
| workout detail `/history/:id` | History list / a month (`history/list.jsx:26`), Today (`Today.jsx:82,93`), a finished workout on the workout overview (`workout/overview.jsx:81`) | always `/history` (`detail.jsx:38`) |
| one exercise in a past workout `/history/:id/exercise/:itemId` | the workout detail, and an exercise's history list (`history/list.jsx:157`) | always the workout detail (`HistoryWorkoutExercise`, `history/detail.jsx:102,123`) |

**Builder sweeps the rest:** every `<Back to=…>` in `src/views` (35 sites: `grep -rn '<Back' src/views | grep -v '\.test\.' | grep -v Library.jsx | wc -l` → 35) — for each
screen, list its entry points and whether Back already returns there. Fix every one that doesn't; the table in the
report is the receipt.

## Fix

Use the existing return-target mechanism, `?from=<encoded path>` (req-99, `route.js:139-158`; read today only by
`exercise-edit`, `route.js:258-260`, `App.jsx:163`, `Exercises.jsx:393`). A link into a multi-entry screen from a
non-default parent carries `?from=`; that screen's Back (and Cancel/Save/Delete exits that return "up", where they
exist) goes to `from`, else to today's fixed parent. Deeper screens reached *from* it keep passing the same `from` down
so the chain unwinds correctly (detail → set edit → back to detail → Back still returns to Today).

**Constraints:** no `history.back()`, no timers, no popstate logic — DEC-084 dropped exactly that approach as untestable.
Device/swipe Back is the browser's and is untouched. No stored data changes (the hash is not persisted state; `NAV_KEY`
in sessionStorage is analytics-only, `route.js:17-22`).

## Out of scope

- Redesigning what needs a Back at all (Emilio's "going back is heavy signal that you made an error") → req-144 prep §D.3.
- Device/swipe Back behaviour (DEC-081/083).
- The tab bar and top-level lists (Today, History, Library, Settings) — they have no "came from".

## Acceptance criteria

1. **Fails on main, passes on the branch:** a unit test that the workout detail's Back target, given `from=/`, is `/`
   — red on main, green on the branch (both receipts).
2. **Default kept:** with no `from` (a reload, a shared link, the History list), Back goes to today's parent
   (`/history` for the detail) — a test.
3. **Failure case — a bad `from`:** `from` that is empty, not `/`-prefixed, undecodable (`%E0%A4%A`), or an unknown
   route → Back falls back to the default parent, never "Not found." and never off-app — a test per shape.
4. **The chain unwinds:** Today → workout detail → one exercise → Back → Back lands on Today (browser run).
5. Every row of the sweep table fixed or marked "already correct" with its entry points (report).
6. `./check --smoke` green (paste). Planner re-runs the reproduction and criterion 4 in the browser (`./plan qa req-171`).

## READY checks

1. DECs grepped (`back`, `swipe`, `from`): DEC-081/082/083 (device Back, replace — untouched), DEC-084 (no
   `history.back()`/timing — honoured), DEC-091 §4 (binary fix, no ask).
2. Siblings: none in flight. req-144 (design) may later remove some Backs; this doesn't block it.
3. Deferrals: none.
4. Numbers: 35 Back sites, measured by the command above on `50720ef`, 2026-09-25.
5. Trigger files: none expected (`route.js` is not on the DEC-057 list); if the build touches `store.jsx`/`model.js`/
   storage, the reviewer fires. No stored records written → no backup reminder.
6. Decisions on Emilio's behalf: **implementation** — reuse `?from=` rather than a new mechanism. **Behaviour** — Back
   returns where you came from: his own ask (quote above), confirmed by DEC-091 §4. Nothing `(unconfirmed)`.
