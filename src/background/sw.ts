/**
 * Service worker entry — LLM service + message routing.
 *
 * Key: chỉ tồn tại ở đây. Content script không bao giờ thấy key.
 */
import browser from 'webextension-polyfill';
import { LLMManager } from './llm/manager';
import { readRuntimeSettings } from './llm/runtime';
import { pickProvider } from './llm/providers';
import { translatePrompt, translateUserPayload } from './llm/prompts';
import type { SendResult } from '../shared/messaging';

const manager = new LLMManager();

interface ChatMessage {
  type: 'llm:chat';
  system: string;
  user: string;
  lane?: string;
  provider?: string; // chỉ cho phép dùng với các provider an toàn trong settings
  maxTokens?: number;
}

async function handleChat(msg: ChatMessage, sender: { tabId?: number }): Promise<SendResult> {
  try {
    const settings = await readRuntimeSettings();
    const resolution = pickProvider(settings, settings.keys);
    if ('error' in resolution) return { ok: false, error: resolution.error };

    const { provider, keys: providerKeys } = resolution;
    const lane = msg.lane
      ? `tab:${sender.tabId ?? 'x'}:${msg.lane}`
      : `tab:${sender.tabId ?? 'x'}:default`;

    const res = await manager.chat(
      provider,
      {
        system: msg.system,
        user: msg.user,
        lane,
        maxTokens: msg.maxTokens,
        model: undefined, // mặc định theo settings trong providers
      },
      providerKeys,
    );
    return { ok: true, output: res.text, provider: res.provider, model: res.model };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

async function handlePing(sender: { tabId?: number }): Promise<SendResult> {
  try {
    const settings = await readRuntimeSettings();
    const resolution = pickProvider(settings, settings.keys);
    if ('error' in resolution) return { ok: false, error: resolution.error };
    const { provider, keys } = resolution;
    const res = await manager.chat(
      provider,
      {
        system: 'You are a connection test bot. Answer with a single short line.',
        user: 'Hi',
        lane: `ping:${sender.tabId ?? 'x'}:${Date.now()}`,
        maxTokens: 16,
      },
      keys,
    );
    return { ok: true, output: res.text, provider: res.provider, model: res.model };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

browser.tabs?.onRemoved.addListener((tabId: number) => {
  manager.cancelTab(tabId);
});

browser.runtime.onMessage.addListener(async (msg: unknown, sender: { tab?: { id?: number } }) => {
  const tabId = sender?.tab?.id;
  try {
    const m = msg as ChatMessage | { type: string } | null;
    if (!m) return { ok: false, error: 'empty message' };
    if (m.type === 'llm:ping') return await handlePing({ tabId });
    if (m.type === 'llm:chat') return await handleChat(m as ChatMessage, { tabId });
    if (m.type === 'module:status') return { ok: true };
    if (m.type === 'ping') return { ok: true, pong: true };
    return { ok: false, error: 'unknown message type: ' + String((m as { type?: string })?.type) };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
});

export { manager };
export { translatePrompt, translateUserPayload };
