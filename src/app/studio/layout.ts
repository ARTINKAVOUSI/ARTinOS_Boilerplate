/** Where the dock layout is saved. */
export const DOCK_LAYOUT_KEY = 'artinos.v2.dock'

/** Forget the saved dock arrangement and reload with the defaults. */
export function resetDockLayout() {
  try {
    localStorage.removeItem(DOCK_LAYOUT_KEY)
  } catch {
    /* storage unavailable */
  }
  location.reload()
}
