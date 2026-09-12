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

## Review iteration 3 (Emilio, 2026-09-12)

One CSS fix, same branch, not merged. Emilio: *"primary button text is black."*

**Cause (a specificity bug the iter-2 DEC-016 fix exposed):** making the tabs `<a>`
put them under the global anchor reset `a, a:visited, a:hover, a:active { color:
inherit }`. The state selectors there are `(0,1,1)`, which outranks the variant
class `.ui-btn--primary { color: var(--ui-bg) }` `(0,1,0)`. The active tab links to
the current page, so the browser treats it as `:visited` → text falls back to
`inherit` (ink) on the ink-primary background = **black-on-black**. Plain state was
fine; only the current tab (visited/hover) broke.

**Fix** (`ui.css`, right after the reset): re-assert each variant's color for a
button-styled anchor across all states —
`a.ui-btn--primary{,:visited,:hover,:active}` → `var(--ui-bg)`; the secondary/quiet
selectors → `var(--ui-ink)`. Specificity `(0,2,1)` (class + pseudo) beats the
reset's `(0,1,1)`. Chose the general `a.ui-btn--*` form over a tab-bar-scoped
selector so any future anchor wearing `.ui-btn` is covered too.

**Verification is by specificity reasoning, not the browser** (extension still not
connected): the winning rule is `(0,2,1)` vs the reset's `(0,1,1)` for every state
(`:visited`/`:hover`/`:active` and the base), so the primary tab's text resolves to
`--ui-bg` in all states and secondary/quiet stay `--ui-ink`. `./check` green.

## Review iteration 4 (Emilio, 2026-09-12)

Three changes on the Workout screen + the tab label, same branch, not merged:

1. **Tab label "Workouts" → "Workout"** (singular) — `TABS` in `ui/index.jsx`. Only
   the label; `id` (`workouts`), route (`/`) and `activeTab` unchanged.
2. **Section order → Upcoming → Today → Recent** (`Today.jsx`). Header (greeting /
   "Week x of y" / "In progress · Continue") stays at the very top; **Upcoming**
   (with its Show all) moved above **Today**; **Completed today** stays grouped with
   Today (middle); **Recent** (with its Show all) stays at the bottom.
3. **"Choose a workout" → a big bottom CTA.** Removed the inline
   `<NavLink>Choose a workout</NavLink>` from the Today section. Added, as the last
   element on the screen (after Recent, directly above the fixed tab bar), a large
   secondary block CTA to `/start`, labelled **"Workouts"** (plural — Emilio's call;
   the tab is singular "Workout"). Kept the `!mine` visibility guard.
   - **Implementation note (DEC-016):** rendered as a `NavLink` wearing the
     `ui-btn ui-btn--secondary ui-btn--block` classes — the big-secondary-block
     *look* asked for, but a link, since it's pure route nav to `/start`. Same
     pattern the tab bar now uses; keeps the iter-2/3 DEC-016 fix consistent
     instead of reintroducing a `<button>`+`go()`. Say if you specifically want a
     `<button>` here.
   - Added `text-decoration: none` to the base `.ui-btn` so a button-styled anchor
     (`a.ui-btn`) shows no UA underline — the CTA and any future `a.ui-btn` read as
     a button. The tab bar's active-underline still wins (`.is-active`, higher
     specificity).

`./check` re-run after iteration 4 — green (145 tests, lint, build).

## Review iteration 5 (Emilio, 2026-09-12)

Two changes on the Workout screen, same branch, not merged:

1. **Bottom CTA → "Routines", de-styled.** The `/start` CTA is no longer a
   big-secondary-block NavLink; it's now a plain nav row — `<List><Row to="/start">
   Routines</Row></List>` — matching the "Show all" rows for consistency (Emilio:
   *"should be consistent."*). Kept at the bottom, kept the `!mine` guard, kept the
   `/start` target. *(Note: the target is still the workout picker `/start`; only
   the label changed to "Routines" per Emilio.)*
2. **Unified row info across Upcoming / Today / Recent / Completed-today.** One
   shared renderer `WorkoutInfo({ when, name, focus })` (`Today.jsx`) now formats
   every workout row's information the same way: **`[when] · [name] — [focus]`**.
   - `when`: weekday (Upcoming), date (Recent — via `whenLabel`), "Today" (Today &
     Completed-today).
   - `name`: `routine.name` for schedule items; `workoutRoutineName(workout,
     routine)` for history items.
   - `focus`: `routine.focus` for schedule items; **`workout.snapshot.focus`** for
     history items — the immutable snapshot value (DESIGN §3: history is a
     snapshot), which `planSnapshot` already stores. **Degrades gracefully**: if a
     snapshot has no focus (older data) or the routine was deleted, the "— focus"
     is dropped, never invented (DESIGN §1).
   - **Actions/status untouched**, as instructed: Today's big primary Start, the
     Upcoming Start-ahead, the Upcoming `Done …` value, in-progress hiding, the
     history-detail links — all exactly as before. Only the info text/layout was
     unified.
   - **Dropped for consistency:** history rows (Recent, Completed-today) previously
     prefixed the **program name** (`program — routine`). The unified format has no
     program field — schedule items (Upcoming/Today) have no program to show, so
     showing it only on history rows would defeat "the same info the same way".
     Flagging in case Emilio wants program surfaced (it would need resolving a
     program for schedule items too, or a different shared field).

`./check` re-run after iteration 5 — green (145 tests, lint, build).

## Review iteration 6 (Emilio, 2026-09-12)

Six changes on the Workout screen (the layout Emilio wants), same branch, not
merged. Resulting order: header → **Upcoming›** (+items) → **Today** (emphasized,
spaced) → Completed today → Recent items → **View past›** → **Routines›** (bottom).

1. **One shared `when` format on all rows.** New `weekdayDate(key, now?)` in
   `history/helpers.js` — **weekday + short date, e.g. "Mon, Oct 13"**, appending
   `, YYYY` only when the year isn't the current year (older history → "Sun, Oct 13,
   2024"). Upcoming, Today, Recent and Completed-today all render `when` through it.
   *This is the chosen default and is Emilio-tweakable.* Smoke-checked:
   `weekdayDate('2025-10-13')` → "Mon, Oct 13"; `'2024-10-13'` → "Sun, Oct 13, 2024".
   (No unit test: the check gate globs `src/*.test.js` only, and this is a display
   formatter with an injectable `now`; verified by the smoke run above.)
2. **Removed the "Today" and "Recent" section headers.** The date format, Today's
   emphasis (#6), and spacing carry the meaning. The top header (greeting / "Week x
   of y" / "In progress · Continue") stays.
3. **"Upcoming" header is now the link to `/schedule`** (a `NavLink` with a forward
   chevron inside the `SectionHeader`); the separate "Show all" row under Upcoming
   is gone.
4. **Recent's link renamed "Show all" → "View past"** (target still `/history`);
   Recent is now just its items followed by that link (no header).
5. **"Routines" is the absolute bottom element**, directly above the fixed tab bar
   (unchanged position, now confirmed as the last thing on the screen).
6. **Today is the focal point:** `.ui-today-workout` gets `--ui-s4` vertical space
   and its name is title-size / 700 weight — clearly heavier than the body-size
   Upcoming/Recent rows. Its big primary Start is unchanged.

Actions/status all unchanged (Start, Start-ahead, Done value, in-progress hide,
history links). **"Completed today" note:** the peer's stated order didn't mention
it; I kept it between Today and Recent (where iter 4 put it), with its own header —
change 2 only removed the Today/Recent headers. Flag if it should move or lose its
header too.

`./check` re-run after iteration 6 — green (145 tests, lint, build).

## Review iteration 7 (Emilio, 2026-09-12)

Three changes on the Workout screen, same branch, not merged. Resulting layout:
header → **Upcoming›** (plain link) → items → **Today** (emphasized) → Completed
today → recent items → **Previous›** (plain link) → …gap… → **Routines›** (pinned
to the viewport bottom, above the tab bar).

1. **"Upcoming" matches "Previous".** Dropped the repurposed section-header styling;
   "Upcoming" is now the **first `Row` link of the upcoming list** (→ `/schedule`)
   and "Previous" the **last `Row` link of the recent list** — identical body
   typography + trailing chevron, bookending their sections.
2. **"View past" → "Previous"** (target still `/history`).
3. **"Routines" pinned to the screen bottom.** The Workout `Screen` is now a
   full-height flex column (`ui-screen--fill`) and the Routines element
   (`ui-pin-bottom`) has `margin-top:auto`, so on a short screen it drops to just
   above the fixed tab bar (the empty gap falls between Previous and Routines) and
   on a long screen it stays the last in-flow element — not sticky/fixed.
   - CSS: `.ui-screen--fill { display:flex; flex-direction:column; box-sizing:
     border-box; min-height: calc(100dvh - 72px - env(safe-area-inset-bottom)); }`
     — the min-height mirrors `<main>`'s reserved tab-bar space so the column
     reaches the bar's top; `dvh` tracks mobile browser chrome. Scoped to this
     screen via the modifier class, so other screens are untouched.

Order, Today emphasis, the shared date format, and all actions/status are
unchanged. **Verified by reasoning, not the browser** (extension still not
connected): the pin is a standard `margin-top:auto` flex spacer; the risk is the
`min-height` value vs the real tab-bar height on a device — that's the one thing to
eyeball. `./check` green.

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
   6. On the Workout tab, top-to-bottom: header → **Upcoming›** (plain link →
      Schedule) + items → **Today** (title-size, spaced, the focal point) →
      Completed today → Recent items → **Previous›** (plain link → History) →
      …gap… → **Routines›** (pinned just above the tab bar → the picker). "Upcoming"
      and "Previous" look identical. On a short screen Routines sits at the bottom
      with the gap above it; on a long screen it's the last row and the page
      scrolls. Every row's info reads the same way — `[when] · [name] — [focus]`,
      `when` in one format ("Mon, Oct 13"), focus omitted where absent. Today's big
      primary Start and the Upcoming Start-ahead work.
   7. On the Schedule and History pages, Back returns you to Workouts.
   8. Start a workout — the tab bar disappears for the in-gym screens, and comes
      back when you leave.
3. **What I couldn't verify:** everything visual/feel — the Chrome extension is
   not connected this session, so I could not drive the browser. Tab-bar Button
   look and the active underline's contrast on each variant, the big-Start layout
   when there are multiple workouts on one day, safe-area on a real device, and
   the peek/Show-all feel all need your hands.
