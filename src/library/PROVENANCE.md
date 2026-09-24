# Exercise library — provenance (req-130, DEC-060)

`exercises.json` is our exercise library. It is **generated** — do not hand-edit it.

    node scripts/build-library.mjs

The script reads the source below, refuses unless its sha256 matches, and applies the
tables in `src/exerciseLibrary.js`. `src/exerciseLibrary.test.js` fails if the file
drifts from what the script would write.

## Source

- **free-exercise-db** by yuhonas — https://github.com/yuhonas/free-exercise-db
- File: `dist/exercises.json` at commit `a859101d633a01c4a1a920d6a8ce41dabba0705f`
  (876 entries; byte-identical to `@main` on 2026-09-24)
- sha256 `5bb747e3fc658f095a60dcbf6d53c96627acdcc6ffb6fffde86f7e26995d40bf`
- Licence: **The Unlicense** (public domain) — copied beside this file as
  `LICENSE-free-exercise-db.md`.
- Photos are not copied: `photos` links the pinned commit on jsDelivr.

## What is ours

- Per free-db entry, appended after its unchanged fields: `aliases` (only where set),
  `muscleGroups` (derived from `primaryMuscles` by one table), `photos`.
- On the common entries only (req-133, DEC-062; tags in `common.js`): `muscles` (tree
  nodes, primary/secondary), `pattern`, `equipmentList`, `logAs`, `unilateral`,
  `common`, `family`. free-db's own fields are never corrected in place.
- `extra-*` entries (from `src/exerciseExtras.js`) and `own-*` entries (from
  `own-exercises.js`) — our text.

## What is not here

Nothing from RepDB: no ids, links, images or text. Since req-139 (DEC-064) search reads
this library only; RepDB comes back for pictures only (req-131), fetched live and used
unmodified, with the credit its licence requires (Settings).
