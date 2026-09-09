import { useState } from 'react'
import { exportAnalytics, recordButton } from '../analytics'
import { buildBackup } from '../exchange.js'
import { downloadJson, importWithBackup } from '../import-backup'
import { dateKey } from '../schedule'
import { useStore } from '../store-context'

function backupLines(summary) {
  return `${summary.routines} routines, ${summary.exercises} exercises, ${summary.workouts} workouts, ${summary.slots} slots.`
}

export function Settings() {
  const store = useStore()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [includeAssistant, setIncludeAssistant] = useState(false)

  return (
    <section>
      <h1>Settings</h1>
      <p>
        <label>
          <input
            type="checkbox"
            checked={includeAssistant}
            onChange={(event) => setIncludeAssistant(event.target.checked)}
          />{' '}
          Assistant prompt
        </label>
      </p>
      <p>
        <button
          type="button"
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
        </button>
      </p>
      <p>
        <button
          type="button"
          onClick={() => {
            recordButton('export-analytics')
            downloadJson(`workout-analytics-${dateKey(new Date())}.json`, exportAnalytics())
            setError('')
            setMessage('Analytics downloaded.')
          }}
        >
          Export analytics
        </button>
      </p>
      <p>
        <label>
          Import
          <br />
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
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
        </label>
      </p>
      {message ? <p>{message}</p> : null}
      {error ? <p>{error}</p> : null}
    </section>
  )
}
