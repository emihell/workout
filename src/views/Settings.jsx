import { useEffect, useState, useSyncExternalStore } from 'react'
import { exportAndResetAnalytics, recordButton } from '../analytics'
import {
  devToolsFromQuery,
  getDevTools,
  getFeedbackEnabled,
  setDevTools,
  setFeedbackEnabled,
  subscribeDevTools,
  subscribeFeedbackEnabled,
} from '../dev/dev-notes.js'
import { downloadJson, exportBackup, importWithBackup } from '../import-backup'
import { dateKey } from '../schedule'
import { useStore } from '../store-context'
import { Actions, Banner, Button, Checkbox, FileButton, List, Row, Screen, SectionHeader, Title } from '../ui/index.jsx'
import { Back } from './shared'

function backupLines(summary) {
  return `${summary.routines} workouts, ${summary.exercises} exercises, ${summary.workouts} sessions, ${summary.scheduledDays} scheduled days.`
}

// req-203 §4 — the one line above "Back up now" (Lena run 3: "Export" / "Import" did not
// say what they do). Names the restore button as it reads (Planner, req-203 copy fix).
export const BACKUP_LINE = 'Saves all your workouts and history to a file on this device. Use Restore from a backup to bring it back.'

// req-220 (DEC-123 §3) — the 3-line how-to under "Export for your AI" (wording unconfirmed).
// One string literal (a constant export keeps fast refresh), one line per step.
export const AI_HOWTO =
  '1. Export for your AI saves your data with instructions an AI can read.\n2. Give the file to your AI and talk your plan through with it.\n3. Restore the file it gives back here. You see what changes before anything is replaced.'

function importedLines(result) {
  const kept = result.keptHistory ? ' Your logged history was kept.' : ''
  return `${backupLines(result.summary)}${kept}`
}

export function Settings({ dev = null }) {
  const store = useStore()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // req-87 — the feedback-notes toggle. Its own localStorage key (never
  // workout-mvp-v9); default OFF. Flipping it shows/hides the ✎ capture button
  // app-wide immediately (App.jsx's gate subscribes to the same store).
  const feedbackEnabled = useSyncExternalStore(
    subscribeFeedbackEnabled,
    getFeedbackEnabled,
    getFeedbackEnabled,
  )
  // req-209 — the Developer group shows only on a device whose dev-tools flag is on (its
  // own key, never workout-mvp-v9). `#/settings?dev=1` sets it, and it stays on.
  const devTools = useSyncExternalStore(subscribeDevTools, getDevTools, getDevTools)
  useEffect(() => {
    const next = devToolsFromQuery(dev)
    if (next != null) setDevTools(next)
  }, [dev])

  // req-198 / DEC-110 §1 — Settings left the bar: this is "Backup & data", reached from the
  // bottom of History. Export and Import first; the developer tools below, set apart.
  return (
    <Screen>
      <Back to="/history" />
      <Title>Backup &amp; data</Title>
      {/* req-203 §4 — plain words: what the backup is, where it goes, how it comes back. */}
      <p className="ui-sub">{BACKUP_LINE}</p>
      {/* req-122 — peer actions: lateral. */}
      <Actions
        lateral={
          <>
            <Button
              onClick={() => {
                recordButton('export-database')
                const filename = exportBackup(store)
                setError('')
                setMessage(`Backup saved — ${filename}`)
              }}
            >
              Back up now
            </Button>
            <FileButton
              label="Restore from a backup"
              accept="application/json,.json"
              onFiles={(files) => {
                // req-153 — a new pick clears the last outcome (as on Today).
                setError('')
                setMessage('')
                const file = files?.[0]
                if (!file) return
                file.text().then(async (text) => {
                  try {
                    const payload = JSON.parse(text)
                    const result = await importWithBackup({ store, payload })
                    if (!result) return // cancelled at the confirm
                    recordButton('import')
                    setError('')
                    setMessage(importedLines(result))
                  } catch (err) {
                    setMessage('')
                    setError(err instanceof Error ? err.message : 'Could not import.')
                  }
                })
              }}
            />
          </>
        }
      />
      {/* req-220 (DEC-123 §3) — the AI round-trip: always visible, under "Back up now". */}
      <Actions
        lateral={
          <Button
            onClick={() => {
              recordButton('export-for-ai')
              const filename = exportBackup(store, { includeAssistant: true })
              setError('')
              setMessage(`Saved for your AI — ${filename}`)
            }}
          >
            Export for your AI
          </Button>
        }
      />
      <p className="ui-sub">
        {AI_HOWTO.split('\n').map((line, index) => (
          <span key={line}>
            {index ? <br /> : null}
            {line}
          </span>
        ))}
      </p>
      {message ? <Banner>{message}</Banner> : null}
      {error ? <Banner role="alert">{error}</Banner> : null}
      {devTools ? (
        <DeveloperTools
          feedbackEnabled={feedbackEnabled}
          onAnalytics={() => {
            setError('')
            setMessage('Analytics downloaded. Counting starts again.')
          }}
        />
      ) : null}
    </Screen>
  )
}

// req-209 — the developer tools, shown only with the device flag on (Noa: developer copy
// beside the backup read as a trust-breaker).
// req-220 (DEC-123 §3) — the "Assistant prompt" checkbox left: Export for your AI replaced it.
function DeveloperTools({ feedbackEnabled, onAnalytics }) {
  return (
    <>
      <SectionHeader>Developer</SectionHeader>
      <Actions
        lateral={
          <Button
            onClick={() => {
              // req-197 — download, then reset; this press is counted in the new data.
              exportAndResetAnalytics((analytics) =>
                downloadJson(`workout-analytics-${dateKey(new Date())}.json`, analytics),
              )
              onAnalytics()
            }}
          >
            Export analytics
          </Button>
        }
      />
      {/* req-87 — turn the on-page feedback-note capture button on/off. Default off;
          persisted in its own key (never the workout data). */}
      <Checkbox label="Feedback notes" checked={feedbackEnabled} onChange={setFeedbackEnabled} />
      {/* req-13 — entry to the component-library showcase (iteration surface). */}
      <List>
        <Row to="/components">Components</Row>
      </List>
    </>
  )
}
