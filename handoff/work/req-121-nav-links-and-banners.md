# req-121 — navigation-only buttons become links; app banners use the library (audit Tier 2)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** Presentation only; no stored data. No DEC-057
trigger files.

## Why [measured by the 2026-09-23 UI audit, re-verified on main 4172e3d]

- Navigation-only controls wear `<Button onClick={go…}>`, which breaks DEC-016/DEC-040 (a screen change is a link):
  - `Today.jsx:254` "Start new workout" → `go('/routines')`;
  - `Routine.jsx:97` and `:386` Cancel → `onCancel` = `go(…)` (`:118`, `:431`, `:473`);
  - `workout/setup.jsx:~75` Cancel → `go(…)`.
  - (auto-complete's "Edit" is **not** in this list: since req-116 it writes `autoFinishDismissed` before navigating,
    so it's an action and stays a Button.)
- `App.jsx:36,54,73` are raw `<div role="alert">` banners with no class (browser default), and `:75` Reload is a raw
  unstyled `<button>`. The library has `Banner` (`ui/index.jsx:218`) and `Button`.
- `history/list.jsx:44-46` puts Continue (forward) left of Abandon (DESIGN §4 spatial rule: retreat left, forward
  right).

## The behaviour

1. Each navigation-only control above becomes a `NavLink` with the button look (DEC-040), with the same label, place and
   look. "Start new workout" keeps its label **(unconfirmed)**: it reads as the action the user wants, even though it
   only opens the routine list.
2. The three App banners use `Banner`, and Reload uses `Button`.
3. `history/list.jsx`: Abandon first (left), Continue last (right).

## Scope

`Today.jsx`, `Routine.jsx`, `workout/setup.jsx`, `App.jsx`, `history/list.jsx`, tests (static-source, the
`item.test.js` pattern).

## Order vs siblings

**First** of Tier 2; req-122 then refactors the same NavLink call sites.

## Acceptance criteria

- **Static:** none of the listed controls is a `<Button>` whose handler only calls `go()`; each is a NavLink.
- **Static:** `App.jsx` has no raw `role="alert"` div and no raw `<button>`.
- **Failure case — Edit stays an action:** auto-complete's Edit is still a `<Button>` and still sets the flag
  (req-116's test passes unmodified).
- **Screenshots (390x844):** Today empty day, the routine item editor, and the History in-progress row. Each looks as
  before apart from the Continue/Abandon order; the save-failed banner is styled.
- **No regression:** `./check` green (receipt quoted).

## Decisions

- DEC-040 pattern (nav = link with the button look). Label kept **(unconfirmed)**.
