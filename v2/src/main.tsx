import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme/theme.css'
import './app/app.css'
import { App } from './app/App'
import { studio } from './app/store'

// Dev-only handle for console debugging: `__artinos.studio.setEnabled('effect.bloom', false)`.
if (import.meta.env.DEV) Object.assign(window, { __artinos: { studio } })

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
