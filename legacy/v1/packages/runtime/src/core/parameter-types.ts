import {
  BUILT_IN_PARAMETER_KINDS,
  type AssetReference,
  type BuiltInParameterKind,
  type CurveValue,
  type EnvelopeValue,
  type GradientValue,
  type ParameterDefinition,
  type ParameterKind,
  type ParameterPresentationHints,
  type ParameterValidationResult,
  type ParameterValue,
  type Scalar,
  type UnitDefinition,
  type Unsubscribe,
} from './types'

export interface ParameterTypeDefinition<T extends ParameterValue = ParameterValue> {
  id: ParameterKind
  presentations: string[]
  infer(value: unknown, hints?: ParameterPresentationHints): boolean
  normalize(value: unknown, definition?: ParameterDefinition<T>): T
  validate(value: unknown, definition?: ParameterDefinition<T>): ParameterValidationResult
  format(value: T, definition?: ParameterDefinition<T>, locale?: string): string
  parse(input: string, definition?: ParameterDefinition<T>): T
  serialize(value: T, definition?: ParameterDefinition<T>): unknown
  deserialize(value: unknown, definition?: ParameterDefinition<T>): T
  interpolate?(from: T, to: T, amount: number, definition?: ParameterDefinition<T>): T
}

const valid = (): ParameterValidationResult => ({ valid: true })
const invalid = (code: string, message: string): ParameterValidationResult => ({ valid: false, code, message })
const clone = <T>(value: T): T => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)) as T
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const numericArray = (value: unknown, length?: number): value is number[] =>
  Array.isArray(value) && (length === undefined || value.length === length) && value.every(isFiniteNumber)

function applyNumberConstraints(value: number, definition?: ParameterDefinition): number {
  let next = Number.isFinite(value) ? value : Number(definition?.defaultValue ?? 0)
  if (typeof definition?.min === 'number') next = Math.max(definition.min, next)
  if (typeof definition?.max === 'number') next = Math.min(definition.max, next)
  return next
}

function unitLabel(definition?: ParameterDefinition): string {
  if (!definition?.unit) return ''
  return typeof definition.unit === 'string' ? definition.unit : definition.unit.symbol
}

function numericType(id: BuiltInParameterKind, presentations: string[], integer = false): ParameterTypeDefinition<number> {
  return {
    id,
    presentations,
    infer: isFiniteNumber,
    normalize: (value, definition) => {
      const next = applyNumberConstraints(Number(value), definition)
      return integer ? Math.round(next) : next
    },
    validate: (value, definition) => {
      if (!isFiniteNumber(value)) return invalid('type', `${id} requires a finite number`)
      if (integer && !Number.isInteger(value)) return invalid('integer', 'Value must be an integer')
      if (typeof definition?.min === 'number' && value < definition.min) return invalid('min', `Value must be at least ${definition.min}`)
      if (typeof definition?.max === 'number' && value > definition.max) return invalid('max', `Value must be at most ${definition.max}`)
      return valid()
    },
    format: (value, definition, locale) => `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: definition?.presentation?.precision ?? 6,
    }).format(value)}${unitLabel(definition) ? ` ${unitLabel(definition)}` : ''}`,
    parse: (input, definition) => {
      const parsed = Number.parseFloat(input)
      return integer ? Math.round(applyNumberConstraints(parsed, definition)) : applyNumberConstraints(parsed, definition)
    },
    serialize: value => value,
    deserialize: (value, definition) => integer
      ? Math.round(applyNumberConstraints(Number(value), definition))
      : applyNumberConstraints(Number(value), definition),
    interpolate: (from, to, amount, definition) => {
      const value = from + (to - from) * Math.max(0, Math.min(1, amount))
      return integer ? Math.round(applyNumberConstraints(value, definition)) : applyNumberConstraints(value, definition)
    },
  }
}

function vectorType(id: 'range' | 'vec2' | 'vec3' | 'vec4' | 'quaternion', length: number): ParameterTypeDefinition<number[]> {
  return {
    id,
    presentations: id === 'range' ? ['range-slider', 'number-fields'] : ['vector', 'number-fields'],
    infer: value => numericArray(value, length),
    normalize: value => numericArray(value, length) ? [...value] : Array.from({ length }, () => 0),
    validate: value => numericArray(value, length) ? valid() : invalid('shape', `${id} requires ${length} finite numbers`),
    format: value => value.join(', '),
    parse: input => input.split(/[\s,]+/).filter(Boolean).slice(0, length).map(Number),
    serialize: value => [...value],
    deserialize: value => numericArray(value, length) ? [...value] : Array.from({ length }, () => 0),
    interpolate: (from, to, amount) => from.map((value, index) => value + ((to[index] ?? value) - value) * Math.max(0, Math.min(1, amount))),
  }
}

function resourceType(id: 'asset' | 'image' | 'texture' | 'video' | 'audio'): ParameterTypeDefinition<AssetReference> {
  return {
    id,
    presentations: ['asset-field', `${id}-picker`],
    infer: value => isRecord(value) && typeof value.id === 'string' && (value.kind === id || id === 'asset'),
    normalize: value => isRecord(value) && typeof value.id === 'string'
      ? { ...value, id: value.id, kind: id } as AssetReference
      : { id: '', kind: id },
    validate: value => isRecord(value) && typeof value.id === 'string' ? valid() : invalid('reference', `${id} requires an asset reference`),
    format: value => value.label ?? value.uri ?? value.id,
    parse: input => ({ id: input, uri: input, kind: id }),
    serialize: clone,
    deserialize: value => isRecord(value) && typeof value.id === 'string'
      ? { ...value, id: value.id, kind: id } as AssetReference
      : { id: '', kind: id },
  }
}

function jsonType<T extends ParameterValue>(
  id: BuiltInParameterKind,
  presentations: string[],
  guard: (value: unknown) => value is T,
  fallback: T,
): ParameterTypeDefinition<T> {
  return {
    id,
    presentations,
    infer: guard,
    normalize: value => guard(value) ? clone(value) : clone(fallback),
    validate: value => guard(value) ? valid() : invalid('shape', `Invalid ${id} value`),
    format: value => JSON.stringify(value),
    parse: input => {
      const parsed: unknown = JSON.parse(input)
      return guard(parsed) ? parsed : clone(fallback)
    },
    serialize: clone,
    deserialize: value => guard(value) ? clone(value) : clone(fallback),
  }
}

export class UnitRegistry {
  private definitions = new Map<string, UnitDefinition>()

  register(definition: UnitDefinition): Unsubscribe {
    const previous = this.definitions.get(definition.id)
    const normalized = { ...definition, aliases: [...(definition.aliases ?? [])] }
    this.definitions.set(definition.id, normalized)
    for (const alias of normalized.aliases ?? []) this.definitions.set(alias, normalized)
    return () => {
      if (previous) this.definitions.set(definition.id, previous)
      else this.definitions.delete(definition.id)
      for (const alias of normalized.aliases ?? []) {
        if (this.definitions.get(alias) === normalized) this.definitions.delete(alias)
      }
    }
  }

  get(id: string): UnitDefinition | undefined { return this.definitions.get(id) }
  require(id: string): UnitDefinition {
    const definition = this.get(id)
    if (!definition) throw new Error(`Unknown unit: ${id}`)
    return definition
  }
  list(): UnitDefinition[] { return [...new Map([...this.definitions.values()].map(unit => [unit.id, unit])).values()] }

  convert(value: number, fromId: string, toId: string): number {
    const from = this.require(fromId)
    const to = this.require(toId)
    if (from.dimension !== to.dimension) throw new Error(`Cannot convert ${from.dimension} to ${to.dimension}`)
    const canonical = (value + (from.offset ?? 0)) * from.scale
    return canonical / to.scale - (to.offset ?? 0)
  }

  format(value: number, unitId: string, locale?: string): string {
    const unit = this.require(unitId)
    if (unit.format) return unit.format(value, locale)
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit.precision ?? 3 }).format(value)}${unit.symbol ? ` ${unit.symbol}` : ''}`
  }
}

export function createDefaultUnits(): UnitRegistry {
  const units = new UnitRegistry()
  ;[
    { id: 'unitless', symbol: '', dimension: 'none', scale: 1 },
    { id: 'percent', symbol: '%', dimension: 'ratio', scale: 0.01, aliases: ['%'] },
    { id: 'radian', symbol: 'rad', dimension: 'angle', scale: 1, aliases: ['rad'] },
    { id: 'degree', symbol: '°', dimension: 'angle', scale: Math.PI / 180, aliases: ['deg', 'degrees'] },
    { id: 'meter', symbol: 'm', dimension: 'distance', scale: 1, aliases: ['m'] },
    { id: 'centimeter', symbol: 'cm', dimension: 'distance', scale: 0.01, aliases: ['cm'] },
    { id: 'millimeter', symbol: 'mm', dimension: 'distance', scale: 0.001, aliases: ['mm'] },
    { id: 'second', symbol: 's', dimension: 'time', scale: 1, aliases: ['s', 'seconds'] },
    { id: 'millisecond', symbol: 'ms', dimension: 'time', scale: 0.001, aliases: ['ms'] },
    { id: 'hertz', symbol: 'Hz', dimension: 'frequency', scale: 1, aliases: ['hz'] },
    { id: 'kilohertz', symbol: 'kHz', dimension: 'frequency', scale: 1000, aliases: ['khz'] },
  ].forEach(unit => units.register(unit as UnitDefinition))
  return units
}

export class ParameterTypeRegistry {
  private definitions = new Map<ParameterKind, ParameterTypeDefinition>()

  register<T extends ParameterValue>(definition: ParameterTypeDefinition<T>): Unsubscribe {
    const previous = this.definitions.get(definition.id)
    this.definitions.set(definition.id, definition as ParameterTypeDefinition)
    return () => previous
      ? this.definitions.set(definition.id, previous)
      : void this.definitions.delete(definition.id)
  }

  get<T extends ParameterValue = ParameterValue>(id: ParameterKind): ParameterTypeDefinition<T> | undefined {
    return this.definitions.get(id) as ParameterTypeDefinition<T> | undefined
  }

  require<T extends ParameterValue = ParameterValue>(id: ParameterKind): ParameterTypeDefinition<T> {
    const definition = this.get<T>(id)
    if (!definition) throw new Error(`Unknown parameter type: ${id}`)
    return definition
  }

  infer(value: unknown, hints?: ParameterPresentationHints): ParameterTypeDefinition | undefined {
    return this.list().find(definition => definition.id !== 'custom' && definition.infer(value, hints))
  }

  normalize<T extends ParameterValue>(definition: ParameterDefinition<T>, value: unknown): T {
    return definition.deserialize
      ? definition.deserialize(value)
      : this.require<T>(definition.type).normalize(value, definition)
  }

  validate<T extends ParameterValue>(definition: ParameterDefinition<T>, value: unknown): ParameterValidationResult {
    const base = this.require<T>(definition.type).validate(value, definition)
    if (!base.valid || !definition.validation?.validate) return base
    const result = definition.validation.validate(value as T)
    if (result === true) return valid()
    if (result === false) return invalid('custom', 'Custom validation failed')
    if (typeof result === 'string') return invalid('custom', result)
    return result
  }

  serialize<T extends ParameterValue>(definition: ParameterDefinition<T>, value: T): unknown {
    return definition.serialize?.(value) ?? this.require<T>(definition.type).serialize(value, definition)
  }

  deserialize<T extends ParameterValue>(definition: ParameterDefinition<T>, value: unknown): T {
    return definition.deserialize?.(value) ?? this.require<T>(definition.type).deserialize(value, definition)
  }

  interpolate<T extends ParameterValue>(definition: ParameterDefinition<T>, from: T, to: T, amount: number): T {
    const type = this.require<T>(definition.type)
    return type.interpolate?.(from, to, amount, definition) ?? (amount < 0.5 ? clone(from) : clone(to))
  }

  list(): ParameterTypeDefinition[] { return [...this.definitions.values()] }
}

export function createDefaultParameterTypes(): ParameterTypeRegistry {
  const registry = new ParameterTypeRegistry()
  const register = <T extends ParameterValue>(definition: ParameterTypeDefinition<T>) => registry.register(definition)

  register(numericType('number', ['slider', 'number-field', 'scrubber', 'knob', 'dial']))
  register(numericType('integer', ['slider', 'number-field', 'stepper'], true))
  register(numericType('angle', ['dial', 'knob', 'slider', 'number-field']))
  register(numericType('distance', ['slider', 'number-field', 'scrubber']))
  register(numericType('percentage', ['slider', 'number-field', 'meter']))
  register(numericType('time', ['scrubber', 'number-field', 'timeline']))
  register(numericType('frequency', ['slider', 'knob', 'number-field']))
  register({
    id: 'boolean', presentations: ['toggle', 'checkbox', 'switch'],
    infer: value => typeof value === 'boolean', normalize: value => Boolean(value),
    validate: value => typeof value === 'boolean' ? valid() : invalid('type', 'boolean requires true or false'),
    format: value => value ? 'On' : 'Off', parse: input => /^(true|1|on|yes)$/i.test(input),
    serialize: value => value, deserialize: value => Boolean(value),
  })
  const stringType = (id: 'string' | 'path' | 'color', presentations: string[]): ParameterTypeDefinition<string> => ({
    id, presentations, infer: value => typeof value === 'string', normalize: value => String(value ?? ''),
    validate: value => typeof value === 'string' ? valid() : invalid('type', `${id} requires a string`),
    format: value => value, parse: input => input, serialize: value => value, deserialize: value => String(value ?? ''),
  })
  register(stringType('string', ['text-field', 'text-area']))
  register(stringType('path', ['path-field', 'breadcrumbs']))
  register(stringType('color', ['color-control', 'color-area', 'color-wheel', 'swatches']))
  register({
    id: 'enum', presentations: ['select', 'segmented-control', 'radio-group'],
    infer: value => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
    validate: (value, definition) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? definition?.options?.some(option => Object.is(option.value, value)) === false
        ? invalid('option', 'Value is not one of the declared options') : valid()
      : invalid('type', 'enum requires a scalar value'),
    normalize: (value, definition) => {
      const scalar = value as Scalar
      return definition?.options?.some(option => Object.is(option.value, scalar))
        ? scalar : definition?.defaultValue ?? null
    },
    format: value => String(value ?? ''), parse: input => input,
    serialize: value => value, deserialize: value => value as Scalar,
  })
  register(vectorType('range', 2))
  register(vectorType('vec2', 2))
  register(vectorType('vec3', 3))
  register(vectorType('vec4', 4))
  register(vectorType('quaternion', 4))
  register(jsonType<GradientValue>('gradient', ['gradient-editor'], (value): value is GradientValue => isRecord(value) && Array.isArray(value.stops), { stops: [] }))
  register(jsonType<CurveValue>('curve', ['curve-editor', 'graph'], (value): value is CurveValue => isRecord(value) && Array.isArray(value.points), { points: [] }))
  register(jsonType<EnvelopeValue>('envelope', ['envelope-editor'], (value): value is EnvelopeValue => isRecord(value) && ['attack', 'decay', 'sustain', 'release'].every(key => isFiniteNumber(value[key])), { attack: 0, decay: 0, sustain: 1, release: 0 }))
  register(jsonType<number[]>('matrix', ['matrix-control'], value => numericArray(value), []))
  register(resourceType('asset'))
  register(resourceType('image'))
  register(resourceType('texture'))
  register(resourceType('video'))
  register(resourceType('audio'))
  register(jsonType<Record<string, unknown>>('object-reference', ['object-reference'], isRecord, { id: '' }))
  register(jsonType<Record<string, unknown>>('custom', ['custom'], isRecord, {}))

  if (registry.list().length !== BUILT_IN_PARAMETER_KINDS.length) {
    throw new Error('Default parameter type registry is incomplete')
  }
  return registry
}

export const defaultUnits = createDefaultUnits()
export const defaultParameterTypes = createDefaultParameterTypes()
