/** Minimal synchronous key/value storage so scenes never touch `localStorage` directly. */
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryStorage(seed: Record<string, string> = {}): StorageAdapter {
  const map = new Map(Object.entries(seed));
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
  };
}

/**
 * `localStorage` with a key prefix. Every access is guarded: private windows,
 * blocked storage and quota errors degrade to a no-op instead of throwing.
 */
export function localStorageAdapter(prefix: string): StorageAdapter {
  const store = () => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        return store()?.getItem(prefix + key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        store()?.setItem(prefix + key, value);
      } catch {
        /* storage unavailable */
      }
    },
    remove(key) {
      try {
        store()?.removeItem(prefix + key);
      } catch {
        /* storage unavailable */
      }
    },
  };
}

export function readJSON<T>(storage: StorageAdapter, key: string): T | undefined {
  const raw = storage.get(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeJSON(storage: StorageAdapter, key: string, value: unknown) {
  try {
    storage.set(key, JSON.stringify(value));
  } catch {
    /* unserializable value */
  }
}

export const uid = (prefix = 'u') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
