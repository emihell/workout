import { useState, useSyncExternalStore } from 'react'
import { exportAnalytics, recordButton } from '../analytics'
import { getFeedbackEnabled, setFeedbackEnabled, subscribeFeedbackEnabled } from '../dev/dev-notes.js'
import { buildBackup } from '../exchange.js'
import { downloadJson, importWithBackup } from '../import-backup'
import { dateKey } from '../schedule'
import { useStore } from '../store-context'
import { Actions, Banner, Button, Checkbox, FileButton, List, Row, Screen, Title } from '../ui/index.jsx'

function backupLines(summary) {
  return `${summary.routines} routines, ${summary.exercises} exercises, ${summary.workouts} workouts, ${summary.slots} slots.`
}

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

  return (
    <Screen>
      <Title>Settings</Title>
      <Checkbox label="Assistant prompt" checked={includeAssistant} onChange={setIncludeAssistant} />
      {/* req-122 — three peer actions (export / export / import): all lateral. */}
      <Actions
        lateral={
          <>
            <Button
              onClick={() => {
                recordButton('export-database')
                downloadJson(
                  `workout-database-${dateKey(new Date())}.json`,
                  buildBackup(store, { includeAssistant }),
                )
                setError('')
                setMessage(includeAssistant ? 'Downloaded with prompt.' : 'Downloaded.')
              }}
            >
              Export
            </Button>
            <Button
              onClick={() => {
                recordButton('export-analytics')
                downloadJson(`workout-analytics-${dateKey(new Date())}.json`, exportAnalytics())
                setError('')
                setMessage('Analytics downloaded.')
              }}
            >
              Export analytics
            </Button>
            <FileButton
              label="Import"
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
      {/* req-13 — entry to the component-library showcase (iteration surface). */}
      <List>
        <Row to="/components">Components</Row>
      </List>
      {/* req-87 — turn the on-page feedback-note capture button on/off. Default off;
          persisted in its own key (never the workout data). */}
      <Checkbox label="Feedback notes" checked={feedbackEnabled} onChange={setFeedbackEnabled} />
    </Screen>
  )
}
