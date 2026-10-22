#!/usr/bin/env node
// req-229 — start the server: `node server/start.mjs`.
//   WORKOUT_DATA_DIR  data dir (default ~/dev/workout/workout-data — the LIVE one; see BACKEND.md:
//                     only Planner starts that, from the live copy)
//   WORKOUT_PORT      port (default 8100; 0 = any free port)
//   WORKOUT_APP_DIR   the built app it serves (default <repo>/dist-server — `npm run build:server`)
// Binds 127.0.0.1 only. Refuses to start with its data/secret path inside a git working tree.
import { NODE_FLOOR, nodeVersionOk, serverConfig } from './config.mjs'

if (!nodeVersionOk()) {
  console.error(`The server needs Node ≥ ${NODE_FLOOR.join('.')} (node:sqlite); this is ${process.versions.node}.`)
  process.exit(1)
}

const { openDataDir } = await import('./db.mjs')
const { createHttpServer } = await import('./app.mjs')

let config
let deps
try {
  config = serverConfig()
  deps = openDataDir(config.dataDir)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const server = createHttpServer({ ...deps, appDir: config.appDir })
server.listen(config.port, config.host, () => {
  const { address, port } = server.address()
  console.log(`workout server listening on http://${address}:${port} (data: ${config.dataDir}, app: ${config.appDir})`)
})

function stop() {
  server.close(() => {
    deps.db.close()
    process.exit(0)
  })
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
