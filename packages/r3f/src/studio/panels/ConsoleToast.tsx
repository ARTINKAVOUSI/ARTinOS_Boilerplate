import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useArtinosRuntime } from '@artinos/runtime'

const LINGER_MS = 5000
/** Runtime adapter kept in panels so the portable shell remains dependency-free. */
export function ConsoleToast({ onOpenConsole }: { onOpenConsole?(): void }) {
  const runtime = useArtinosRuntime()
  const revision = useSyncExternalStore(callback => runtime.logger.subscribe(callback), () => runtime.logger.revision, () => 0)
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | null>(null)
  const logs = runtime.logger.list()
  const latest = logs.at(-1)
  const level = latest?.level ?? 'info'
  useEffect(() => {
    if (!latest) return
    setVisible(true)
    if (timer.current) window.clearTimeout(timer.current)
    if (level !== 'error') timer.current = window.setTimeout(() => setVisible(false), LINGER_MS)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [revision, latest, level])
  if (!latest) return null
  return <output className="plate-console-toast" data-level={level} data-visible={visible || undefined} aria-live={level === 'error' ? 'assertive' : 'polite'} onPointerEnter={() => { if (timer.current) clearTimeout(timer.current); setVisible(true) }} onPointerLeave={() => { if (level !== 'error') timer.current = window.setTimeout(() => setVisible(false), LINGER_MS) }}>
    <i aria-hidden /><span className="plate-console-toast-message">{latest.message}</span><button type="button" className="plate-console-toast-open" onClick={onOpenConsole} aria-label="Open console" title="Open console">{logs.length}</button>
  </output>
}
