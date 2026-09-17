import { useEffect, useState } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from './signals'

export interface MidiInputProps {
  /** Only listen to this channel (1–16). 0 listens to all of them. */
  channel?: number
  /** Held notes decay to zero over this many seconds after release. 0 is instant. */
  release?: number
}

type MidiMessage = { data: Uint8Array }
type MidiPort = { name?: string | null; onmidimessage: ((event: MidiMessage) => void) | null }
type MidiAccess = { inputs: { values(): Iterable<MidiPort> }; onstatechange: (() => void) | null }

/**
 * MidiInput — publishes Web MIDI as signals:
 *
 *   `midi.cc.<number>`     0…1 continuous controller
 *   `midi.note.<number>`   0…1 velocity, decaying after note-off
 *   `midi.note`            the last note number played
 *   `midi.velocity`        the last velocity
 *   `midi.bend`            −1…1 pitch bend
 *   `midi.devices`         how many inputs are connected
 *
 * Asks for MIDI access on mount; browsers that refuse it publish nothing.
 */
export function MidiInput({ channel = 0, release = 0.25 }: MidiInputProps) {
  const bus = useSignals()
  const [error, setError] = useState<string | null>(null)
  useSignalCleanup('midi')

  useEffect(() => {
    let access: MidiAccess | null = null
    let stopped = false
    let frame = 0
    const held = new Map<number, number>()
    const fading = new Map<number, { value: number; at: number }>()

    const onMessage = (event: MidiMessage) => {
      const [status, first, second] = event.data
      const command = status & 0xf0
      const onChannel = (status & 0x0f) + 1
      if (channel && onChannel !== channel) return
      if (command === 0x90 && second > 0) {
        const velocity = second / 127
        held.set(first, velocity)
        fading.delete(first)
        bus.set(`midi.note.${first}`, velocity)
        bus.set('midi.note', first)
        bus.set('midi.velocity', velocity)
      } else if (command === 0x80 || (command === 0x90 && second === 0)) {
        const velocity = held.get(first) ?? 0
        held.delete(first)
        if (release > 0) fading.set(first, { value: velocity, at: performance.now() })
        else bus.set(`midi.note.${first}`, 0)
      } else if (command === 0xb0) {
        bus.set(`midi.cc.${first}`, second / 127)
      } else if (command === 0xe0) {
        bus.set('midi.bend', ((second * 128 + first) / 8192 - 1) * 1)
      }
    }

    const listen = () => {
      if (!access) return
      let count = 0
      for (const input of access.inputs.values()) {
        count++
        input.onmidimessage = onMessage
      }
      bus.set('midi.devices', count)
    }

    const tick = (now: number) => {
      for (const [note, entry] of fading) {
        const life = 1 - (now - entry.at) / (release * 1000)
        if (life <= 0) {
          fading.delete(note)
          bus.set(`midi.note.${note}`, 0)
        } else {
          bus.set(`midi.note.${note}`, entry.value * life)
        }
      }
      frame = requestAnimationFrame(tick)
    }

    const request = (navigator as Navigator & { requestMIDIAccess?: () => Promise<MidiAccess> }).requestMIDIAccess
    if (!request) {
      setError('This browser has no Web MIDI.')
      return
    }
    request
      .call(navigator)
      .then(granted => {
        if (stopped) return
        access = granted
        access.onstatechange = listen
        listen()
        frame = requestAnimationFrame(tick)
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      if (!access) return
      for (const input of access.inputs.values()) input.onmidimessage = null
      access.onstatechange = null
    }
  }, [bus, channel, release])

  useEffect(() => {
    if (error) console.warn(`[input.midi] ${error}`)
  }, [error])

  return null
}

export default MidiInput

export const feature: Feature = {
  id: 'input.midi',
  label: 'MIDI',
  kind: 'app',
  group: 'Input',
  order: 14,
  enabled: false,
  description: 'midi.cc.<n>, midi.note.<n>, midi.bend',
  component: MidiInput,
  controls: {
    channel: { type: 'number', value: 0, min: 0, max: 16, step: 1, label: 'Channel (0 = all)' },
    release: { type: 'number', value: 0.25, min: 0, max: 4, step: 0.05, unit: 's' },
  },
}
