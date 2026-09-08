# req-04 — only deploy to Pages when build inputs change

**Status: READY** — infra hygiene, no user-visible behaviour. Independent of all other reqs.

## Why

`.github/workflows/deploy.yml` triggers on **any** push to `main`:

```
on:
  push:
    branches: [main]
```

But `./plan publish` merges `handoff/` (planning docs) onto `main`, so **every planning
publish triggers a full build + redeploy of the live app for zero code change**. Wasteful,
and it clutters the deploy history with runs that ship identical output. [measured] — the
workflow has no `paths`/`paths-ignore` filter; the trigger is branch-only.

## Scope

Restrict the deploy trigger to pushes that actually change what the build produces.

Recommended (an **include** list is more robust than chasing an ignore list): run only when
a real build input changes.

```
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'
      - 'index.html'
      - 'package.json'
      - 'package-lock.json'
      - 'vite.config.js'
      - '.github/workflows/deploy.yml'   # so changes to the deploy itself still deploy
```

A push whose files are all outside this list (a `handoff/` merge, a doc, a `plan`/`check`
edit) is skipped; a push touching any listed path runs as before. A mixed commit
(src + handoff) still runs.

## Out of scope

- Any change to the build, the Pages target, or what gets deployed — only *when* the
  workflow fires.
- Switching to `paths-ignore` (the inverse) — allowed if CC prefers, but the include list is
  the recommendation because a new, unignored planning path can't silently start
  redeploying.

## Decisions made on Emilio's behalf

- **implementation:** the exact path list, and include-vs-ignore. Confirmed approach (only
  deploy on build changes); the globs are CC's to finalise. If a future build input is added
  (a new top-level asset dir), it must be added here — noted as the include-list's one cost.

## Acceptance criteria

- A `main` push touching only `handoff/**` (i.e. a `./plan publish`) does **not** start a
  deploy run. Verify on the Actions tab after the next planning publish — no new run.
- A `main` push touching `src/**` **does** deploy. Verify after the next code merge — a run
  appears and the site updates.
- The workflow YAML is valid and otherwise unchanged (same build + publish steps).
- `./check` is unaffected (this doesn't touch app code); paste its green line anyway since the
  branch still runs it.

## Notes

Verification is partly observational (watching Actions across the next planning publish vs. the
next code merge) — call that out in the report rather than claiming it from the YAML alone.
