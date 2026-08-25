const DRAFT_VERSION = 1;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface DraftEnvelope<T> {
  version: number;
  updatedAt: number;
  data: T;
}

export function readDraft<T>(
  key: string,
  storage: Storage = window.localStorage,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T>>;
    if (
      parsed.version !== DRAFT_VERSION
      || typeof parsed.updatedAt !== "number"
      || parsed.data === undefined
      || Date.now() - parsed.updatedAt > maxAgeMs
    ) {
      storage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    try { storage.removeItem(key); } catch { /* storage may be unavailable */ }
    return null;
  }
}

export function writeDraft<T>(
  key: string,
  data: T,
  storage: Storage = window.localStorage,
): boolean {
  try {
    const envelope: DraftEnvelope<T> = {
      version: DRAFT_VERSION,
      updatedAt: Date.now(),
      data,
    };
    storage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string, storage: Storage = window.localStorage): void {
  try { storage.removeItem(key); } catch { /* storage may be unavailable */ }
}

export function hasDraft(key: string, storage: Storage = window.localStorage): boolean {
  return readDraft<unknown>(key, storage) !== null;
}

export function sanitizeDraftUrl(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  return /^\s*(?:data|blob):/i.test(value) ? null : value;
}
