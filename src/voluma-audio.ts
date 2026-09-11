type SignalWriter = { set(id: string, value: number): void }

/**
 * A small, self-contained Web Audio feature source for the studio's Demo Audio
 * button. It exercises the same signal paths as a microphone/file analyser:
 * frequency bands, RMS, centroid, spectral flux and onset are published into
 * the ARTINOS signal bus every animation frame.
 */
export class DemoAudioEngine {
  private context?: AudioContext
  private analyser?: AnalyserNode
  private oscillators: OscillatorNode[] = []
  private gains: GainNode[] = []
  private stream?: MediaStream
  private element?: HTMLAudioElement
  private objectUrl?: string
  private nextBeat = 0
  private beat = 0
  private onsetCooldown = 0
  private peakHold = 0
  private previous?: Uint8Array<ArrayBuffer>

  constructor(private readonly signals: SignalWriter) {}

  async start() {
    if (this.context) return
    const context = new AudioContext()
    await context.resume()
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = .72
    const monitor = context.createGain()
    monitor.gain.value = 0
    analyser.connect(monitor).connect(context.destination)

    ;[
      { frequency: 55, type: 'sine' as OscillatorType, gain: .7 },
      { frequency: 220, type: 'triangle' as OscillatorType, gain: .22 },
      { frequency: 1760, type: 'sawtooth' as OscillatorType, gain: .06 },
    ].forEach(item => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = item.type
      oscillator.frequency.value = item.frequency
      gain.gain.value = item.gain
      oscillator.connect(gain).connect(analyser)
      oscillator.start()
      this.oscillators.push(oscillator)
      this.gains.push(gain)
    })

    this.context = context
    this.analyser = analyser
    this.nextBeat = context.currentTime
  }

  async startMicrophone() {
    if (this.context) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const context = new AudioContext()
    await context.resume()
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = .72
    context.createMediaStreamSource(stream).connect(analyser)
    this.stream = stream
    this.context = context
    this.analyser = analyser
  }

  async startFile(file: File) {
    if (this.context) return
    const context = new AudioContext()
    await context.resume()
    const analyser = context.createAnalyser()
    analyser.fftSize = 4096
    analyser.smoothingTimeConstant = .68
    const objectUrl = URL.createObjectURL(file)
    const element = new Audio(objectUrl)
    element.loop = true
    element.crossOrigin = 'anonymous'
    context.createMediaElementSource(element).connect(analyser)
    analyser.connect(context.destination)
    await element.play()
    this.objectUrl = objectUrl
    this.element = element
    this.context = context
    this.analyser = analyser
  }

  sample() {
    const analyser = this.analyser
    const context = this.context
    if (!analyser || !context) return
    if (context.currentTime >= this.nextBeat) {
      this.beat++
      this.nextBeat = context.currentTime + .52
      const now = context.currentTime
      const bassGain = this.gains[0]?.gain
      bassGain?.cancelScheduledValues(now)
      bassGain?.setValueAtTime(.95, now)
      bassGain?.exponentialRampToValueAtTime(.08, now + .34)
      this.gains[1]?.gain.setTargetAtTime(.12 + ((this.beat % 3) * .08), now, .08)
      this.gains[2]?.gain.setTargetAtTime(this.beat % 2 ? .035 : .12, now, .025)
    }
    const bins = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(bins)
    const hzPerBin = context.sampleRate / analyser.fftSize
    const band = (low: number, high: number) => {
      const from = Math.max(0, Math.floor(low / hzPerBin))
      const to = Math.min(bins.length, Math.ceil(high / hzPerBin))
      let sum = 0
      for (let index = from; index < to; index++) sum += bins[index]
      return to > from ? sum / (to - from) / 255 : 0
    }
    let energy = 0, weighted = 0, magnitude = 0, flux = 0, peak = 0, dominantBin = 0
    for (let index = 0; index < bins.length; index++) {
      const value = bins[index] / 255
      energy += value * value
      weighted += value * index * hzPerBin
      magnitude += value
      if (value > peak) { peak = value; dominantBin = index }
      if (this.previous) flux += Math.max(0, bins[index] - this.previous[index]) / 255
    }
    const bass = band(28, 140), lowMid = band(140, 400), mid = band(400, 1800), highMid = band(1800, 5200), treble = band(5200, 16000)
    const rms = Math.sqrt(energy / bins.length)
    const normalizedFlux = Math.min(1, flux / 16)
    const now = performance.now()
    const onset = flux > 10 && now >= this.onsetCooldown ? 1 : 0
    if (onset) this.onsetCooldown = now + 120
    this.peakHold = Math.max(peak, this.peakHold * .972)
    this.signals.set('audio.bass', bass)
    this.signals.set('audio.lowMid', lowMid)
    this.signals.set('audio.mid', mid)
    this.signals.set('audio.highMid', highMid)
    this.signals.set('audio.treble', treble)
    this.signals.set('audio.rms', rms)
    this.signals.set('audio.peak', peak)
    this.signals.set('audio.energy', energy / bins.length)
    this.signals.set('audio.crest', peak / Math.max(.001, rms))
    this.signals.set('audio.peakHold', this.peakHold)
    this.signals.set('audio.centroid', weighted / Math.max(.001, magnitude))
    this.signals.set('audio.dominantBin', dominantBin * hzPerBin)
    this.signals.set('audio.flux', normalizedFlux)
    this.signals.set('audio.onset', onset)
    this.signals.set('audio.beat', onset)
    this.signals.set('audio.phase', this.context ? (this.context.currentTime % .52) / .52 : 0)
    this.previous = bins
  }

  stop() {
    this.oscillators.forEach(oscillator => oscillator.stop())
    void this.context?.close()
    this.stream?.getTracks().forEach(track => track.stop())
    this.element?.pause()
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.context = undefined
    this.analyser = undefined
    this.oscillators = []
    this.gains = []
    this.stream = undefined
    this.element = undefined
    this.objectUrl = undefined
    this.previous = undefined
    this.beat = 0
    this.nextBeat = 0
    this.onsetCooldown = 0
    this.peakHold = 0
    ;['bass', 'lowMid', 'mid', 'highMid', 'treble', 'rms', 'peak', 'energy', 'crest', 'peakHold', 'centroid', 'dominantBin', 'flux', 'onset', 'beat', 'phase'].forEach(feature => this.signals.set(`audio.${feature}`, 0))
  }
}
