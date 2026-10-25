**Status: READY** **Lane: tooling** · server stage 1

# req-234 — `accounts.mjs passwd <user>`: change a password from the terminal

Emilio, 2026-10-25: "can you also change the password for emilio … when we go online we change it — but as long as its in
tailscale, that is enough". No path exists today: `server/accounts.mjs:12` offers only `bootstrap | invite | disable`, and
`server/app.mjs` and `server/auth.mjs` have no change or reset route [measured: grep]. Planner doesn't type passwords, so
Emilio runs the command himself in a normal terminal.

## Scope

1. `node server/accounts.mjs passwd <username>` prompts for the new password twice, using the same `readPassword` as
   bootstrap (`server/accounts.mjs:14-47`). It uses the same rule (≥ 6, DEC-132 §4) and the same scrypt hashing as
   bootstrap. It updates that user, ends **all** of that user's sessions, and prints `Password changed for <u>; N session(s)
   ended.`
2. It refuses an unknown user, a disabled user, and two entries that don't match. Each refusal exits non-zero and changes
   nothing.

## Out of scope

- A change-password screen in the app.
- Rate limits and resets for other users (BACKLOG §public hosting).

## Acceptance criteria

1. A test on a throwaway DB: the old password no longer logs in, the new one does, and the user's old sessions get 401.
2. **Failure:** an unknown user, a mismatch, or a password shorter than 6 → non-zero exit, and the stored hash is unchanged
   (tests).
3. `./check` green. Deploy is Planner's (`server/deploy`), after merge.
