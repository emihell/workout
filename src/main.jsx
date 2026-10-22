import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/ui.css'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))

// req-230 — `__SYNC__` is a build-time constant (vite.config.js): true only in the server build
// (`npm run build:server`). In every other build the branch below is dead code and is dropped
// from the bundle with the module it imports, so the Pages build is the app as it was.
if (__SYNC__) {
  import('./sync/boot.jsx').then(({ renderSyncApp }) => renderSyncApp(root))
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
