import { useState } from 'react'
import { buildBackup } from '../exchange.js'
import { dateKey } from '../schedule'
import { useStore } from '../store-context'
import { Back } from './shared'

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
  URL.revokeObjectURL(href)
}

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
      <Back />
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
                  if (!window.confirm('Replace all data on this device?')) return
                  const result = store.applyBackup(payload)
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
