# Input / Signal System

All devices and media analysis converge on `SignalRegistry`; modules consume semantic signals rather than owning browser listeners or high-frequency React state.

## Immediate inputs

- pointer / mouse / touch / pen position, NDC, delta, velocity, speed, pressure, tilt, buttons and wheel,
- keyboard keys and modifiers,
- gamepad axes/buttons/pressed states,
- viewport size/aspect/DPR.

## Permission-gated inputs

### Audio

Microphone analysis provides RMS, peak, envelope, sub/bass/lowMid/mid/highMid/high, beat, sample rate, waveform and spectrum. The Input panel can also load an ordinary audio file; it is analyzed through the same Web Audio pipeline and exposed as `media.audio.element`.

### Webcam / vision

The base camera path exposes video as `media.vision.video` plus luminance, average RGB, motion energy/centroid and video size.

Advanced Vision creates one module worker and transfers at most one `ImageBitmap` at a time. MediaPipe hand/face/pose/gesture/object tasks execute in that worker; the main thread receives normalized results and publishes smoothed pointer, depth, gesture, swipe, skeleton and object signals plus latency p50/p95, drop and backlog telemetry. Quality scales inference cadence from 8–30 FPS.

### Other devices

Web MIDI exposes CC, notes and pitch bend. DeviceOrientation exposes alpha/beta/gamma. Input status and errors are semantic telemetry.

## Recording / replay

`SignalRecorder` records any live signal stream, exports/imports JSON and replays through the ARTINOS frame coordinator—useful for reproducing interactive sessions without the original device.

## Processing, actions and commands

InputFlow includes a runtime-owned semantic interaction layer:

- `SignalProcessor` turns any live signal into a reusable named pipeline with scale, offset, clamp, deadzone, smoothing, curve and inversion operators.
- `CommandRegistry` owns executable project commands such as save, apply preset, set parameter and change quality tier.
- `ActionRegistry` maps a signal or explicit trigger to one or more commands, with threshold, edge and cooldown policies.

The Inspector's **InputFlow → Signals / Actions** views author these contracts without adding another main workspace panel. Pipelines and action definitions are part of the unified project snapshot; browser/device listeners remain isolated in `@artinos/inputflow`.
