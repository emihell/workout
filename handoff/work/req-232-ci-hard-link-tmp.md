**Status: READY** **Lane: bug**

# req-232 — the deploy is red: req-178's test hard-links across disks

## Reproduction (2026-10-21)

Deploy run `39655468558` (main `12e018f`, req-228's merge) failed in `./check`; **the site did not ship** (live = `a895ce4`,
2026-10-14). Not req-228: the failing test is older and passed on every deploy through 2026-10-14. [measured: `gh run view
39655468558 --log-failed`]

```
not ok 2 - --out writes a filled COPY: … --out = input refused   (src/req-178.test.js:347)
error: "EXDEV: cross-device link not permitted, link '…/src/db.json' -> '/tmp/fill-qAdbsB/hard-link.json'"
  at linkSync (src/req-178.test.js:366)
# tests 1940 · pass 1939 · fail 1
```

Cause: the test hard-links the repo's `src/db.json` into `os.tmpdir()`. A hard link can't cross filesystems; the GitHub
runner's `/tmp` is now a separate one [inferred from EXDEV; it passed 2026-10-14]. On this Mac `/tmp` and the repo share
`/dev/disk1s1` (`df`), so it passes locally.

## Scope

Make the test independent of where the temp dir lives, **keeping what it proves**: `--out` pointing at the input, or at a hard
link to the input, is refused and the input is unchanged. E.g. copy `db.json` into the temp dir first and run the script on
that copy, hard-linking within the temp dir. `scripts/fill-routine-kg.mjs` unchanged.

## Out of scope

The script's behaviour. Other tests. Adding `workflow_dispatch` to the deploy.

## Acceptance criteria

1. **Fails on main, passes on the branch, off one filesystem:** with `TMPDIR` on a different volume from the repo (e.g. a RAM
   disk: `hdiutil attach -nomount ram://65536` + `diskutil erasevolume APFS RAM <dev>`, then `TMPDIR=/Volumes/RAM/`),
   `node --test src/req-178.test.js` → EXDEV on `main`, pass on `req-232`. Paste both; detach the RAM disk after.
2. **Still a real guard:** temporarily make the script accept a hard-linked `--out` (or skip the link assertion's target) →
   the test fails. Paste, revert.
3. `./check` green (`LANG=en_GB.UTF-8`). After merge, Planner: deploy run green, smoke included.
