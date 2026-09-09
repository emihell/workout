# req-05 — error boundary so a render crash doesn't blank the app mid-workout

Branch: `req-05-error-boundary`.

## Technical

### What changed

**`src/error-boundary.js` (new)** — a small `ErrorBoundary` class component:
- `static getDerivedStateFromError()` → `{ hasError: true }` (the method React calls when a
  descendant throws during render).
- `componentDidCatch(error, info)` → logs to `console.error` (no telemetry — out of scope).
- `render()` returns `children` normally; on error returns a self-contained fallback that reads
  **no** store/app state (the state is what may have crashed): a "something went wrong" line, a
  reassurance that logged sets/workouts are saved on this device, a **Reload** button
  (`location.reload()`), and a **Back to Today** link (`#/`).
- Authored with `React.createElement`, not JSX, so `node --test` can import the real component
  directly (the test runner has no JSX transform). App code is bundled by Vite, which handles
  either.

**`src/App.jsx`** — import `ErrorBoundary` and wrap `<Screen />` with it *inside* `<main>`:
```jsx
<main>
  <ErrorBoundary>
    <Screen />
  </ErrorBoundary>
</main>
```
So a screen crash keeps `SaveFailedBanner` and `Nav` visible; only the screen area is replaced
by the fallback.

**`src/error-boundary.test.js` (new)** — renders a child that throws **in render** inside the
boundary and asserts the fallback appears (see below).

**`package.json` / `package-lock.json`** — added `react-test-renderer@^19.2.8` as a
**devDependency** (see the choice note).

### Implementation choices the spec left open (spec step 2: "CC's call")

1. **`react-test-renderer` for the test.** A faithful "throw in render → fallback" test needs a
   real reconciler; error boundaries are a client-reconciler feature. I verified `react-dom/server`
   (`renderToStaticMarkup`) does **not** catch them — the throw escaped — so SSR can't test this.
   The repo had no DOM (`jsdom`/`happy-dom`) and no test renderer. `react-test-renderer` is the
   DOM-free, purpose-built tool, renders synchronously via `create()` inside `act()`, and works
   with React 19.2. It is a **devDependency only** — no app code imports it, so it is not in the
   production bundle. It prints a one-line "deprecated" `console.error` on each `create()`; the
   test stubs `console.error` around each render, so `./check` output stays clean and I can also
   assert `componentDidCatch` logged the real error. (If you'd rather not carry a deprecated dep,
   the alternative is `jsdom` + `react-dom/client`, which is heavier — pulls a DOM — for the same
   proof. Flagging for your call.)

2. **Fallback recovers navigation, not just reload.** When `hasError` is true the boundary shows
   the fallback *instead of* `<Screen/>`; a plain hash change (Nav or the Today link) would
   otherwise re-render but still short-circuit to the fallback, leaving the user stuck until a
   hard reload. So the boundary clears its error flag on `hashchange` (guarded by
   `typeof window !== 'undefined'` so the DOM-less test renderer doesn't touch `window`). Effect:
   navigating to a working screen recovers without a reload; navigating back to the still-broken
   screen re-shows the fallback (throw → caught → fallback, no loop). This is slightly beyond the
   literal three steps (which list only message + Reload + Today link) — included so "the user can
   navigate out" is real, not decorative. Easy to drop if you want it more minimal.

3. **Copy** is the placeholder the spec called polish — plain, no styling (app has zero CSS).

### Verification (receipts)

`react-dom/server` does not catch boundary errors (probe, why the test uses `react-test-renderer`):
```
THREW_OUT: render boom
```

New test — throws during render (not an event handler, so it tests what boundaries actually catch):
```
# Subtest: renders a fallback (not a blank tree) when a child throws during render
ok 1
# Subtest: renders children unchanged when nothing throws
ok 2
# tests 2  # pass 2  # fail 0
```

`./check` — green:
```
check: running 10 test file(s) (node --test)…
# tests 59
# pass 59
# fail 0
check: building (vite build)…
check: green — lint, 10 test file(s), and the build all passed.
```
The pre-existing oxlint warning (`src/views/Routine.jsx:13`, fast-refresh export) is unrelated and
untouched.

### What I could not verify myself (needs a browser — the "use it" gate)

- **Data survives a real crash + reload:** trigger a render throw on a screen mid-workout, see the
  fallback (not a blank page), click Reload, and confirm the active workout is still there
  (`localStorage` `workout-mvp-v8` intact — the boundary never writes state).
- That the fallback **reads well and looks right** in place (unstyled), and that Nav / the Today
  link / hashchange-recovery feel right when clicked.

## Workflow

- Added one devDependency (`react-test-renderer`) — the only DOM-free way to prove the boundary
  catches a *render* throw; no app dep added. Worth an `L-` note: **the repo has no React
  rendering-test setup**, so any future component-render test either uses this or adds a DOM. If we
  expect more of them, deciding on a standard (react-test-renderer vs jsdom + testing-library) is a
  small up-front call worth making deliberately.
- Went one step beyond the literal spec (hashchange-recovery, choice #2) to make "navigate out"
  actually work; flagged so it can become a `DEC-` or be trimmed. Everything else is exactly the
  three ordered steps.
- No decisions taken that need Emilio mid-build; copy is the placeholder the spec marked as
  review-time polish.
