# req-32 — the unified Workouts scroll (merge Today + Schedule + History)

Status: READY (req-14 merged 2026-09-12 — the shell + interim Workout screen exist). Direction
decided; details to iterate with Emilio during build.
Source: DEC-024. Type: Screen redesign (no persisted data). Gate: ux-feel → Emilio's hands, heavy
iteration expected (this is the boldest UI in the app so far).

## Why

DEC-024 merges Today + Schedule + History into **one unified scroll** under the Workouts tab —
Emilio's pick over a segmented control or a Today-plus-links page. req-14 ships the tab shell with an
interim "Today + links to Schedule/History"; this req replaces that interim with the real thing.

The shape (from the previews Emilio chose):

```
  ↑ UPCOMING
  Wed · Pull Day
 ══════ TODAY ══════
  Push Day        ▶ Start
  ────── DONE ──────
  Sun · Legs           ✓
```

One vertical time axis: **upcoming** scheduled sessions above, **today** anchored in the middle with
the **Start** action, **done** (history) below — and **schedule edits happen inline** on this scroll,
not on a separate Schedule screen.

## Scope

**In (direction; exact interaction iterates with Emilio):**
1. **One scrolling Workouts screen** on a time axis: upcoming (future scheduled slots) → today
   (anchored, with Start) → done (past workouts / history), newest-relevant in view on open.
2. **Inline schedule editing** — the add/edit/remove-slot actions that live on the Schedule screen
   today (routes `schedule`, `schedule-day`, `schedule-slot`, `schedule-day-add`, `schedule-loop`)
   become editable from this scroll. Preserve every capability; the *entry point* moves inline.
3. **Preserve History** — the past section is the History log; opening/editing a past workout
   (`history`, `history-edit`) still works, reached from the scroll.
4. **Preserve Start / today behaviour** — starting a workout from today's scheduled routine is
   unchanged in logic (snapshot-on-start); only its placement moves onto the scroll.
5. Remove the interim Schedule/History links req-14 added to Today once their function lives inline.

**Out of scope:**
- The tab bar, Library, Settings (req-14).
- Any change to the workout snapshot / logging / history *model* — this is a view/placement redesign
  over the existing data. **No persisted-data / schema change.** If merging seems to need a data
  change, stop and report (the code wins — CLAUDE.md).
- The recurring-week *math* (`schedule.js` loop-week logic) — reuse it, don't reimplement it.

## Open design questions to settle with Emilio during build (spec them as they're decided)

- **How far** does upcoming/done extend on first paint, and how is more loaded (scroll, "show more")?
- **Today with nothing scheduled** — what the anchor shows (an ad-hoc Start? a rest-day state?).
- **Inline schedule editing depth** — edit in place on the scroll vs a sheet/expand from a slot; how
  add-slot is reached. This is the crux and will iterate.
- **Recurring vs one-off** — how the weekly recurring schedule reads on a linear time scroll.

These are why this req builds **after** req-14 and expects a browser-loop with Emilio, not a
one-shot. Capture each answer as it's decided (DEC- or in this spec) before building that part.

## Acceptance criteria (draft — finalize once the interaction is settled)

- [ ] The Workouts tab is a single scroll: upcoming above, today anchored with Start, done below.
- [ ] Everything the separate Schedule screen did (add/edit/remove slots, recurring week) is doable
      inline from the scroll — nothing lost.
- [ ] Past workouts are viewable/editable from the scroll (History preserved).
- [ ] Start from today works exactly as before (snapshot-on-start unchanged).
- [ ] No schema/persisted-data change (diff is view/routing only). `./check` green; `reports/req-32.md`.

## Notes

Do not start until req-14 is merged. When picked up, expect to spec-as-you-go with Emilio on the open
questions above — this is a design conversation carried out in the branch, not a fixed spec.
