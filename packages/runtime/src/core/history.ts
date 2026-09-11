import type { ParameterSourceInfo, ParameterValue, Unsubscribe } from './types'

export interface HistoryEntry { id: string; parameterId: string; before: ParameterValue; after: ParameterValue; timestamp: number; label?: string; source?: ParameterSourceInfo['kind'] }

/**
 * A transaction collapses many writes into one undo step, and may span several
 * parameters. Dragging a slider through a thousand values is one action to the
 * user, so it must be one action to history.
 */
export interface HistoryTransaction { id: string; label?: string; source?: ParameterSourceInfo['kind']; entries: HistoryEntry[] }

export function parameterValuesEqual(a: ParameterValue, b: ParameterValue): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export class HistoryStore {
  private undoStack: HistoryTransaction[] = []
  private redoStack: HistoryTransaction[] = []
  private listeners = new Set<() => void>()
  private open: HistoryTransaction | null = null
  private depth = 0
  constructor(private readonly limit = 200) {}

  /**
   * Opens a transaction. Nested calls join the outermost one, so a composite
   * control that drives several parameters still commits a single action.
   */
  begin(label?: string, source?: ParameterSourceInfo['kind']): void {
    this.depth++
    if (!this.open) this.open = { id: `tx:${performance.now()}`, label, source, entries: [] }
    else if (label && !this.open.label) this.open.label = label
  }

  get isOpen(): boolean { return this.open !== null }

  push(entry: HistoryEntry) {
    if (this.open) {
      // Collapse repeats on the same parameter: keep the first `before` and the
      // latest `after`, which is what makes a drag one entry instead of a thousand.
      const existing = this.open.entries.find(e => e.parameterId === entry.parameterId)
      if (existing) existing.after = entry.after
      else this.open.entries.push(entry)
      return
    }
    this.commitTransaction({ id: entry.id, label: entry.label, entries: [entry] })
  }

  /** Closes the outermost transaction. Inner commits are no-ops. */
  commit(): void {
    if (this.depth > 0) this.depth--
    if (this.depth > 0 || !this.open) return
    const tx = this.open
    this.open = null
    // A gesture that ended where it started is not an action.
    const changed = tx.entries.filter(e => !parameterValuesEqual(e.before, e.after))
    if (changed.length) this.commitTransaction({ ...tx, entries: changed })
    else this.emit()
  }

  /** Discards the open transaction and optionally restores every authored origin. */
  abort(apply?: (id: string, value: ParameterValue) => void): void {
    if (apply && this.open) {
      for (let i = this.open.entries.length - 1; i >= 0; i--) apply(this.open.entries[i].parameterId, this.open.entries[i].before)
    }
    this.depth = 0
    this.open = null
    this.emit()
  }

  private commitTransaction(tx: HistoryTransaction) {
    this.undoStack.push(tx)
    if (this.undoStack.length > this.limit) this.undoStack.shift()
    this.redoStack = []
    this.emit()
  }

  undo(apply: (id: string, value: ParameterValue) => void) {
    const tx = this.undoStack.pop(); if (!tx) return false
    for (let i = tx.entries.length - 1; i >= 0; i--) apply(tx.entries[i].parameterId, tx.entries[i].before)
    this.redoStack.push(tx); this.emit(); return true
  }

  redo(apply: (id: string, value: ParameterValue) => void) {
    const tx = this.redoStack.pop(); if (!tx) return false
    for (const e of tx.entries) apply(e.parameterId, e.after)
    this.undoStack.push(tx); this.emit(); return true
  }

  clear() { this.undoStack = []; this.redoStack = []; this.open = null; this.depth = 0; this.emit() }

  /** Flattened for display; `transactions()` preserves the grouping. */
  snapshot() {
    return { undo: this.undoStack.flatMap(t => t.entries), redo: this.redoStack.flatMap(t => t.entries) }
  }
  transactions() { return { undo: [...this.undoStack], redo: [...this.redoStack] } }

  subscribe(fn: () => void): Unsubscribe { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit() { this.listeners.forEach(fn => fn()) }
}
