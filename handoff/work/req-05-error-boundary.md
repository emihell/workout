# req-05 — error boundary so a render crash doesn't blank the app mid-workout

**Status: BUILT AND MERGED, 2026-09-09 — branch `req-05` (`1e23f0e`…`1e23f0e`, 1 commit).** — a UI hardening req; intent + constraints settled (exact copy is polish, refined at review). Independent of all other reqs.

## Why

There is no React error boundary anywhere (`App.jsx` renders `<Screen />` bare). A render-time
exception on any screen unmounts the tree to a **blank white page**. Mid-workout that reads as
"I lost my session" — even though the workout is safe in `localStorage` (`activeWorkout` is
persisted on every change). For the one flow where a crash hurts most, a blank screen is the
worst possible failure mode. [measured] — no `componentDidCatch`/error boundary in `src/`.

## Scope

- Add one error boundary wrapping the app's screen area (at or just inside `App.jsx`'s
  `<main>`), so a render error on any screen is caught instead of blanking the page.
- Fallback UI: a plain, legible message that (a) reassures the data is saved, (b) offers a way
  to recover — a reload button (`location.reload()`), and (c) optionally a link back to Today.
  Intent: never a blank screen; the user can always get back in and their logged sets survive.
- The boundary must not itself depend on the store/state that may have caused the crash — keep
  its fallback self-contained.

## Out of scope

- Fixing any specific crash (there's no known one — this is the safety net).
- Error reporting/telemetry (no backend; out of scope for the MVP).
- Styling beyond a readable fallback (rides the Phase-1 styling pass).

## Decisions

- **behaviour (default, unconfirmed — refine at review):** fallback says the workout/data is
  saved and offers Reload + a Today link. Copy/exact placement is UI polish, settled when
  Emilio sees it (`rules/WORKFLOW.md`: a UI req is READY on intent + constraints, not final
  appearance).
- **implementation:** class-component boundary vs a small library — CC's call; a tiny class
  component needs no dependency and is the likely choice.

## Ordered steps

1. Add an `ErrorBoundary` (class component with `getDerivedStateFromError` + `componentDidCatch`
   logging to `console.error`) rendering a fallback on error, else `children`.
2. Wrap the screen area in `App.jsx` with it (inside `StoreProvider` so the fallback can offer
   navigation, but the fallback must render even if a child throws on first render).
3. Fallback: message + Reload button + Today link.

## Acceptance criteria (written before implementation)

- **Catches a crash (the point):** a component that throws in render (a temporary test throw, or
  a unit test of the boundary) shows the fallback, **not** a blank page. Prove it with a test
  that renders a throwing child inside the boundary and asserts the fallback text appears.
- **Data survives:** after the fallback shows and the user reloads, `localStorage`
  (`workout-mvp-v8`) is intact and the app returns to a working state with the active workout
  still present. (Human "use it" check; the boundary never writes state.)
- **No regression:** normal screens render unchanged when nothing throws; `./check` green (paste
  the line).
- **Right mechanism (failure case):** the boundary catches a *render* error specifically — the
  test throws during render, not in an event handler (React error boundaries don't catch the
  latter), so the criterion tests what boundaries actually protect.

## Notes

Small, high-trust-payoff. Pairs naturally with `req-01`: `req-01` stops silent *save* loss,
this stops a silent *render* blank — together they cover the two ways the app could look like it
ate your data.
