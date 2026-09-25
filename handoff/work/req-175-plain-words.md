# req-175 — plain words in the workout and History

**Status: READY** (2026-09-25). **Lane: ui.** Source: persona run (req-144 prep §E.3). Emilio approved ("6. good", DEC-093).

## Change (display text only)
| today | becomes | where [grep 2026-09-25] |
|---|---|---|
| "WU set", "WU ·" | "Warm-up set", "Warm-up ·" | `workout/item.jsx:424`, `workout/overview.jsx:75`, `history/detail.jsx:131`, `history/helpers.js:21`, `history/edit.jsx:152,196` (+ Builder's full grep) |
| "{n} kg" volume, unlabelled | "{n} kg lifted" (thousands separated, "3,200") | `history/detail.jsx:55`; the finish summary `workout/auto-complete.jsx:76` if unlabelled |
| "Replace exercise" | "Swap exercise" | `workout/replace.jsx:59`, `workout/item.jsx:506` |
| Effort "Failure" | "Couldn't finish" | `ids.js:32,39` |

Builder greps every user-visible occurrence (`grep -rn "WU" src/views src/ui`, etc.) and lists each in the report.

## Out of scope
The routine form's words ("Role", "WU routine", the "WU set" checkbox `Routine.jsx:351`, "Focus", "Rest (s)", "12/11/10")
→ req-144. **But** if a label is one shared string used by both, change it everywhere — consistency beats the split; say so.
No stored value changes: `setType: 'wu'`, rpe `5` etc. stay; only labels.

## Acceptance criteria
1. Each row: old text absent from the rendered screen, new present (tests / browser receipts).
2. **Failure case — could it pass for the wrong reason?** Stored data unchanged: a finished workout's `sets[].setType` and
   `rpe` deep-equal main's after logging the same sets (test). An imported old backup still displays with the new words.
3. `./check --smoke` green; smoke selectors that match old text updated and **called out** as test edits.

Decisions: the four wordings are Emilio's approval of Planner's list; "3,200" separator is implementation. Trigger files:
`ids.js` is not on the DEC-057 list. Sibling: after req-173 (both touch `item.jsx`).
