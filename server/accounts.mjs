#!/usr/bin/env node
// req-229 — the accounts script (invite-only, like White Sleeve's):
//   node server/accounts.mjs bootstrap --username <u>   the first account; prompts for a password
//   node server/accounts.mjs invite                     prints a one-use invite code (7 days)
//   node server/accounts.mjs disable <u>                disables the account and ends its sessions
// Works on WORKOUT_DATA_DIR (default: the live data dir). On the live DB this is a non-request
// write: BACKEND rule 5 (backup first) and rule 4 (inviting a user asks Emilio) apply.
// The password is read from the terminal without echo, or from stdin when piped.
import { createInterface } from 'node:readline'
import { NODE_FLOOR, nodeVersionOk, serverConfig } from './config.mjs'

const USAGE = 'usage: accounts.mjs bootstrap --username <u> | invite | disable <u>'

async function readPassword(prompt) {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin })
    for await (const line of rl) {
      rl.close()
      return line
    }
    return ''
  }
  process.stdout.write(prompt)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  return new Promise((resolve, reject) => {
    let value = ''
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.off('data', onData)
          process.stdout.write('\n')
          return resolve(value)
        }
        if (ch === '\u0003') {
          process.stdin.setRawMode(false)
          return reject(new Error('Cancelled.'))
        }
        if (ch === '\u007f') value = value.slice(0, -1)
        else value += ch
      }
    }
    process.stdin.on('data', onData)
  })
}

async function main(argv) {
  if (!nodeVersionOk()) throw new Error(`Needs Node ≥ ${NODE_FLOOR.join('.')} (node:sqlite).`)
  const { openDataDir } = await import('./db.mjs')
  const auth = await import('./auth.mjs')
  const [command, ...rest] = argv
  if (!['bootstrap', 'invite', 'disable'].includes(command)) throw new Error(USAGE)
  const { dataDir } = serverConfig()
  const { db, secret } = openDataDir(dataDir)
  try {
    if (command === 'bootstrap') {
      const at = rest.indexOf('--username')
      const username = at > -1 ? rest[at + 1] : undefined
      if (!username) throw new Error(USAGE)
      auth.normaliseUsername(username)
      if (auth.userCount(db) > 0) throw new Error('Bootstrap refused: an account already exists. Use `invite`.')
      const password = await readPassword('Password: ')
      const user = await auth.bootstrapUser(db, { username, password })
      console.log(`Created ${user.username}.`)
    } else if (command === 'invite') {
      console.log(auth.createInvite(db, secret))
    } else {
      if (!rest[0]) throw new Error(USAGE)
      const user = auth.disableUser(db, rest[0])
      console.log(`Disabled ${user.username}; sessions ended.`)
    }
  } finally {
    db.close()
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
