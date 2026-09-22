import { useSyncExternalStore } from 'react'

/**
 * The shared camera. One feature opens the stream and publishes the video
 * element here; anything that wants to show or sample it reads from here, so a
 * page never opens the camera twice.
 *
 * Deleting every feature that uses it leaves this module unused and harmless.
 */

let video: HTMLVideoElement | null = null
const listeners = new Set<() => void>()

export const webcam = {
  set(next: HTMLVideoElement | null) {
    if (video === next) return
    video = next
    listeners.forEach(listener => listener())
  },
  get: () => video,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** The live camera element, or null while nothing is capturing. */
export function useWebcamVideo() {
  return useSyncExternalStore(webcam.subscribe, webcam.get, webcam.get)
}
