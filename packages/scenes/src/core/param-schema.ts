/**
 * Parameter descriptors: one declaration per field drives validation,
 * generated UIs and host integrations (e.g. ARTINOS runtime parameters).
 */

interface DescriptorBase {
  label: string;
  /** Slash-separated group path, e.g. "Shell" or "Light / Key". */
  group: string;
  description?: string;
  /** Hidden behind an "advanced" toggle in generated UIs. */
  advanced?: boolean;
  /** Kept for data compatibility only; generated UIs and hosts skip it. */
  hidden?: boolean;
  /** Suitable as a modulation / automation target. */
  modulatable?: boolean;
}

export interface NumberDescriptor extends DescriptorBase {
  type: 'number';
  min: number;
  max: number;
  step: number;
  unit?: string;
}
export interface BooleanDescriptor extends DescriptorBase {
  type: 'boolean';
}
export interface ColorDescriptor extends DescriptorBase {
  type: 'color';
  /** An empty string is a valid "inherit" value. */
  allowEmpty?: boolean;
}
export interface EnumDescriptor extends DescriptorBase {
  type: 'enum';
  options: readonly { value: string; label: string }[];
}

export type ParamDescriptor =
  | NumberDescriptor
  | BooleanDescriptor
  | ColorDescriptor
  | EnumDescriptor;

/** A schema describes the primitive (number / boolean / string) fields of `T`. */
export type ParamSchema<T> = {
  [K in keyof T as T[K] extends number | boolean | string ? K : never]: ParamDescriptor;
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Coerce one value against its descriptor; returns `fallback` when invalid. */
export function coerceValue(descriptor: ParamDescriptor, value: unknown, fallback: unknown): unknown {
  switch (descriptor.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (value === null || value === '' || !Number.isFinite(n)) return fallback;
      return Math.min(descriptor.max, Math.max(descriptor.min, n));
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : fallback;
    case 'color':
      if (typeof value !== 'string') return fallback;
      if (value === '') return descriptor.allowEmpty ? '' : fallback;
      return HEX.test(value) ? value.toLowerCase() : fallback;
    case 'enum':
      return typeof value === 'string' && descriptor.options.some((o) => o.value === value)
        ? value
        : fallback;
  }
}

/**
 * Merge an untrusted partial over `defaults`, keeping only schema fields with
 * valid values. Non-schema fields of `defaults` (arrays, records) are copied
 * from `raw` only when they have the same basic shape.
 */
export function coerceState<T extends object>(
  schema: ParamSchema<T>,
  defaults: T,
  raw: unknown
): T {
  const out = { ...defaults } as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') return out as T;
  const input = raw as Record<string, unknown>;
  const descriptors = schema as Record<string, ParamDescriptor>;
  for (const key of Object.keys(defaults)) {
    if (!(key in input)) continue;
    const descriptor = descriptors[key];
    const fallback = (defaults as Record<string, unknown>)[key];
    if (descriptor) {
      out[key] = coerceValue(descriptor, input[key], fallback);
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(input[key])) out[key] = input[key];
    } else if (fallback === null || typeof fallback === 'object') {
      const v = input[key];
      if (v === null || (typeof v === 'object' && !Array.isArray(v))) out[key] = v;
    } else if (typeof input[key] === typeof fallback) {
      out[key] = input[key];
    }
  }
  return out as T;
}

/** Descriptor entries in declaration order. */
export function schemaEntries<T>(schema: ParamSchema<T>): [string, ParamDescriptor][] {
  return Object.entries(schema as Record<string, ParamDescriptor>);
}

export const options = <const V extends readonly string[]>(
  values: V,
  labels: Partial<Record<V[number], string>> = {}
) =>
  values.map((value) => ({
    value,
    label: (labels as Record<string, string>)[value] ?? titleCase(value),
  }));

export const titleCase = (id: string) =>
  id
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
