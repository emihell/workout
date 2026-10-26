// req-230 (DEC-132 §2–3) — Backup & data's sync part: the one status line and Log out. Renders
// nothing without an engine (the plain build), so that screen reads exactly as before there.
import { useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { Actions, Button, SectionHeader } from '../ui/index.jsx'
import { SyncContext, syncLine } from './status.js'

export function SyncSection() {
  const sync = useContext(SyncContext)
  if (!sync) return null
  return <SyncSectionFor sync={sync} />
}

function SyncSectionFor({ sync }) {
  const status = useSyncExternalStore(sync.subscribe, sync.getStatus, sync.getStatus)
  // "Synced · 2 min ago" keeps counting while the screen is open (a sync newer than `now`
  // reads "just now").
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  return (
    <>
      <SectionHeader>Sync</SectionHeader>
      <p className="ui-sub" data-sync-status="">
        {syncLine(status, now)}
      </p>
      {status.user ? (
        <Actions lateral={<Button onClick={() => sync.logout()}>Log out</Button>} />
      ) : null}
    </>
  )
}
