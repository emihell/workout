# req-14 — new nav: 3-tab bottom bar (Workouts / Library / Settings)

Branch `req-14`. Nav shell only (req-32 timeline merge is out of scope). No
persisted-data / schema change — routing + UI only.

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
   bar — **Workouts** (Today + Schedule/History links) · **Library** (a
   Routines/Exercises toggle over the existing lists) · **Settings**. Schedule and
   History are no longer tabs; they're reachable from the Workouts (Today) screen.
2. **What to test:**
   1. Bottom bar shows three tabs; no top Menu button anywhere.
   2. Tapping each tab lands on that group; the active tab is visibly highlighted.
   3. Content isn't hidden behind the bar; the bar clears the iOS home indicator.
   4. Library shows [Routines | Exercises]; switching swaps the list; each list's
      `+ New`/Add still works.
   5. Open a routine, then Back — the toggle still shows Routines (deep route keeps
      the right tab/segment). Same for an exercise.
   6. From Today, Schedule and History both open; Start still works.
   7. Start a workout — the tab bar disappears for the in-gym screens, and comes
      back when you leave.
3. **What I couldn't verify:** everything in the "Could not verify" note above —
   all of it is visual/device/feel and needs your hands.
