/** Matches the RGB IOR offsets used by the transmission shader. */
export function glassOptics(ior: number, dispersion: number) {
  const n = Math.max(1, ior)
  const spread = (n - 1) * dispersion * 0.025
  return {
    red: Math.max(1, n - spread), green: n, blue: n + spread,
    criticalAngle: Math.asin(1 / n) * 180 / Math.PI,
    reflectance: ((n - 1) / (n + 1)) ** 2,
  }
}

export function refractedAngle(incidentDegrees: number, ior: number, exiting = false) {
  const n = Math.max(1, ior)
  const sine = Math.sin(incidentDegrees * Math.PI / 180) * (exiting ? n : 1 / n)
  // No refracted ray exists above the critical angle (total internal reflection).
  return sine > 1 + 1e-12 ? NaN : Math.asin(Math.min(1, sine)) * 180 / Math.PI
}
