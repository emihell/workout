# req-14 — redesign the nav / menu

**Status: NEEDS DECISION** — Emilio wants the menu redesigned but the *direction* isn't chosen yet.
Do not build until the direction below is decided. The current menu **stays as-is meanwhile** (it's
a functional placeholder from req-13, not the final design).

**Gate: ux-feel** (DEC-009) — it's the app's primary navigation on mobile; Emilio's hands, and it
will iterate.

## Why

req-13 shipped a functional stopgap: a top-left **`Menu`** button that toggles a plain list of all
six nav items (Today, Schedule, Routines, Exercises, History, Settings), closing on item-click or
outside-click (DEC-019). Emilio: *"not a fan of the menu."* It works but isn't a designed navigation
— it reads as a basic dropdown, not the clean mobile nav the app wants.

## The open decision — which direction?

Candidate patterns (to choose with Emilio before this becomes READY):

- **Bottom tab bar** (the Apple-mobile idiom). Tabs sit at the bottom, thumb-reachable. Caveat: HIG
  caps tabs at ~5, and there are 6 destinations — so this re-opens "which items are primary" (a tab
  subset, e.g. Today / Schedule / History, + a "More" tab or a gear for the rest). Note this partly
  reverses DEC-019 (everything-in-menu) by re-surfacing a primary subset.
- **Slide-up sheet / drawer** (iOS sheet). The `Menu` button opens a proper sheet that slides up
  from the bottom with the items as large rows — keeps everything in one place but feels native and
  tap-friendly, not a dropdown.
- **Side drawer** (hamburger → slide-in panel from the edge). Familiar, holds all six, but less
  Apple-idiomatic than a sheet or tabs.
- **Cleaner top menu** — keep the toggle model but design it properly (icon, larger rows, animation,
  a backdrop).

The choice interacts with **DEC-018/019** (what's primary vs in a menu) and **DEC-010** (mobile-
primary, thumb reach) — a bottom tab bar is the most thumb-friendly for the daily destinations.

## Out of scope (until decided)

- Any build — this is parked on the direction decision.
- Changing the current req-13 menu (it stays until this ships).

## Notes

Once Emilio picks a direction, this gets fully specced (which items where, the exact interaction,
the component) and moves to READY. Usage analytics (req-08) can inform which destinations are
actually used and therefore deserve to be primary / thumb-reachable. Pairs with the styling pass —
this is one of the first "designed" (not just componentized) surfaces.
