/**
 * Service worker entry — LLM service + message routing.
 *
 * Key: chỉ tồn tại ở đây. Content script không bao giờ thấy key.
 */
import browser from 'webextension-polyfill';
import { LLMManager } from './llm/manager';
import { readRuntimeSettings } from './llm/runtime';
import { pickProvider } from './llm/providers';
import { translatePrompt, translateUserPayload, summarizePrompt } from './llm/prompts';
import type { SendResult } from '../shared/messaging';

const manager = new LLMManager();

interface TranslateMessage {
  type: 'llm:translate';
  segments: string[];
  targetLang: string;
  glossary?: string;
  lane?: string;
}

interface SummarizeMessage {
  type: 'llm:summarize';
  text: string;
  lane?: string;
}

async function handleTranslate(msg: TranslateMessage, sender: { tabId?: number }): Promise<SendResult> {
  try {
    const settings = await readRuntimeSettings();
    const resolution = pickProvider(settings, settings.keys);
    if ('error' in resolution) return { ok: false, error: resolution.error };

    const { provider, keys: providerKeys } = resolution;
    const lane = msg.lane
      ? `tab:${sender.tabId ?? 'x'}:${msg.lane}`
      : `tab:${sender.tabId ?? 'x'}:default`;

    const targetLang = (msg.targetLang || settings.translate.targetLang || 'vi').trim() || 'vi';
    const res = await manager.chat(
      provider,
      {
        system: translatePrompt(targetLang, msg.glossary || ''),
        user: translateUserPayload(msg.segments, targetLang),
        lane,
        targetLang,
        model: undefined, // mặc định theo settings trong providers
      },
      providerKeys,
    );
    return { ok: true, output: res.text, provider: res.provider, model: res.model };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

async function handleSummarize(msg: SummarizeMessage, sender: { tabId?: number }): Promise<SendResult> {
  try {
    const settings = await readRuntimeSettings();
    const resolution = pickProvider(settings, settings.keys);
    if ('error' in resolution) return { ok: false, error: resolution.error };

    const { provider, keys: providerKeys } = resolution;
    const lane = msg.lane
      ? `tab:${sender.tabId ?? 'x'}:${msg.lane}`
      : `tab:${sender.tabId ?? 'x'}:default`;

    const text = String(msg.text || '').slice(0, 16000);
    const res = await manager.chat(
      provider,
      {
        system: summarizePrompt(),
        user:
          'Summarize the following Codeforces problem statement per the system rules. Respond with ONLY the JSON object.\n\n' +
          text,
        lane,
        model: undefined,
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
    const m = msg as TranslateMessage | SummarizeMessage | { type: string } | null;
    if (!m) return { ok: false, error: 'empty message' };
    if (m.type === 'llm:ping') return await handlePing({ tabId });
    if (m.type === 'llm:translate') return await handleTranslate(m as TranslateMessage, { tabId });
    if (m.type === 'llm:summarize') return await handleSummarize(m as SummarizeMessage, { tabId });
    if (m.type === 'module:status') return { ok: true };
    if (m.type === 'ping') return { ok: true, pong: true };
    return { ok: false, error: 'unknown message type: ' + String((m as { type?: string })?.type) };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
});

export { manager };
export { translatePrompt, translateUserPayload };
