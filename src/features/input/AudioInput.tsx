import { useEffect, useRef, type ReactNode } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from '../../app/signals'

export interface AudioInputProps {
  children?: ReactNode
  /** `microphone` asks for permission when switched on. */
  source?: 'off' | 'microphone'
  /** Multiplies every band. */
  gain?: number
  /** Analyser smoothing, 0–0.95. */
  smoothing?: number
  /** Called with a readable status for the UI. */
  onStatus?: (status: 'off' | 'starting' | 'on' | 'denied' | 'unsupported') => void
}

/**
 * AudioInput — microphone analysis published as signals, all 0…1:
 * `audio.level` (RMS envelope), `audio.bass`, `audio.mid`, `audio.treble`,
 * and `audio.beat` (1 on a detected bass onset, decaying).
 *
 * Browsers only allow audio after a user gesture; turning `source` on from a
 * click satisfies that.
 */
export function AudioInput({ children, source = 'off', gain = 1, smoothing = 0.72, onStatus }: AudioInputProps) {
  const bus = useSignals()
  useSignalCleanup('audio')
  // Tuning changes apply live instead of restarting the microphone.
  const tuning = useRef({ gain, smoothing, analyser: null as AnalyserNode | null })
  tuning.current.gain = gain
  tuning.current.smoothing = smoothing
  if (tuning.current.analyser) tuning.current.analyser.smoothingTimeConstant = smoothing

  useEffect(() => {
    const report = (status: 'off' | 'starting' | 'on' | 'denied' | 'unsupported') => onStatus?.(status)
    if (source === 'off') {
      report('off')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      report('unsupported')
      return
    }

    let cancelled = false
    let stop = () => {}
    report('starting')

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then(async stream => {
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        const context = new AudioContext()
        await context.resume()
        const input = context.createMediaStreamSource(stream)
        const analyser = context.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = tuning.current.smoothing
        tuning.current.analyser = analyser
        input.connect(analyser)

        const frequencies = new Uint8Array(analyser.frequencyBinCount)
        const wave = new Uint8Array(analyser.fftSize)
        const nyquist = context.sampleRate / 2
        const band = (low: number, high: number) => {
          const from = Math.floor((low / nyquist) * frequencies.length)
          const to = Math.max(from + 1, Math.floor((high / nyquist) * frequencies.length))
          let sum = 0
          for (let i = from; i < to; i++) sum += frequencies[i]
          return sum / (to - from) / 255
        }

        let envelope = 0
        let beat = 0
        let bassMean = 0
        let frame = 0
        let previous = performance.now()
        const tick = (now: number) => {
          const dt = Math.min(0.1, (now - previous) / 1000)
          previous = now
          analyser.getByteFrequencyData(frequencies)
          analyser.getByteTimeDomainData(wave)
          let square = 0
          for (const sample of wave) {
            const x = (sample - 128) / 128
            square += x * x
          }
          const rms = Math.sqrt(square / wave.length)
          envelope += (rms > envelope ? 0.4 : 0.08) * (rms - envelope)
          const bass = band(20, 180)
          // A bass onset is a jump well above its running mean.
          if (bass > bassMean * 1.35 + 0.05 && beat < 0.3) beat = 1
          bassMean += (bass - bassMean) * 0.05
          beat *= Math.exp(-8 * dt)
          const clip = (v: number) => Math.min(1, v * tuning.current.gain)
          bus.set('audio.level', clip(envelope * 3))
          bus.set('audio.bass', clip(bass))
          bus.set('audio.mid', clip(band(180, 2000) * 1.2))
          bus.set('audio.treble', clip(band(2000, 12000) * 1.8))
          bus.set('audio.beat', beat)
          frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        report('on')

        stop = () => {
          cancelAnimationFrame(frame)
          input.disconnect()
          tuning.current.analyser = null
          stream.getTracks().forEach(track => track.stop())
          void context.close()
        }
      })
      .catch(error => {
        if (cancelled) return
        console.warn('[audio] microphone unavailable', error)
        report('denied')
      })

    return () => {
      cancelled = true
      stop()
      bus.delete('audio')
    }
  }, [bus, source, onStatus])

  return <>{children}</>
}

export default AudioInput

export const feature: Feature = {
  id: 'input.audio',
  label: 'Audio',
  kind: 'app',
  group: 'Input',
  order: 12,
  description: 'audio.level / bass / mid / treble / beat from the microphone',
  component: AudioInput,
  controls: {
    source: { type: 'select', value: 'off', options: ['off', 'microphone'] },
    gain: { type: 'number', value: 1.4, min: 0, max: 4, step: 0.01 },
    smoothing: { type: 'number', value: 0.72, min: 0, max: 0.95, step: 0.01 },
  },
}
