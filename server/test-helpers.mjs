// req-229 — shared by the server tests. IMPORT THIS FIRST in every server test file: it turns
// on the live-path guard (BACKEND rule 8) before any server module opens anything.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.WORKOUT_SERVER_TEST = '1'

const { openDataDir } = await import('./db.mjs')
const { createHttpServer, CSRF_HEADER } = await import('./app.mjs')

export function tempDir(prefix = 'workout-server-test-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

// A throwaway server on a temp data dir and a free port. `close()` removes everything.
export async function startTestServer(options = {}) {
  const dataDir = tempDir()
  const deps = openDataDir(dataDir)
  const server = createHttpServer({ ...deps, ...options })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  return {
    ...deps,
    dataDir,
    base,
    async close() {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
      deps.db.close()
      rmSync(dataDir, { recursive: true, force: true })
    },
  }
}

// A browser-ish client: keeps its session cookie, sends the CSRF header + JSON on writes.
export function client(base, { csrf = true } = {}) {
  let cookie = null
  const call = async (method, path, body, extraHeaders = {}) => {
    const headers = {}
    if (cookie) headers.cookie = cookie
    if (method !== 'GET') {
      if (csrf) headers[CSRF_HEADER] = '1'
      headers['content-type'] = 'application/json'
    }
    Object.assign(headers, extraHeaders)
    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      const value = setCookie.split(';')[0]
      cookie = value.endsWith('=') ? null : value
    }
    const text = await res.text()
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null }
  }
  return {
    call,
    get: (path, headers) => call('GET', path, undefined, headers),
    post: (path, body, headers) => call('POST', path, body, headers),
    put: (path, body, headers) => call('PUT', path, body, headers),
    get cookie() {
      return cookie
    },
    set cookie(value) {
      cookie = value
    },
  }
}
