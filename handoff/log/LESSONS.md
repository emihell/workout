# Lessons

Append-only, newest at the bottom. What went wrong, so it doesn't go wrong the same way
twice. A lesson is not a decision — it's a mistake with its cause named.

Format:

```
## L-001 — short title  (YYYY-MM-DD)
What happened, what the real cause was (not the symptom), and the rule that now
prevents it. Cross-ref the req or audit finding if there is one.
```

---

## L-001 — seeded a browser's localStorage for a test without snapshotting it first  (2026-09-09)

While browser-testing req-03, the planning session injected `src/db.json` into
`localStorage['workout-mvp-v8']` on `localhost:5173` to get a workout with a rest running, then
cleared it after. The miss: it **overwrote** whatever was in that key without first reading and
saving the prior value, so if anything had been there it was gone with no restore path. Low harm
here — the dev origin (`localhost:5173`) is separate from where real history lives, and it was
very likely empty — but the principle is the project's core: never overwrite persisted data
without a way back. Rule: before seeding/overwriting `localStorage` for a browser test, first read
the existing value and restore it afterward (or drive the real UI, or use a throwaway browser
profile). Applies to the planning session's own browser tests, not to app code.

## L-002 — an ownership-changing DEC needs a same-turn doc sweep  (2026-09-09)

DEC-008 moved `plan publish` from Emilio to the planning session, but the change wasn't
propagated in the same pass — about five spots in `PLANNING.md` still read "hand Emilio the
publish line" and sat contradicting the DEC until a later full-folder scan caught them. Cause:
recording a decision without sweeping the docs that reference what it changed. Rule: when a
`DEC-` changes ownership or a standing rule, immediately `grep handoff/` for the old model's
phrasing and reconcile every hit in the same turn — never let the DEC and the prose disagree,
because whoever reads the prose won't know a DEC overrode it.
