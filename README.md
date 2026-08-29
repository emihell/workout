# Workout MVP product contract

This browser-only MVP supports one trustworthy loop: set up exercises and reusable sessions, schedule them, resolve a dated plan, train, and keep an editable historical record.

## Entity ownership

- Exercise: reusable name, equipment, type, cues, muscles and valid weight increments.
- Session: ordered exercise references, role, rest guidance, warm-up guidance and notes. It never owns working weights or rep prescriptions.
- Schedule slot: recurring week/day placement for a session. It never owns workout results.
- Planned workout: a concrete date, occurrence ID and recommended sets/reps/weights. Manual changes affect that occurrence only.
- Active workout/draft: a snapshot of the resolved plan plus logged and skipped sets. Leaving the page preserves it; switching sessions stores it as a resumable draft.
- Completed workout: an immutable plan snapshot plus actual sets, notes, effort and recommendation evidence. It remains readable after setup entities change or are deleted.

## Recommendation rules

The program goal supplies the generic rep pattern. Completed history supplies the next load. Easy completed work moves one valid equipment step up; missed reps or failure move one step down; moderate work holds. Alternating 4/5 kg stacks use their real sequence rather than a rounded 5 kg increment.

A weighted exercise without history has no invented starting weight. Its dated plan explains calibration: start light, perform the program reps, and adjust by valid increments based on effort.

Correcting meaningful history shows a recalculation preview. Automatically generated future plans can be regenerated after confirmation; manually edited dated plans are preserved.

## Action vocabulary

- Lists browse and offer Add.
- Object detail pages own Edit and Delete.
- Relationship pages use Add and Remove.
- Save commits; Cancel returns without committing; Back returns to the parent context.
- Referenced setup objects are archived from active setup. Unreferenced objects can be hard-deleted. Historical snapshots are never rewritten by setup changes.

## Persistence and migration

The seed in `src/db.json` is provenance and first-run data, not the live database. Live state is stored in browser `localStorage` under `workout-mvp-v6`. On load, v5 state is migrated to schema version 6, stable session-item and occurrence identities are added, old workouts receive snapshots, and legacy template prescriptions are kept only as recommendation baselines while prescriptions are removed from reusable sessions.

## Development

```sh
npm run dev
npm run lint
npm run build
node --test src/*.test.js
```

## Deferred scope

No accounts, sharing, collaboration, sheet-import UI, insights, charts, GPS, social features, or visual-design pass are part of this MVP.
