# req-50 — Everything clickable uses a library component (no bare text links)

**Status: READY** (intent + constraints settled; a UI sweep, iterated on the feel
gate per WORKFLOW "a UI requirement is not finished when written"). From Emilio
2026-09-12: *"These are some 'buttons' that are still just link text - these should
also use components - everything should use components - Scan the app for similar."*

**Gate: ux-feel** — planning builds + tests + merges on its own testing (DEC-035);
Emilio's on-device look is the non-blocking after-check.

## Why

The component library exists (`ui/index.jsx`: `Button`, `NavLink`, `List`/`Row`,
`Field`, …; DEC-016 fixed the semantics — navigation is a link, an action is a
`<button>`). Most screens migrated in req-15, but some clickables are still **bare,
unstyled text** rather than a library component, so they read as loose link-text next
to the button/row-styled rest of the app.

[measured] Found in a scan:
- **Bare `NavLink` text used for actions/exits**, wrapped in a raw `<p>`:
  `Schedule.jsx:140` "Add routine", `:143` "Done", `:96` "Cancel" — plain underlined
  text, not the `Button`/row treatment used elsewhere.
- **A raw `<a>`** not going through the `NavLink` primitive: `workout/item.jsx:59`
  (`<a href={...}>{name}</a>`).
- `Back`/`ExercisesLink` (`shared.jsx`) render bare in a `<p>` too — coordinate with
  req-49 (which changes `Back`'s target); do `Back` there, not twice.

This is a scan requirement — CC greps the app for the pattern, not just these sites.

## The rule (decided — DEC-016 governs the semantics)

Every clickable routes through a library component, and its **kind** picks the
component:
- **Navigation** (changes screen, no state) → the `NavLink` primitive
  (`shared.jsx`/`ui` `NavLink`), styled via the library — never a raw `<a>`, never
  bare unstyled text.
- **Action** (commits/changes state: Save, Cancel-as-dismiss, Remove, Add, Done) →
  `Button` with the right variant. Note DESIGN §4: forward/primary on the right,
  retreat/cancel on the left; use `.ui-actions` markup order, not `row-reverse`.
- **No naked inline text link** anywhere — if it's clickable, it wears a component
  class.

Classification per DEC-016 is CC's call; the constraint is "no bare clickable, right
component for the kind." The exact look (a "Done"/"Add routine" as a quiet button vs
a styled row link) is iterated on the feel gate.

## Scope

- Grep the app for: raw `<a` (outside the `NavLink` primitive in `shared.jsx`),
  `<NavLink>` wrapped in a bare `<p>` acting as an action, and any inline clickable
  not using a `ui-` class.
- Convert each to the correct library component per the rule.
- Confirmed sites to fix: `Schedule.jsx:96,140,143`; `workout/item.jsx:59`; plus
  whatever the grep surfaces.

## Out of scope

- `Back` / `ExercisesLink` target/behaviour — that's req-49; **order req-49 before
  req-50** so this sweep folds the finished `Back` in once (don't restyle a `Back`
  that req-49 is about to rewrite).
- Adding new component types to the library — use what exists; if a genuine gap
  appears (e.g. a standard "inline action row" pattern), flag it, don't invent scope.
- The bottom menu (`TabBar`) — that's the req-52 redesign.
- Any behaviour/route change — this is presentation + component-routing only.

## Ordered steps

1. Grep for the patterns above; list every hit in the report.
2. Convert each: nav → `NavLink` (styled), action → `Button` (correct variant + side).
3. Verify tab/focus order matches visual order where an actions row changed (DESIGN §4).
4. `./check`.

## Acceptance criteria (written before implementation)

- **No raw anchors:** grep for `<a ` in `src/views` returns only the `NavLink`
  primitive definition (`shared.jsx`) — paste the grep.
- **No bare action text:** the confirmed sites (`Schedule.jsx` Add routine/Done/Cancel,
  `item.jsx:59`) now render library components — quote the before/after in the report.
- **Semantics right (failure case):** an *action* that was a link (e.g. a "Cancel"
  that dismisses) is a `Button`, and a *navigation* is a `NavLink` — assert per site
  which kind it is, so the sweep didn't just restyle links as buttons wholesale
  (a grep for "uses a ui- class" would pass while the semantics are wrong).
- **Order/focus:** any changed actions row keeps forward-right/retreat-left and DOM
  order = focus order (DESIGN §4) — confirm in the diff.
- **No regression:** `./check` green — paste the line.

## Decisions

- **behaviour (Emilio):** no bare clickable text; everything uses a component.
- **implementation (CC's call):** per-site nav-vs-action classification (DEC-016);
  exact variant/look, iterated on the feel gate.
