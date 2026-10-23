/**
 * localStorage that never throws. Safari private mode, "block all cookies",
 * embedded webviews and quota errors make the real API throw; the app then keeps
 * working for the session with an in-memory copy instead of crashing on load.
 */
const memory = new Map<string, string>();

function backing(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    const probe = "__galactic_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export const safeStorage = {
  /** True when values survive a reload. */
  get persistent() {
    return backing() !== null;
  },
  getItem(key: string): string | null {
    try {
      const storage = backing();
      if (storage) return storage.getItem(key);
    } catch {
      /* fall through to memory */
    }
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    try {
      const storage = backing();
      if (storage) {
        storage.setItem(key, value);
        return;
      }
    } catch {
      /* quota or denied: keep a session copy */
    }
    memory.set(key, value);
  },
  removeItem(key: string): void {
    memory.delete(key);
    try {
      backing()?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  keys(): string[] {
    const found = new Set(memory.keys());
    try {
      const storage = backing();
      if (storage)
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key !== null) found.add(key);
        }
    } catch {
      /* ignore */
    }
    return [...found];
  },
};
