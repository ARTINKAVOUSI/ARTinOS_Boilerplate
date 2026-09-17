import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/studio/skin/skin.css'
import './app/app.css'
import { installConsoleCapture } from './app/console'
import { App } from './app/App'
import { studio } from './app/store'

installConsoleCapture()

// Dev-only handle for console debugging: `__artinos.studio.setEnabled('effect.bloom', false)`.
if (import.meta.env.DEV) Object.assign(window, { __artinos: { studio } })

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
