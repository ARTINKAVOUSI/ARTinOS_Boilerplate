import { useId, useState } from 'react';

/**
 * Controlled/uncontrolled value in one hook: pass `value` to control it, or leave
 * it undefined and the hook keeps its own state seeded from `defaultValue`.
 */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void) {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = (v: T) => {
    if (!controlled) setInner(v);
    onChange?.(v);
  };
  return [current, set] as const;
}

/** SSR-stable id that is also safe inside url(#…) references. */
export function useSafeId(prefix = 'ar') {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '');
}
