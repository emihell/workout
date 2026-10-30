**Status: BUILT AND MERGED, 2026-10-30 — branch `req-252` (`2938a29`…`fa3ea44`, 2 commits).** (into `wf-2026-10-30`) · **Lane: tooling** · DEC-144 §3; DEC-087 §2. After req-251 (stacks on its branch).

# req-252 — closeout prints the deploy line; SHIPPED entries stay short

## Why

Merged ≠ live (L-063); the deploy has no step in the closeout tool, and the classifier blocks Planner's deploy (DEC-144 §3:
Emilio runs it). SHIPPED entries average 6.35 lines vs the ≤3 rule (DEC-087 §2); the stub asks for "one paragraph"
(`plan:586-596`).

## Scope

1. `plan closeout`: after a successful push, if the merge's diff touches what the server serves (`src/`, `public/`,
   `index.html`, `vite.config.js`, `package*.json`, `server/` — CLOSEOUT.md step 4), print last:
   `DEPLOY (Emilio, on the server machine):  ! ./server/deploy && ./server/doctor`. Otherwise print `no deploy needed`.
2. `append_shipped_stub`: the stub becomes three labelled placeholder lines — `What:`, `Gate:`, `Report:`.
3. `scripts/check_handoff.py`: warn (not error) when a SHIPPED entry dated after 2026-10-30 has more than 3 non-blank body
   lines.

## Acceptance criteria

1. A scratch closeout touching `src/` prints the DEPLOY line; one touching only `handoff/` prints `no deploy needed`.
2. **Failure case:** a new 4-line SHIPPED entry → check_handoff warns and exits 0; old long entries → no warning.
3. `./check` green.
