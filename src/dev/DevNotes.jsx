// req-86 (N8) / req-87 — the "note on this page" button + capture panel.
//
// req-87 — this now SHIPS in the production build; it is gated at RUNTIME by the
// feedback toggle (App.jsx's FeedbackNotesGate renders it only when ON, default
// OFF). It is only ever mounted when enabled, so this component assumes it should
// render; the on/off decision lives in the gate, not here.
//
// Styling is entirely inline (no ui.css classes) so the shared production
// stylesheet carries nothing from this feature. The button is small and unimposing
// (bottom-left, low opacity until tapped) and sits on EVERY screen — including the
// in-workout flow where the bottom menu is hidden — because that is exactly when a
// flaw gets spotted ("while doing an exercise").
import { useState } from 'react'
import { useHashRoute } from '../route'
import { dropNotes, loadNotes, notesJson, saveNote } from './dev-notes.js'

const Z = 2147483000 // above every app surface, incl. the bottom dock

const panelStyle = {
  position: 'fixed',
  left: 12,
  bottom: 12,
  zIndex: Z,
  width: 'min(360px, calc(100vw - 24px))',
  background: '#fff',
  color: '#111',
  border: '1px solid #111',
  borderRadius: 10,
  padding: 12,
  boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
  font: '13px/1.4 system-ui, sans-serif',
}

const buttonStyle = {
  position: 'fixed',
  left: 12,
  bottom: 12,
  zIndex: Z,
  width: 34,
  height: 34,
  borderRadius: '50%',
  border: '1px solid #111',
  background: '#fff',
  color: '#111',
  opacity: 0.45,
  font: '15px/1 system-ui, sans-serif',
  cursor: 'pointer',
  padding: 0,
}

const smallBtn = {
  font: '12px/1 system-ui, sans-serif',
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid #111',
  background: '#fff',
  color: '#111',
  cursor: 'pointer',
}

export function DevNotes() {
  const routeInfo = useHashRoute()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [count, setCount] = useState(() => loadNotes().length)
  const [status, setStatus] = useState('')

  const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') || '/' : '/'

  if (!open) {
    return (
      <button
        type="button"
        style={buttonStyle}
        title="Note on this page"
        aria-label="Note on this page"
        onClick={() => {
          setStatus('')
          setOpen(true)
        }}
      >
        ✎
      </button>
    )
  }

  const save = () => {
    if (!text.trim()) {
      setStatus('Type something first.')
      return
    }
    const notes = saveNote({ text, routeInfo, hash }, new Date().toISOString())
    setCount(notes.length)
    setText('')
    setStatus('Saved.')
  }

  const copy = async () => {
    const json = notesJson(loadNotes())
    try {
      await navigator.clipboard.writeText(json)
      setStatus('Copied JSON to clipboard.')
    } catch {
      // Clipboard API can be unavailable (insecure context) — log so it is still
      // recoverable from the console, and say so.
      // eslint-disable-next-line no-console
      console.log('[dev-notes] clipboard blocked; notes JSON below:\n' + json)
      setStatus('Clipboard blocked — JSON logged to console.')
    }
  }

  const clear = () => {
    dropNotes()
    setCount(0)
    setStatus('Cleared.')
  }

  return (
    <div style={panelStyle} role="dialog" aria-label="Dev note capture">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>Note on this page</strong>
        <button type="button" style={{ ...smallBtn, border: 'none' }} aria-label="Close" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <div style={{ color: '#555', wordBreak: 'break-all', marginBottom: 8 }}>{hash}</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        autoFocus
        placeholder="What's the flaw or improvement here?"
        style={{ width: '100%', boxSizing: 'border-box', font: 'inherit', padding: 8, borderRadius: 6, border: '1px solid #999', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...smallBtn, background: '#111', color: '#fff' }} onClick={save}>
          Save
        </button>
        <button type="button" style={smallBtn} onClick={copy}>
          Copy JSON ({count})
        </button>
        <button type="button" style={smallBtn} onClick={clear}>
          Clear
        </button>
      </div>
      {status ? <div style={{ marginTop: 8, color: '#333' }}>{status}</div> : null}
    </div>
  )
}
