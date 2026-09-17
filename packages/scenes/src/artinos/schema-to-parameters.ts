import type { ParameterDefinition, ParameterValue } from '@artinos/runtime';
import { schemaEntries, type ParamDescriptor, type ParamSchema } from '../core/param-schema';

const UNIT_IDS: Record<string, string> = { '°': 'degree', m: 'meter', '%': 'percent', s: 'second', Hz: 'hertz' };

export interface SchemaToParametersOptions<T> {
  /** Id prefix, e.g. `scene.room.light` → `scene.room.light.keyIntensity`. */
  prefix: string;
  /** Inspector group prefix, e.g. `Room` → `Room / Light / Key`. */
  group: string;
  /** Default values (usually a resolved preset). */
  defaults: T;
  exclude?: readonly (keyof T)[];
  order?: number;
}

/** One runtime parameter definition from one schema descriptor. */
export function descriptorToParameter(
  id: string,
  descriptor: ParamDescriptor,
  defaultValue: ParameterValue,
  group: string,
  order?: number
): ParameterDefinition {
  const base = {
    id,
    label: descriptor.label,
    group,
    description: descriptor.description,
    advanced: descriptor.advanced,
    modulatable: descriptor.modulatable,
    automatable: descriptor.modulatable,
    order,
  };
  switch (descriptor.type) {
    case 'number': {
      const integer = Number.isInteger(descriptor.step) && Number.isInteger(descriptor.min) && descriptor.step >= 1;
      return {
        ...base,
        type: integer ? 'integer' : 'number',
        defaultValue,
        min: descriptor.min,
        max: descriptor.max,
        step: descriptor.step,
        unit: descriptor.unit ? UNIT_IDS[descriptor.unit] : undefined,
        metadata: descriptor.unit && !UNIT_IDS[descriptor.unit] ? { unitLabel: descriptor.unit } : undefined,
      };
    }
    case 'boolean':
      return { ...base, type: 'boolean', defaultValue };
    case 'color':
      return { ...base, type: 'color', defaultValue };
    case 'enum':
      return {
        ...base,
        type: 'enum',
        defaultValue,
        options: descriptor.options.map((o) => ({ label: o.label, value: o.value })),
      };
  }
}

/** Runtime parameter definitions for every visible field of a schema. */
export function schemaToParameters<T extends object>(
  schema: ParamSchema<T>,
  { prefix, group, defaults, exclude = [], order = 0 }: SchemaToParametersOptions<T>
): ParameterDefinition[] {
  const skip = new Set<string>(exclude.map(String));
  return schemaEntries(schema)
    .filter(([key, d]) => !d.hidden && !skip.has(key))
    .map(([key, d], index) =>
      descriptorToParameter(
        `${prefix}.${key}`,
        d,
        (defaults as Record<string, ParameterValue>)[key],
        `${group} / ${d.group}`,
        order + index
      )
    );
}

/** Field keys a `schemaToParameters` call produces, in the same order. */
export function schemaKeys<T extends object>(schema: ParamSchema<T>, exclude: readonly (keyof T)[] = []): (keyof T & string)[] {
  const skip = new Set<string>(exclude.map(String));
  return schemaEntries(schema)
    .filter(([key, d]) => !d.hidden && !skip.has(key))
    .map(([key]) => key as keyof T & string);
}
