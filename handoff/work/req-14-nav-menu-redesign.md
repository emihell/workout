# req-14 — new nav: 3-tab bottom bar (Workouts / Library / Settings)

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-14` (`52515fa`…`ba5ccd0`, 9 commits).**
Source: Emilio disliked req-13's Menu dropdown; direction decided 2026-09-12. Decision: DEC-024.
Type: Navigation / UI shell (no persisted data). Gate: ux-feel → Emilio's hands before merge
(this is the app's primary navigation on mobile; expect iteration — first "designed" nav surface).

## Why

req-13 shipped a functional stopgap: a top-left **Menu** button toggling a flat list of six items
(Today/Schedule/Routines/Exercises/History/Settings). Emilio: *"not a fan of the menu."* DEC-024
regroups those six into **three bottom tabs** and this req builds that shell. The hardest piece —
merging Today+Schedule+History into one unified scroll — is **req-32**, built after this; here the
**Workouts** tab lands on the existing Today screen with Schedule/History reachable (the interim).

## Scope

**In:**
1. **A bottom tab bar** — fixed to the bottom of the viewport, three equal tabs, replacing the
   top-left Menu (`NavBar` in `ui/index.jsx`, mounted `App.jsx:179`). Tabs, in order:
   - **Workouts** (route `/` — today) · **Library** (route `/routines`) · **Settings** (`/settings`).
   - Each tab: an icon + label, tap target ≥44px (DESIGN), the active tab visibly highlighted from
     the current route. Fixed bar must not overlap content: add bottom padding to the scroll area and
     honour the iOS home-indicator safe area (`env(safe-area-inset-bottom)`).
   - Remove the `Menu` toggle + its open/outside-click state and `NAV_ITEMS`; the six-item dropdown
     is gone. (`route.js` route *names* stay — only the chrome changes.)
   - **Active-tab logic must be a small, testable pure function** `activeTab(routeName)` → which of
     the three tabs is current, so a deep route (e.g. `routine-exercise-edit`, `schedule-slot`,
     `history-edit`) still lights the right tab. Map every existing route name to its tab (routines/*
     and exercises/* → Library; schedule/*, history/*, today → Workouts; settings → Settings; an
     in-workout route → Workouts). Unit-test this map.
2. **Library tab — a segmented [Routines | Exercises] toggle** hosting the **existing** Routines and
   Exercises screens, both first-class, `+ New` per list unchanged.
   - A new **segmented-control** UI primitive (two+ segments, one active, keyboard/tap accessible) in
     `ui/`. The toggle switches which list shows. Which segment is active follows the route
     (routines/* → Routines, exercises/* → Exercises) so drilling into a routine and backing out
     keeps the toggle correct; tapping a segment navigates to that list's route.
   - **Do NOT redesign** the Routines or Exercises screens — only host them under the toggle. Their
     internal routes/behaviour (create/edit/pick, the routine editor from req-30, etc.) are untouched.
3. **Workouts tab — interim** (until req-32): lands on the **existing** Today screen. Add reachable
   **Schedule** and **History** entry points from it (links/rows — the "Today home + links" pattern),
   since neither is a tab any more and both must stay reachable. Start stays on Today as it is.
4. **Settings tab** — the existing Settings screen, unchanged, now reached as the third tab.

**Out of scope (do NOT do):**
- **The unified Workouts scroll** — that's req-32. Here Workouts = today + links; no merge yet, no
  inline schedule editing, no timeline scroll.
- **Redesigning Routines / Exercises / Schedule / History / Settings screen internals.** This req
  changes the *nav chrome and grouping*, not the screens themselves.
- **No persisted-data / schema change**, no `localStorage` write. Routing + UI only. (`route.js`'s
  `sessionStorage` back-stack is unrelated and stays.)
- No new icon-asset pipeline — use simple inline SVG/emoji/text icons consistent with the app; polish
  is a later pass.

## Ordered steps

1. `activeTab(routeName)` pure fn + `ui/` — map each `route.js` route name to Workouts/Library/
   Settings; unit-test the map (every route name resolves; deep routes light the right tab).
2. Segmented-control primitive in `ui/` (accessible: role, active state, tap/keyboard).
3. Replace `NavBar` with the bottom `TabBar` (3 tabs, icon+label, active from `activeTab`, fixed +
   safe-area + content bottom-padding); remove `NAV_ITEMS` and the Menu toggle. Keep it mounted where
   `NavBar` was (`App.jsx`), rendering nothing during an in-workout flow only if that's how it reads
   best — CC's call, but the bar should not fight the in-gym screens (note whichever you choose).
4. Library: wrap the existing Routines/Exercises screens under the segmented toggle, active segment
   from the route, segment tap navigates.
5. Workouts interim: add Schedule + History entry points to the Today screen.
6. `./check`; browser-walk (below).

## Acceptance criteria (write before implementing)

- [ ] The app shows a **bottom bar with three tabs** — Workouts, Library, Settings — and no top Menu
      dropdown. The bar is thumb-reachable and doesn't overlap content (safe-area respected).
- [ ] Tapping each tab navigates to that group; the **active tab is highlighted**, and a deep route
      (edit a routine, open a schedule slot, edit a history entry) still highlights the correct tab
      (`activeTab` unit test green).
- [ ] **Library** shows a [Routines | Exercises] segmented toggle; each side is the existing list with
      its `+ New`; switching segments swaps lists; drilling into a routine and backing out keeps the
      right segment active.
- [ ] **Workouts** lands on today's screen, and **Schedule** and **History** are both reachable from
      it. **Start** still works from today.
- [ ] **Settings** opens from its tab, unchanged.
- [ ] Routines/Exercises/Schedule/History/Settings screen internals are unchanged (diff shows nav +
      hosting only). `./check` green; report `reports/req-14.md`.

## Notes for the builder

- Merge-gate visible change: the whole navigation model changes — call out the tab bar, the Library
  toggle, and that Schedule/History moved under Workouts (reachable, not a tab).
- This is the **first designed nav surface** and will iterate on feel (tab icons/labels, bar height,
  active style, segmented look). Ship a clean, sensible default; Emilio tunes from there.
- Deliberately does not touch the timeline merge — keep this diff about the shell so req-32 can build
  the unified Workouts scroll on a stable nav.
