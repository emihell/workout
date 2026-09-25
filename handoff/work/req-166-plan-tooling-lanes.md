# req-166 — tooling: check_handoff knows lanes; the reviewer check before merge; `plan` fetches

**Status: BUILT — branch `req-166` (`f5f1d73`), NOT merged.** (2026-09-25) — **Lane: tooling.** DEC-085 §6, DEC-087. Source: `handoff/audits/workflow-2026-09-24.md`
(recommendations 7, 8; the L-014 fetch note) + BACKLOG "check_handoff knows lanes".

1. `scripts/check_handoff.py`: accept a `**Lane: <ui|bug|data|content|design|backend|tooling|audit>**` tag, and a design
   req's terminal status `DECIDED <date> → DEC-…, req-…` (`classify_tag` today knows merged/not-merged/blocked/unknown,
   `:214-247`). A req with neither Lane nor legacy Gate → a warning, not a failure (old reqs keep their Gate).
2. `plan closeout`: the reviewer check moves **before** the merge (today `reviewer_warning` runs after the local merge,
   `plan:742` merge, `:801` warning, and never blocks): if the diff touches a DEC-057 §1 trigger file and the SHIPPED
   gate line names no reviewer, refuse unless `--no-reviewer "<reason>"` is given (the reason is appended to SHIPPED).
3. `plan status` / `plan save` run `git fetch origin` first (L-014) and warn if `planning` is behind `origin/planning`.

4. Run `scripts/check-cycles.mjs` in `./check` (~50 ms; req-164) — a new import cycle fails the gate.

## Acceptance criteria

- check_handoff: a test per new tag/status (accepted), a bad Lane value (fails), an old Gate-only req (warns) — paste.
- closeout: a dry run on a throwaway branch touching `storage.js` with no reviewer → refused; with `--no-reviewer "…"` →
  proceeds and SHIPPED carries the reason (use a throwaway repo copy, never the real worktrees — L-040).
- fetch: `plan status` output shows the fetch; a simulated behind state warns (paste).
- `./check` green; the plan/check_handoff self-tests pass.
