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
  return `Restored ${summary.routines} routines, ${summary.exercises} exercises, ${summary.workouts} history workouts, ${summary.slots} schedule slots.`
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
        This app keeps data in this browser only. Export the whole database to move it, or to talk
        through the file with an assistant. Import replaces everything on this device.
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={includeAssistant}
            onChange={(event) => setIncludeAssistant(event.target.checked)}
          />{' '}
          Include assistant prompt
        </label>
      </p>
      {includeAssistant ? (
        <p>
          The file will include a prompt so an AI can see how the app is set up, ask you about the
          coming weeks, suggest routine and schedule changes, and return a file this app can import.
        </p>
      ) : null}
      <p>
        <button
          type="button"
          onClick={() => {
            downloadJson(
              `workout-database-${dateKey(new Date())}.json`,
              buildBackup(store, { includeAssistant }),
            )
            setError('')
            setMessage(
              includeAssistant
                ? 'Database downloaded with assistant prompt.'
                : 'Database backup downloaded.',
            )
          }}
        >
          Export database
        </button>
      </p>
      <p>
        <label>
          Import database
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
                  if (
                    !window.confirm(
                      'Replace all data on this device with this backup? Current routines, schedule, and history will be gone.',
                    )
                  ) {
                    return
                  }
                  const result = store.applyBackup(payload)
                  setError('')
                  setMessage(backupLines(result.summary))
                } catch (err) {
                  setMessage('')
                  setError(err instanceof Error ? err.message : 'Could not import that file.')
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
