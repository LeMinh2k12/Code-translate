/** Cache LLM theo hash nội dung nội dung request — IndexedDB qua idb. */
import { openDB, type IDBPDatabase } from 'idb';

export interface LlmCacheEntry {
  key: string; // sha-256 hex
  text: string;
  createdAt: number;
  expiresAt: number;
}

const DB_NAME = 'cf-toolkit-llm';
const DB_VERSION = 1;
const STORE = 'llm-cache';
const MAX_ENTRIES = 200;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 ngày

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function hashKey(payload: unknown): Promise<string> {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export async function getCacheEntry(key: string): Promise<LlmCacheEntry | null> {
  try {
    const d = await db();
    const r = await d.get(STORE, key);
    if (!r) return null;
    if (r.expiresAt && r.expiresAt < Date.now()) {
      await deleteCacheEntry(key);
      return null;
    }
    return r as LlmCacheEntry;
  } catch {
    return null;
  }
}

export async function setCacheEntry(key: string, text: string, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  try {
    const d = await db();
    const entry: LlmCacheEntry = {
      key,
      text,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    await d.put(STORE, entry);
    await trimCache();
  } catch {
    /* best-effort cache */
  }
}

export async function deleteCacheEntry(key: string): Promise<void> {
  try {
    const d = await db();
    await d.delete(STORE, key);
  } catch {
    /* noop */
  }
}

async function trimCache(): Promise<void> {
  try {
    const d = await db();
    const keys = await d.getAllKeys<string>(STORE);
    if (keys.length <= MAX_ENTRIES) return;
    const entries = (await d.getAll(STORE)) as LlmCacheEntry[];
    entries.sort((a, b) => a.createdAt - b.createdAt);
    const toDelete = entries.slice(0, entries.length - MAX_ENTRIES);
    for (const e of toDelete) await d.delete(STORE, e.key);
  } catch {
    /* noop */
  }
}
