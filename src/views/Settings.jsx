import { useState } from 'react'
import { exportAnalytics, recordButton } from '../analytics'
import { buildBackup } from '../exchange.js'
import { downloadJson, importWithBackup } from '../import-backup'
import { dateKey } from '../schedule'
import { useStore } from '../store-context'
import { Banner, Button, Checkbox, FileButton, List, Row, Screen, Title } from '../ui/index.jsx'

function backupLines(summary) {
  return `${summary.routines} routines, ${summary.exercises} exercises, ${summary.workouts} workouts, ${summary.slots} slots.`
}

export function Settings() {
  const store = useStore()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [includeAssistant, setIncludeAssistant] = useState(false)

  return (
    <Screen>
      <Title>Settings</Title>
      <Checkbox label="Assistant prompt" checked={includeAssistant} onChange={setIncludeAssistant} />
      <div className="ui-actions">
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
            const file = files?.[0]
            if (!file) return
            file.text().then((text) => {
              try {
                const payload = JSON.parse(text)
                const result = importWithBackup({ store, payload })
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
      </div>
      {message ? <Banner>{message}</Banner> : null}
      {error ? <Banner role="alert">{error}</Banner> : null}
      {/* req-13 — entry to the component-library showcase (iteration surface). */}
      <List>
        <Row to="/components">Components</Row>
      </List>
    </Screen>
  )
}
