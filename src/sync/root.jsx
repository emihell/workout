// req-230 — the server build's login screen and root (rendered by src/sync/boot.jsx only).
//
//   no logged-in user on this device → the login screen (unless the stored data is unreadable:
//                                      then the app opens as before, under its banner, and
//                                      nothing is sent — DEC-032; Import stays reachable)
//   logged in                        → the app, from local data, online or not
//   the server said 401              → a banner with Log in; local data untouched
//   no user, offline, and this device's data synced before (review round 1 #7, DEC-128 §1: no
//   signal never blocks logging) → the login screen also offers "Continue without syncing": the
//   app opens on the device's data; its changes go up after the next login (same user)
import { useState, useSyncExternalStore } from 'react'
import App from '../App.jsx'
import { getLoadUnreadable, subscribeLoadUnreadable } from '../persistence.js'
import { Actions, Banner, Button, Field, Screen, Title } from '../ui/index.jsx'
import { SyncContext } from './status.js'
import { LOGIN_OFFLINE } from './engine.js'

export const CONTINUE_OFFLINE = 'Continue without syncing'
export const OFFLINE_BANNER = 'Not logged in — your changes stay on this phone and go to the server after you log in.'

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

export function LoginScreen({ sync, username: initialUsername = '', onCancel = null, onDone = null, onContinue = null }) {
  const [username, setUsername] = useState(initialUsername)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const result = await sync.login(username.trim(), password)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onDone?.()
  }
  return (
    <main className="ui-main">
      <Screen>
        <Title>Log in</Title>
        <form onSubmit={submit}>
          <Field
            label="Username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <Banner role="alert">{error}</Banner> : null}
          {onContinue && (isOffline() || error === LOGIN_OFFLINE) ? (
            <Actions lateral={<Button onClick={onContinue}>{CONTINUE_OFFLINE}</Button>} />
          ) : null}
          <Actions
            retreat={onCancel ? <Button onClick={onCancel}>Cancel</Button> : null}
            forward={
              <Button type="submit" variant="primary" disabled={busy || !username.trim() || !password}>
                Log in
              </Button>
            }
          />
        </form>
      </Screen>
    </main>
  )
}

export function SyncRoot({ sync }) {
  const status = useSyncExternalStore(sync.subscribe, sync.getStatus, sync.getStatus)
  const unreadable = useSyncExternalStore(subscribeLoadUnreadable, getLoadUnreadable, getLoadUnreadable)
  const [relogin, setRelogin] = useState(false)
  const [withoutSync, setWithoutSync] = useState(false)
  if (!status.user && !unreadable && !withoutSync) {
    // Only for data this device synced as a user before: a login then is a normal sync, so
    // nothing done meanwhile is replaced (a first login takes the server's copy, DEC-132 §1).
    return <LoginScreen sync={sync} onContinue={status.syncedUser ? () => setWithoutSync(true) : null} />
  }
  if (relogin && status.expired) {
    return <LoginScreen sync={sync} username={status.user} onCancel={() => setRelogin(false)} onDone={() => setRelogin(false)} />
  }
  return (
    <SyncContext.Provider value={sync}>
      {status.expired ? (
        <Banner role="alert">
          You're logged out on the server — log in to sync. Everything is still saved on this phone.{' '}
          <Button onClick={() => setRelogin(true)}>Log in</Button>
        </Banner>
      ) : null}
      {!status.user && withoutSync ? (
        <Banner role="alert">
          {OFFLINE_BANNER} <Button onClick={() => setWithoutSync(false)}>Log in</Button>
        </Banner>
      ) : null}
      <App sync={sync} />
    </SyncContext.Provider>
  )
}
