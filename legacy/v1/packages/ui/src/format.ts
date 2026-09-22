/** Shared value formatting for panels. Kept in one place so readouts stay consistent. */

export function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    const head = value.slice(0, 8).map(entry => (typeof entry === 'number' ? entry.toFixed(3) : String(entry)))
    return head.join(', ') + (value.length > 8 ? ' …' : '')
  }
  if (typeof value === 'number') return value.toFixed(4)
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

export function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return String(Math.round(value))
}

export function describeResource(value: unknown): string {
  if (value == null) return 'null'
  return (value as { constructor?: { name?: string } }).constructor?.name ?? typeof value
}

export function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of items) (out[key(item)] ??= []).push(item)
  return out
}
