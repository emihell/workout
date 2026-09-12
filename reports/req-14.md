# req-14 — new nav: 3-tab bottom bar (Workouts / Library / Settings)

Branch `req-14`. Nav shell only (req-32 timeline merge is out of scope). No
persisted-data / schema change — routing + UI only.

## Review iteration 1 (Emilio, 2026-09-12)

Five changes after the first look, same branch, still not merged:

1. **Tabs are component-library `Button`s, no custom icons.** Dropped the inline
   SVG icons. TABS now carry a static variant — Workouts `primary`, Library
   `secondary`, Settings `quiet` — rendered as `<Button variant … onClick=go(to)>`.
   The active tab is still dynamic on top: `aria-current="page"` + an `.is-active`
   currentColor underline that reads on every variant (white on the ink primary,
   ink on the light/quiet ones). So a tab shows both its fixed emphasis and
   whether it's the current screen. (`ui/index.jsx`, `ui/ui.css`.)
   - *Note (DEC-016 tension):* these tabs navigate via a `Button`+`go()`, not an
     `<a>`. DEC-016 reserves `<button>` for actions and uses `NavLink`/`<a>` for
     pure route nav. Emilio's review explicitly asked for the Button primitive on
     this surface, so I followed it — flagging for the DEC-024 writeup. If the
     link semantics matter more than the Button look, the alternative is a
     `NavLink` carrying the `ui-btn` classes.
2. **"Other" → "Choose a workout"** on Today (`Today.jsx`).
3. **Today's Start is a large primary block button.** `StartButton` gained
   `variant`/`block`; today's workout renders as `TodayWorkout` (routine name +
   full-width `variant="primary" block` Start) instead of a small trailing row
   action. `Done …` shows once logged; an in-progress workout shows nothing here
   (the top-of-screen Continue owns that, as before).
4. **Workouts shows a peek of Schedule + History, each with "Show all".**
   Replaced the bare Schedule/History links with two preview sections: up to 2
   upcoming schedule occurrences (`remainingInLoop`, tomorrow onward) and the 2
   most-recent history workouts (`sortWorkoutsByDate`), each ending in a
   `Show all` row → `/schedule` / `/history`.
5. **`Back` on the Schedule and History top-level screens** (`Schedule.jsx`,
   `history/list.jsx`) so you can return to Workouts now that they aren't tabs.

Behaviour changes worth a DEC/L note:
- The old Today **"Next"** section let you Start a *future* scheduled workout
  inline. That inline Start is gone (upcoming is now a read-only peek). Starting
  ahead is still possible via "Choose a workout" (`/start`) and via Schedule → day.
- `nextScheduled` is no longer used by Today (swapped for `remainingInLoop`); it
  remains exported/used elsewhere.

`./check` re-run after the iteration — green (145 tests, lint, build).

## Review iteration 2 (Emilio, 2026-09-12)

Two decided changes, same branch, not merged:

1. **Inline Start-ahead restored on the upcoming peek.** Emilio reversed the iter-1
   behaviour change: you can again Start a *future* scheduled workout straight from
   Workouts. New `UpcomingRow` (`Today.jsx`) gives each upcoming item a smaller
   **secondary** Start via the same `startOrContinue(store, routine.id, {
   scheduledFor, scheduleSlotId })` path, with the same guards as the today row
   (already-covered → `Done …`; in-progress → no Start). Today's big **primary**
   Start stays the main CTA.
2. **DEC-016 fix on the tab bar (look identical, semantics corrected).** Tabs were
   `Button` (`<button>`) + `go()`; now they are `NavLink`/`<a>` carrying the
   `ui-btn ui-btn--{variant}` classes — same look (primary/secondary/quiet), but
   correct link-nav per DEC-016 (buttons for actions, links for navigation). Active
   state kept (`aria-current="page"` + the underline). Added `text-decoration:none`
   to the base tab so the anchor doesn't show a UA underline; `.is-active` re-adds
   it. **For DEC-024:** the tab bar uses the Button *look* through link semantics —
   the DEC-016 tension from iter 1 is resolved, not carried.

The active-underline strength is unchanged this pass (Emilio will judge it on test).

`./check` re-run after iteration 2 — green (145 tests, lint, build).

## Technical

### What changed

- **`activeTab(routeName)` pure fn** — `src/route.js`. Maps any parseRoute name to
  its tab: `settings` → Settings; `routine*`/`exercise*` → Library; everything
  else (today, `schedule*`, `history*`, the `workout*` in-workout flow, `start`,
  and any future/unknown route) → Workouts; the dev `components` showcase → `null`
  (no tab). Prefix-based so a deep route can't fall through — editing a routine is
  still Library, a schedule slot is still Workouts.
  - Unit-tested in `src/route.test.js`: every route name parseRoute can emit is
    listed and asserted against its tab (26 Workouts, 17 Library, settings,
    components→null, plus unknown/undefined → Workouts).

- **`TabBar`** replaces `NavBar` — `src/ui/index.jsx`, `src/ui/ui.css`,
  `src/App.jsx`. Fixed bottom bar, 3 equal tabs, icon (inline currentColor SVG:
  dumbbell / stacked cards / gear) + label. Active tab derived from
  `activeTab(useHashRoute().name)`, highlighted with full ink + weight and
  `aria-current="page"`. `position:fixed` + `padding-bottom:env(safe-area-inset-bottom)`;
  content clears it via `padding-bottom: calc(64px + env(safe-area-inset-bottom))`
  on `<main class="ui-main">`. Tabs are `≥44px` (`min-height:var(--ui-tap)`).
  - `NAV_ITEMS` and the Menu toggle (open state + outside-click effect) are gone.
  - `NavBar` is mounted after `<main>` in `App.jsx` (was before); DOM order now
    content-then-bar, which is the right reading/focus order for a bottom bar.

- **Library tab** — new `src/views/Library.jsx`. A `[Routines | Exercises]`
  segmented toggle above the **existing** Routines / Exercises list screens
  (hosted unchanged). Active segment = the route (`routines`→Routines,
  `exercises`→Exercises), passed as a `tab` prop from `App.jsx`; tapping a segment
  navigates. Drilling into a detail and backing out keeps the segment correct
  because it's route-derived, not local state. `App.jsx` routes `routines` →
  `<Library tab="routines"/>` and `exercises` → `<Library tab="exercises"/>`; the
  detail/edit/pick/type sub-routes render their screens directly (unchanged).

- **Workouts tab (interim)** — `src/views/Today.jsx`. Today is unchanged except a
  trailing list with **Schedule** and **History** rows (they're no longer tabs but
  must stay reachable). Added a History row to the no-data empty-state list too
  (it already had Routines/Schedule/Settings). Start is untouched.

- **Settings tab** — existing Settings, reached as the third tab; unchanged.

- **`NavLink` (`src/views/shared.jsx`)** now forwards `...rest` onto the `<a>` so
  the TabBar can set `aria-current`. Additive — existing callers pass none.

### Choices the spec left open (→ DEC candidates)

1. **TabBar hidden during the in-workout flow** (route name starts with
   `workout`). The spec said "CC's call, but the bar should not fight the in-gym
   screens." A persistent bar that could jump you to Library mid-set fights the
   focused gym surfaces (DESIGN: in-gym flow flawless), so it's hidden there.
   `activeTab` still maps those routes → Workouts (for completeness + the test).
   `start` (the picker) keeps the bar.
2. **Reused the existing `SegmentedControl`** for the Library toggle instead of
   building a new primitive. The spec's step 2 asked for "a new segmented-control
   UI primitive in `ui/`" — but one already exists (`ui/index.jsx`, used for
   effort/feel): accessible radiogroup, ≥44px segments, grayscale. Duplicating it
   would be two things to keep in sync. Wired its `onChange` to navigate. **This
   is the one spec/code mismatch** — flagging per "if a requirement contradicts
   the code, the code wins."
3. **`activeTab` lives in `route.js`** (not `ui/`) — it's routing logic keyed by
   route names, and `route.test.js` already covers that file. The TabBar consuming
   it lives in `ui/`.
4. **Icons**: inline currentColor SVG line icons, no asset pipeline (spec allowed
   SVG/emoji/text). Simple, grayscale-consistent; polish is a later pass.

### Verified

`./check` — green:

```
# tests 145
# pass 145
# fail 0
check: green — lint, 14 test file(s), and the build all passed.
```

`activeTab` map (the new block), `node --test src/route.test.js`:

```
ok 3 - activeTab maps every route name to its bottom tab (req-14 / DEC-024)
# tests 13
# pass 13
```

**Could not verify myself:** anything visual/feel — the Chrome extension wasn't
connected this session, so I could not drive the browser. Bar layout, safe-area
behaviour on a real iOS device, active-highlight contrast, the toggle feel, and
that content clears the fixed bar all need Emilio's hands. See the merge-gate
list below.

## Workflow

- **Scope added (small):** History row on the no-data Today empty state — the spec
  only named the populated Today, but History must be reachable there too when
  there's no data; the empty state is still "the Workouts screen."
- **Spec/code mismatch surfaced:** step 2's "new segmented-control primitive" —
  one already exists and was reused (choice #2 above). Suggest the DEC-024 writeup
  note that the Library toggle IS the existing `SegmentedControl`.
- **Choices to record as DEC / behaviour:** TabBar hidden during the in-workout
  flow (#1) is a user-visible behaviour worth a DEC line.
- **Known feel rough edges (for the iteration Emilio expects):**
  - On the Library tab the toggle says "Routines" and the hosted screen's own
    `<h1>` also says "Routines" — redundant. Left as-is (don't redesign the
    screens); a candidate for the feel pass / req-32.
  - Gear/dumbbell/cards icons are functional placeholders, not designed.
  - No merge. ux-feel gate — first designed nav surface; expect iteration.

## Merge-gate — ready to look at (branch `req-14`, `npm run dev`)

1. **What it does:** Replaces the top-left Menu dropdown with a fixed 3-tab bottom
   bar — three link-tabs wearing the Button look, **Workouts** (primary) ·
   **Library** (secondary) · **Settings** (quiet); the current screen's tab is
   underlined. Workouts (Today)
   is now the main workout surface: a big primary **Start** for today's workout, a
   peek of upcoming Schedule and recent History (each with **Show all**). Library
   is a Routines/Exercises toggle over the existing lists. Schedule and History
   aren't tabs — reached from Workouts, with a **Back** to return.
2. **What to test:**
   1. Bottom bar shows three Button tabs (Workouts filled, Library light, Settings
      outlined); no top Menu anywhere.
   2. Tapping each tab lands on that group; the current tab is underlined (and the
      underline moves as you switch screens, independent of the fixed variants).
   3. Content isn't hidden behind the bar; the bar clears the iOS home indicator.
   4. Library shows [Routines | Exercises]; switching swaps the list; each list's
      `+ New`/Add still works.
   5. Open a routine, then Back — the toggle still shows Routines (deep route keeps
      the right tab/segment). Same for an exercise.
   6. On Workouts: today's workout has a big primary Start (works); "Choose a
      workout" opens the picker; the Upcoming peek's items each have a smaller
      secondary Start that starts that future workout; the Recent peek shows recent
      workouts; each "Show all" opens the full Schedule / History page.
   7. On the Schedule and History pages, Back returns you to Workouts.
   8. Start a workout — the tab bar disappears for the in-gym screens, and comes
      back when you leave.
3. **What I couldn't verify:** everything visual/feel — the Chrome extension is
   not connected this session, so I could not drive the browser. Tab-bar Button
   look and the active underline's contrast on each variant, the big-Start layout
   when there are multiple workouts on one day, safe-area on a real device, and
   the peek/Show-all feel all need your hands.
