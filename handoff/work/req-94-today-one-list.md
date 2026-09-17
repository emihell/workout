# req-94 — Today: merge "Completed today" + recent into one stateful list, kill the double-divider gap (gym-flow batch 3, note n5)

**Status: READY.** From Emilio's in-app note (2026-09-16, `/`):
*"Complete today has a divider under it — then the history has a divider over it —
creating a small white space. I think these components need to be reworked into a list —
with different states in the list — to get rid of things like I just mentioned."*

**Gate: ux-feel** (visual structure; no data/logic change).

## Why

[measured] The Today screen renders "Completed today" and the recent-history peek as two
**separate `<List>` blocks** with their own section headers (`src/views/Today.jsx` ~319–333:
`<SectionHeader>Completed today</SectionHeader>` + `<List>` … then a second `<List>` for
`recent`). Each list draws its own top/bottom rule, so the boundary between them stacks a
divider-under + divider-over → a thin white gap. Emilio wants these unified into **one list
whose rows carry their state**, so there's no seam.

## The behaviour (decided with Emilio, 2026-09-17)

- **One list** covering completed-today sessions and recent history, instead of two adjacent
  `<List>`s with the seam between them.
- **Row state, not separate lists:** a completed-today row and a recent-history row differ by
  their own treatment within the single list (they already are distinct components —
  `CompletedTodayRow` vs `HistoryPeekRow`), not by living in a separate boxed list.
- No double divider / white gap at the completed↔recent boundary.
- The existing section ordering intent is preserved (upcoming → Today hero → completed today →
  recent → `Previous›`), just without the seam. A single lightweight label/heading is fine if
  it still reads as one continuous list.

## Scope

- `src/views/Today.jsx` — the render around the two `<List>` blocks (~288–333) and their
  section headers.
- `src/ui/ui.css` — `.ui-list` / row-divider rules if the seam is a CSS artifact of adjacent
  lists (prefer fixing the structure over one-off overrides).

## Out of scope

- What counts as "completed today" or "recent" (the `completedToday` / `recent` computation,
  ~228–248) — data selection is unchanged.
- The Today hero / upcoming block, the `Previous›` link target, history detail.
- Any change to what a row links to or its actions (Start / Done / history link stay).

## Watch-outs (CC)

- The recent peek deliberately **excludes** the set already shown under "completed today"
  (comment at Today.jsx ~228–239) — preserve that de-dup when merging; don't show a session
  twice.
- Empty states: completed-today-only, recent-only, and both-empty (there's already a
  both-empty branch ~328) must each still read cleanly with no orphaned header or stray rule.
- Stale/unfinished workouts surface in the recent peek (req-55) — keep them appearing correctly
  in the merged list.

## Acceptance criteria

- **No gap (browser):** on Today with at least one completed-today session and recent history,
  there is no white seam / stacked divider between them — it reads as one continuous list.
- **State legible (browser):** a completed-today row and a recent-history row are still
  distinguishable within the one list.
- **No duplication (browser):** a session completed today appears once, not in both a
  "completed" area and the recent list.
- **Empty states (browser):** completed-only, recent-only, and both-empty each render without an
  orphaned header or dangling divider.
- **No regression:** `./check` green.

## Decisions

- One stateful list, no seam (Emilio, 2026-09-17).
- Exact heading treatment and how row-states are visually differentiated — implementation (CC),
  within "reads as one list, states still legible, no double divider."
