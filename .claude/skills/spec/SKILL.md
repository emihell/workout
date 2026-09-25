---
name: spec
description: Load FIRST, before reading any file, whenever asked to spec, write up, draft or plan a req / requirement / ticket, or turn a finding into one (planning session). The order — rescan the code, file:line facts, a Lane, out of scope, a failure-case criterion, (unconfirmed) calls.
---

The rules are `handoff/rules/WORKFLOW.md`: §Readiness, §Requirement lanes, §Requirements, §Write the doc for its
readers, §Before a requirement is tagged READY. Read those sections; this is the order to apply them in.

1. **Rescan the code this session** (`git log main --oneline -5`, then read the files the req will touch). Every
   fact — a line, a field, a count, and a DEC's *reason* — gets `file:line` or a quoted command + output;
   anything not read now is `[inferred]` (L-035, CLAUDE.md "Verify, don't recall").
2. **Pick the `Lane:`** from the lanes table; its "Ready when" column is the bar this doc must meet.
3. **Run READY checks 1–6** and write down what each found (DECs grepped, sibling reqs and their order,
   deferrals, number sources, trigger files → reviewer/backup, `(unconfirmed)` marks). For a bug: the reproduction.
4. **Write:** scope, **Out of scope**, ordered steps, acceptance criteria **before** any build — at least one a
   failure case (the four forms in §Requirements).
5. **Decisions made on Emilio's behalf:** sorted implementation vs behaviour (§Readiness, The test). A behaviour
   call is `(unconfirmed)` and goes on his list; an open behaviour question makes it `NEEDS DECISIONS`.
6. Status tag on line 1; past ~200 lines → a folder. Commit with `./plan save` (L-032).
