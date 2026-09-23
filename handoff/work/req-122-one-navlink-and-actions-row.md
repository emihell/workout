# req-122 — one NavLink with a `look` prop, and an Actions row primitive (audit Tier 2)

**Status: SPEC — READY, held for Emilio's go.** Phase 1. **[ux-feel]** A wide refactor across views, so an
**independent reviewer** runs before merge (DEC-035: wide blast radius). No stored data.

## Why [measured, re-verified on main 4172e3d]

- There are two components called `NavLink`: the library one (`ui/index.jsx:33`, adds `ui-navlink`) is imported by
  **0** views. Every view imports the base `views/shared.jsx:13` NavLink and hand-adds classes: `ui-btn …` 12× (DEC-040
  button looks), `className="ui-navlink"` ~18×. `ExercisesLink` types its chevron by hand (`shared.jsx:~47`).
- The two-action row `<div className="ui-actions">` is hand-written 12×. Order (retreat left, forward right, DESIGN §4)
  is kept by convention only.

## The behaviour (visual output unchanged)

1. **One NavLink.** The library NavLink gains `look="link" | "quiet" | "secondary" | "primary"` (default `link` =
   today's `ui-navlink`) and `block`. Views import it; no view hand-writes `ui-btn` / `ui-navlink` classes on a link.
   The base `shared.jsx` NavLink stays as the internal building block (or is merged into it); `chevron` keeps working.
   `ExercisesLink` uses `chevron="back"`.
2. **`Actions` primitive** in `ui/index.jsx`: `<Actions retreat={…} lateral={…} forward={…} />` (or ordered children),
   rendering `.ui-actions` with retreat first, lateral in the middle, forward last. The 12 sites use it.
3. Showcase shows the NavLink looks and an Actions row (req-123 fills in the rest).

## Scope

`ui/index.jsx`, `views/shared.jsx`, every view using the hand-written classes, `Showcase.jsx`, tests.

## Order vs siblings

After req-121 (same call sites), before req-123 (Showcase and CSS).

## Acceptance criteria

- **Static (measured):** `grep` for `className="ui-btn` / `` className={`ui-btn `` and `className="ui-navlink"` under
  `src/views` → 0; `className="ui-actions"` under `src/views` → 0.
- **Visual equality (screenshots before/after, 390x844):** Today, overview, the log screen, Finish, the routine editor,
  History detail, Settings. They look identical, with no layout shift. Attach the before/after pairs.
- **Failure case — order:** an Actions row given forward and retreat renders retreat first in the DOM (unit/static).
- **No regression:** `./check` green; existing tests unmodified, or named and justified.

## Decisions

- API shape (`look`, `block`, `Actions` props) is implementation (CC). Visual output must not change.
