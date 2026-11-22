/**
 * Keys storage (hybrid):
 *  - mặc định: chrome.storage.local (chỉ trên máy, không đồng bộ thiết bị)
 *  - người dùng có thể chọn sync qua Options (đọc qua chrome.storage.sync)
 *
 * Options page (và background) dùng file này; content script không import file này.
 */
import browser from 'webextension-polyfill';
import { readSettings } from './settings';

export interface LlmKeys {
  geminiKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
}

export const KEYS_STORAGE_KEY = 'cf-toolkit:keys';

export async function readKeys(): Promise<LlmKeys> {
  const cfg = await readSettings();
  const area: 'local' | 'sync' = cfg.llm?.keysStore === 'sync' ? 'sync' : 'local';
  const storage = area === 'sync' ? browser.storage.sync : browser.storage.local;
  try {
    const r = await storage.get(KEYS_STORAGE_KEY);
    return ((r as Record<string, LlmKeys>)[KEYS_STORAGE_KEY] || {}) as LlmKeys;
  } catch {
    return {};
  }
}

export async function writeKeys(keys: LlmKeys, store?: 'local' | 'sync'): Promise<void> {
  const cfg = await readSettings();
  const area: 'local' | 'sync' = store || (cfg.llm?.keysStore === 'sync' ? 'sync' : 'local');
  const storage = area === 'sync' ? browser.storage.sync : browser.storage.local;
  await storage.set({ [KEYS_STORAGE_KEY]: keys });
}
