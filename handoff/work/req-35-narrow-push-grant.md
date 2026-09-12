# req-35 — narrow the planning session's `git push` grant to its intended forms

**Status: README slice BUILT AND MERGED, 2026-09-12 — branch `req-33-35-workflow-hardening` (`130d30e`), merge `8daa8f2` (batch with req-33/34).** README printf block now grants the two narrow forms only; no bare `Bash(git push:*)` left in README or `handoff/`. Handoff prose was already narrow (DEC-005). See DEC-026. **REMAINING (Emilio):** re-paste machine-local `settings.local.json` with the narrowed grant, then verify the matcher accepts `git push origin main planning:*` as one rule and re-prompts on a bare/force push — record the working form if it needs the per-branch split.

**Gate: functional** (DEC-009) — planning verifies + merges.

## Why

The planning session's grant (README §Setup step 5, and its `.claude/settings.local.json`) includes
a bare **`Bash(git push:*)`** — that authorizes *any* push to *any* branch/remote, including
`--force`. DEC-005's intent (and the docs' prose) is only `git push origin planning` plus the
publish/closeout push `git push origin main planning`. The grant is wider than the trust model it
documents; a wrong-branch or force push shouldn't be pre-authorized.

## The behaviour (decided)

Replace `"Bash(git push:*)"` in the granted set with the specific forms the workflow actually uses:

```
"Bash(git push origin planning:*)",
"Bash(git push origin main planning:*)",
```

Update **both** places that show the grant: the README §Setup printf block, and any prose in
`handoff/` that lists the grant (`log/DECISIONS.md` DEC-005, `PLANNING.md` §"You run the git
yourself"). Emilio re-pastes his machine-local `settings.local.json` (the classifier blocks the
session from writing its own grant).

## Scope

- README §Setup grant block: swap the broad push rule for the two narrow ones.
- `handoff/` prose references to the grant, kept consistent.
- Note for Emilio to re-paste `settings.local.json`.

## Out of scope

- The other grants (`git add/commit/reset/restore`, the `plan` verbs) — unchanged.
- Adding a `pre-push` hook (considered; `deploy.yml` gate in req-34 is the chosen backstop for the
  green-gate hole — this req is only about *scope of authority*, not the gate).

## Acceptance criteria

- **Still works:** with the narrowed grant pasted, the planning session runs `plan save` →
  `git push origin planning`, and `plan publish` → `git push origin main planning`, and
  `plan closeout` — all **without a permission prompt**. (Verify on the real machine.)
- **Narrowed:** a bare `git push` or `git push --force origin main` is **not** covered by the grant
  (would prompt), confirming the broad authorization is gone.
- **Docs consistent:** no remaining `Bash(git push:*)` in README or `handoff/`.

## Notes

- If the matcher won't accept `origin main planning:*` as one rule, split per-branch or adjust —
  record the working form in the report. Surfaced in the 2026-09-12 workflow review.
