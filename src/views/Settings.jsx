import { useState, useSyncExternalStore } from 'react'
import { exportAndResetAnalytics, recordButton } from '../analytics'
import { getFeedbackEnabled, setFeedbackEnabled, subscribeFeedbackEnabled } from '../dev/dev-notes.js'
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

export function Settings() {
  const store = useStore()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [includeAssistant, setIncludeAssistant] = useState(false)
  // req-87 — the feedback-notes toggle. Its own localStorage key (never
  // workout-mvp-v9); default OFF. Flipping it shows/hides the ✎ capture button
  // app-wide immediately (App.jsx's gate subscribes to the same store).
  const feedbackEnabled = useSyncExternalStore(
    subscribeFeedbackEnabled,
    getFeedbackEnabled,
    getFeedbackEnabled,
  )

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
                const filename = exportBackup(store, { includeAssistant })
                setError('')
                setMessage(`Backup saved — ${filename}${includeAssistant ? ' (with the assistant prompt)' : ''}`)
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
                    setMessage(backupLines(result.summary))
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
      {message ? <Banner>{message}</Banner> : null}
      {error ? <Banner role="alert">{error}</Banner> : null}
      <SectionHeader>Developer</SectionHeader>
      {/* Adds the assistant prompt to the Export above. */}
      <Checkbox label="Assistant prompt" checked={includeAssistant} onChange={setIncludeAssistant} />
      <Actions
        lateral={
          <Button
            onClick={() => {
              // req-197 — download, then reset; this press is counted in the new data.
              exportAndResetAnalytics((analytics) =>
                downloadJson(`workout-analytics-${dateKey(new Date())}.json`, analytics),
              )
              setError('')
              setMessage('Analytics downloaded. Counting starts again.')
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
    </Screen>
  )
}
