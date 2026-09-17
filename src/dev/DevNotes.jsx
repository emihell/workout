// req-86 (N8) / req-87 — the "note on this page" button + capture panel.
//
// req-87 — this now SHIPS in the production build; it is gated at RUNTIME by the
// feedback toggle (App.jsx's FeedbackNotesGate renders it only when ON, default
// OFF). It is only ever mounted when enabled, so this component assumes it should
// render; the on/off decision lives in the gate, not here.
//
// Styling is entirely inline (no ui.css classes) so the shared production
// stylesheet carries nothing from this feature. req-88: the button lives in the
// TOP-RIGHT corner, clear of the bottom dock, at full opacity so it reads as an
// obviously-there control (not the faint bottom-left dot it was in req-86). It
// sits on EVERY screen — including the in-workout flow where the bottom menu is
// hidden — because that is exactly when a flaw gets spotted ("while doing an
// exercise"). Both button and panel respect the iOS safe-area/notch on top+right.
import { useState } from 'react'
import { useHashRoute } from '../route'
import { dropNotes, loadNotes, notesJson, saveNote } from './dev-notes.js'

const Z = 2147483000 // above every app surface, incl. the bottom dock

// Top/right offsets that fold in the safe-area insets, so the fixed controls
// clear the notch/rounded corner on iOS and sit at a plain 12px gap elsewhere.
const TOP = 'calc(env(safe-area-inset-top, 0px) + 12px)'
const RIGHT = 'calc(env(safe-area-inset-right, 0px) + 12px)'

const panelStyle = {
  position: 'fixed',
  top: TOP,
  right: RIGHT,
  zIndex: Z,
  width: 'min(360px, calc(100vw - 24px))',
  maxHeight: 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px)',
  overflowY: 'auto',
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
  top: TOP,
  right: RIGHT,
  zIndex: Z,
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: '1px solid #111',
  background: '#fff',
  color: '#111',
  opacity: 1,
  font: '18px/1 system-ui, sans-serif',
  cursor: 'pointer',
  padding: 0,
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
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
        // req-95 — an explicit 16px font (NOT the panel's inherited 13px): iOS Safari
        // auto-zooms a focused input whose font-size is < 16px, which pushed this
        // fixed, top-right panel off-screen. 16px is the threshold; the rest of the
        // panel stays compact. Fix is here, not the index.html viewport (that would
        // kill pinch-zoom app-wide).
        style={{ width: '100%', boxSizing: 'border-box', font: '16px/1.4 system-ui, sans-serif', padding: 8, borderRadius: 6, border: '1px solid #999', resize: 'vertical' }}
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
