**Status: NEEDS DECISIONS** **Lane: design** — no code. Gated by DEC-085 §7 (backend rules written first). Started 2026-10-11 with
the AI section (DEC-124). **Active 2026-10-21 (DEC-127):** stages 1 server + own data → 2 other users → 3 together/AI.

# req-146 — backend design (own server, accounts, sharing, in-app AI)

Why (DEC-073): a real product, other users soon, training together. BACKLOG §Phase 3 lists the open questions: hosting, accounts,
sharing model, live group sessions, migration from localStorage, offline-first in the gym, privacy/GDPR, backups, per-branch
previews (Emilio, 2026-09-24).

## Stage 1 — decided so far (DEC-127, DEC-128)

Offline-first phone; newest edit wins per record, loser kept; White Sleeve's hosting pattern (Mac, 127.0.0.1, Tailscale serve,
SQLite, invite-only login, start/stop, backups); per-user data in the Export shape; feedback notes per user; Node server.
Rules: `rules/BACKEND.md`. Reqs (DEC-130): req-228 → req-229 → req-230 → req-231. **Stage 1 LIVE 2026-10-25** at `:8446`; GitHub
Pages shut down (DEC-135); Emilio's data moved in as rev 1.

## Open questions (to settle live with Emilio)

1. ~~Hosting~~ — done: Emilio's Mac, tailnet-only, backups weekly + before deploy (DEC-127, DEC-136). Public hosting is ask-gate 3.
2. Accounts and auth; the sharing data model (shared routine, own values); live group sessions.
3. ~~Migration~~ — done (one Import, rev 1). Offline-first + conflict rule live (DEC-128).
4. Privacy / GDPR: what training data leaves the device, retention, deletion.
5. ~~Per-branch previews~~ — exist: `plan preview [req-N]` serves a branch over Tailscale HTTPS on its own origin (DEC-041), `plan qa` on 127.0.0.1.
6. **AI cost model when other users arrive:** per-user limits, a paid tier, or bring-your-own key.

## Decided — the in-app AI (DEC-124, Emilio 2026-10-11: "sounds good")

The in-app version of DEC-121's round-trip, so the user chats in the app instead of exporting and importing.

- **Provider / model:** Claude API, **Claude Opus 5** (`claude-opus-5`); a cheaper model (Claude Sonnet 5) is Emilio's call, not a
  default. Server-side refusal fallback on by default.
- **Key:** only on the backend; the browser never holds it.
- **Prompt:** req-220's `ASSISTANT` (prompt, howTheAppWorks, `FIELDS`, import rules) is the system prompt; stable prefix first and
  prompt-cached (follow-ups read the cached context at ~0.1× input price).
- **Chat:** streamed replies, adaptive thinking.
- **Output:** the agreed plan returned through a strict, schema-validated tool (or structured output) — never free text parsed by
  hand.
- **Write path:** "AI proposes, the user confirms" — the result goes through req-220's preview and Keep my history / Replace
  everything; the AI never writes stored data directly. DESIGN §1 holds: it may change routines/schedule, never invent logged
  workouts or sets.
- **History size** [measured 2026-10-11]: an export with 13 workouts ≈ 133 KB (≈ 35–45k tokens [inferred, ~3–4 chars/token]);
  ~8 KB per workout, so a year at 3/week passes 1 MB. Send recent weeks in full + a per-exercise summary computed from the real
  logs (no invented numbers); measure with `count_tokens` before choosing the window.
- **Cost** [inferred]: ~$0.50–1 per coaching chat on Opus 5 with caching ($5 / $25 per MTok, cache reads $0.50).

Out of scope until the backend exists: any client-side AI call; any AI write without the preview.
