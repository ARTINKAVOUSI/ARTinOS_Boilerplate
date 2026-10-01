import type { ReactNode } from 'react';

/** An option is a plain string, or an object with a label and/or an icon. */
export type OptionInput<V extends string = string> =
  | V
  | { value: V; label?: ReactNode; icon?: ReactNode; title?: string; disabled?: boolean };

export interface Option<V extends string = string> {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
  disabled?: boolean;
}

export const normalizeOptions = <V extends string>(opts: readonly OptionInput<V>[]): Option<V>[] =>
  opts.map((o) => (typeof o === 'string' ? { value: o, label: o } : { ...o, label: o.label ?? (o.icon ? null : o.value) }));
