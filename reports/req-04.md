# req-04 — only deploy to Pages when build inputs change

Branch: `req-04-deploy-only-on-build-changes`
Gate: **infra** (DEC-009) — CI/workflow change, no app behaviour or stored data touched.

## Technical

### What changed

`.github/workflows/deploy.yml` — added a `paths` filter to the push trigger. Nothing
else in the workflow changed (same permissions, same 5 build+publish steps).

```yaml
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

This is the spec's recommended **include list** (not `paths-ignore`): a push whose
files are all outside the list (a `handoff/**` merge from `./plan publish`, a doc, a
`plan`/`check` edit) is skipped; a push touching any listed path runs exactly as before.
A mixed commit (src + handoff) still runs.

### Path list verified against the actual repo

Every listed path is a real build input present in the tree (not copied blindly from
the spec):

- `src/**` — app source
- `public/**` — `favicon.svg`, `icons.svg` (copied into `dist/` by Vite)
- `index.html` — Vite entry
- `package.json`, `package-lock.json` — `npm ci` inputs
- `vite.config.js` — build config
- `.github/workflows/deploy.yml` — self, so edits to the deploy still deploy

No other top-level dir feeds the build. The include-list's one cost (noted in the spec):
if a future build input is added — e.g. a new top-level asset dir — it must be added here
or it won't trigger a deploy.

### What I verified

- **YAML valid + structure intact** [measured] — parsed with PyYAML:
  - trigger: `{"push": {"branches": ["main"], "paths": ["src/**", "public/**", "index.html", "package.json", "package-lock.json", "vite.config.js", ".github/workflows/deploy.yml"]}}`
  - `job steps count: 5`, `build step present: True` — steps unchanged.
- **`./check` green** [measured] — this doesn't touch app code, but the branch runs it:
  ```
  # tests 73
  # pass 73
  # fail 0
  check: green — lint, 10 test file(s), and the build all passed.
  ```

### What I could NOT verify (needs real-push observation)

`./check` does not exercise CI triggering. The actual effect can only be confirmed by
watching the Actions tab across two real pushes to `main`:

1. A **doc-only** push (e.g. the next `./plan publish` touching only `handoff/**`) —
   expect **no new deploy run**.
2. A **source** push (the next `src/**` merge) — expect a run to appear and the site to update.

Call this out at closeout; it's the acceptance criterion the YAML alone can't prove.

## Workflow

No deviation from the spec. Adopted the recommended include-list approach and its exact
globs verbatim, after confirming each path is a live build input in the current tree. No
scope added or dropped, no mid-build decisions with Emilio, nothing that should become a
new `DEC-`/`L-`. The include-vs-ignore choice and the glob list were explicitly left to
CC by the spec ("the globs are CC's to finalise"); I finalised them as recommended.
