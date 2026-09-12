# req-41 — warn when another tab changes the data (audit F-RISK-3)

**Status: BUILT AND MERGED, 2026-09-12 — branch `req-41` (`1171e95`…`1171e95`, 1 commit).** Decision made (DEC-029). From audit 2026-09-12 (F-RISK-3).
**Gate: functional** — warn-only, writes no data; the real check is a two-tab
browser test (planning attempts it; else Emilio). Not a persisted-data *change*.

## Why

Each open tab holds its own in-memory React state and `saveState` writes the whole
`workout-mvp-v8` key. There is **no `storage`-event listener** (grep for
`addEventListener('storage'`/`onstorage` across `src` → none). So two open tabs are
last-writer-wins: finish a workout in tab A (persists `H+A`); finish another in tab
B, which still holds `H`, and B writes `H+B`, **clobbering A's workout** with no
warning. Plausible on desktop where tabs stay open. [audit F-RISK-3]

## The behaviour (decided — DEC-029)

**Warn only, no merge.** Add a `storage`-event listener; when another tab writes
`workout-mvp-v8` (or clears storage), show a **distinct persistent banner** —
"Another tab changed your data — reload to see the latest." (a reload affordance is
welcome). No auto-merge (reconciling two histories is error-prone without a backend
— backend/Phase-3 territory) and no hold-saves. **Note:** warn-only does not
*prevent* a determined clobber (an ignored-banner tab can still overwrite on its
next save) — by DEC-029's design it surfaces the condition, it doesn't reconcile.

## The fix — pure predicate + thin wiring (L-007)

- Add a **pure predicate** to `storage.js`, e.g. `isExternalStateChange(event)` →
  `event.key === STORAGE_KEY || event.key === null` (a `null` key means
  `localStorage.clear()` — also a change). Pure, unit-tested.
- Add a signal + subscribe wired to a single `window` `storage` listener, mirroring
  the `saveFailed`/`loadUnreadable` trios: on an event where
  `isExternalStateChange(event)` is true, latch the signal. Register the window
  listener lazily (on first subscribe) and clean up on last unsubscribe; guard
  `typeof window !== 'undefined'` so `node --test` importing `storage.js` is safe.
- `App.jsx`: a distinct `ExternalChangeBanner` via `useSyncExternalStore`, separate
  from `SaveFailedBanner`/`LoadUnreadableBanner`, persistent (a reload clears it —
  the tab re-reads the latest on mount).

The listener wiring + banner aren't unit-testable (no `window`/JSX under the gate,
L-007); the predicate is. The end-to-end is the two-tab browser check.

## Scope

- Pure predicate + a `storage`-event-backed signal in `storage.js`.
- `ExternalChangeBanner` in `App.jsx`.
- Test the predicate in `storage.test.js`.

## Out of scope

- Any merge/reconcile of two tabs' state (DEC-029 — not now).
- Holding saves after an external change (DEC-029 chose warn-only, not hold).
- Any change to `saveState`/`loadState` write/read behaviour.

## Ordered steps

1. `storage.js`: `export function isExternalStateChange(event)` (pure); a signal
   trio (`getExternalChanged`/`subscribeExternalChange`) whose subscribe lazily adds
   the `window` `storage` listener (window-guarded) and latches on a matching event.
2. `App.jsx`: render `ExternalChangeBanner` from the signal, distinct wording,
   alongside the other two banners.
3. Test (`node --test`, `storage.test.js`): `isExternalStateChange` is true for
   `{key:'workout-mvp-v8'}` and `{key:null}`, false for `{key:'workout-mvp-analytics'}`
   and `{key:'something-else'}`.

## Acceptance criteria (written before implementation)

- `isExternalStateChange` unit test passes (the four cases above). Command + output.
- The window listener is window-guarded so `storage.js` still imports under
  `node --test` (existing storage tests stay green).
- `./check` green — paste the line.
- **Two-tab browser check (the real gate):** open the app in two tabs; finish/log
  in tab A; tab B shows the banner. Planning attempts this in-browser; if
  impractical, Emilio confirms. (L-001: snapshot the real key first if testing on a
  real profile — use a throwaway/dev origin.)

## Decisions

- **behaviour (Emilio, DEC-029):** warn + reload, no merge, no hold-saves.
- **implementation (CC's call):** exact signal plumbing; banner wording/reload
  affordance; lazy-listener lifecycle.

## Notes

The `storage` event fires only in *other* same-origin tabs, never the writer — so
the warning appears in the tab that *didn't* make the change, which is exactly the
one holding stale state. Good.
