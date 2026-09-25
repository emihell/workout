---
name: qa-branch
description: Load FIRST, before reading any file, whenever asked to QA, browser-test, click through, smoke or "test the branch" req-N, or run a req's test list. The order for testing a built branch on an isolated origin — `./plan qa <branch>`, the smoke test, the test list with dialogs stubbed, a stored-value receipt per item.
---

The *why* lives in the rules; this is the order. Read **L-033** and **L-036** (`handoff/log/LESSONS.md`) and the
lane's gate (`handoff/rules/WORKFLOW.md` §Requirement lanes) before step 1.

1. **Serve it isolated:** `./plan qa <branch>` (either worktree; read-only to both). Use only the URL it prints —
   never the dev server or the live site. `--seed <file>` for a different starting doc.
2. **Golden flow:** `node scripts/smoke.mjs --url <url>` → must end `smoke: green`. A red here is the finding;
   stop and report it with the printed step and screen text.
3. **The req's test list**, one scripted page (puppeteer, headless), not screenshot-paced clicks:
   - Copy the page setup from `scripts/smoke.mjs` (`evaluateOnNewDocument`: shifted clock, recorded
     `confirm/alert/prompt`, the "Not found." tripwire). Any recorded dialog is a failure.
   - Act inside one script where a countdown screen is involved (L-033).
   - After a revert or cleanup commit, re-run every flow the removed code sat on (L-036).
   - From a scratchpad script, import puppeteer by absolute path:
     `<code worktree>/node_modules/puppeteer/lib/puppeteer/puppeteer.js`.
4. **Receipt per item:** yes/no **plus the value read back** from `localStorage['workout-mvp-v9']` (or the DOM text)
   that proves it — not "looked right".
5. `./plan qa --stop`, and confirm the port is free.

Report: the smoke's last line, then the numbered list with each item's receipt. Name anything that needed a real device.
