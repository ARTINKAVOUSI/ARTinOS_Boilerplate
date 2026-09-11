import { useSyncExternalStore } from 'react'
import { useArtinosRuntime } from '@artinos/runtime'
import { usePoll, useThrottledRevision } from '../headless'

/**
 * Runtime subscriptions for panels.
 *
 * Every store here publishes far faster than a panel needs to redraw — telemetry samples
 * every frame — so reads are throttled. Panels get live numbers without turning the dock
 * into a 60 Hz render loop that competes with the scene.
 */

/** ~10 Hz: fast enough to read, slow enough to stay off the frame budget. */
const PANEL_RATE = 100

export function useTelemetry() {
  const runtime = useArtinosRuntime()
  useThrottledRevision(runtime.telemetry, PANEL_RATE)
  return runtime.telemetry.list()
}

export function useResources() {
  const runtime = useArtinosRuntime()
  useThrottledRevision(runtime.resources, PANEL_RATE)
  return runtime.resources.list()
}

export function useLogs() {
  const runtime = useArtinosRuntime()
  useThrottledRevision(runtime.logger, PANEL_RATE)
  return runtime.logger.list()
}

export function useModules() {
  const runtime = useArtinosRuntime()
  useThrottledRevision(runtime.modules, PANEL_RATE)
  return runtime.modules.list()
}

export function useSignals() {
  const runtime = useArtinosRuntime()
  usePoll(PANEL_RATE)
  return runtime.signals.list()
}

export function useParameters() {
  const runtime = useArtinosRuntime()
  usePoll(PANEL_RATE)
  return runtime.parameters.list()
}

export function useQuality() {
  const runtime = useArtinosRuntime()
  return useSyncExternalStore(
    runtime.quality.subscribe.bind(runtime.quality),
    runtime.quality.getState.bind(runtime.quality),
    runtime.quality.getState.bind(runtime.quality),
  )
}

export function useHistory() {
  const runtime = useArtinosRuntime()
  useSyncExternalStore(
    runtime.history.subscribe.bind(runtime.history),
    () => runtime.history.snapshot().undo.length + runtime.history.snapshot().redo.length,
    () => 0,
  )
  return runtime.history.snapshot()
}
