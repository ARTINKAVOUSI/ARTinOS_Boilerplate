/** Where the dock layout is saved. */
export const DOCK_LAYOUT_KEY = 'artinos.v2.dock'

let resetting = false
/** True once a reset has started, so nothing writes the old layout back on the way out. */
export const isResettingLayout = () => resetting

/** Forget the saved dock arrangement and reload with the defaults. */
export function resetDockLayout() {
  resetting = true
  try {
    localStorage.removeItem(DOCK_LAYOUT_KEY)
  } catch {
    /* storage unavailable */
  }
  location.reload()
}
