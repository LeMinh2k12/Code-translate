/** Provider registry — chọn provider theo settings. */
import type { LlmProvider } from './types';
import type { PublicSettings } from '../../shared/settings';
import { geminiProvider } from './providers/gemini';
import { openaiCompatProvider } from './providers/openai-compat';
import { anthropicProvider } from './providers/anthropic';
import { googleTranslateProvider } from './providers/google-translate';
import { pollinationsProvider } from './providers/pollinations';
import type { LlmKeys } from './runtime';

export interface ProviderResolution {
  provider: LlmProvider;
  keys: Record<string, string>;
}

const PROVIDERS: Record<string, LlmProvider> = {
  gemini: geminiProvider,
  openai: openaiCompatProvider, // OpenAI chính thức dùng cùng code path
  'openai-compat': openaiCompatProvider,
  anthropic: anthropicProvider,
  google: googleTranslateProvider,
  pollinations: pollinationsProvider,
};

export function pickProvider(settings: PublicSettings, keys: LlmKeys): ProviderResolution | { error: string } {
  const providerId = settings.llm.provider || 'gemini';
  const provider = PROVIDERS[providerId];
  if (!provider) return { error: 'Provider không rõ: ' + providerId };

  // Chặn free engines khi người dùng tắt (allowFreeEngine=false)
  if (settings.translate && settings.translate.allowFreeEngine === false) {
    if (providerId === 'google' || providerId === 'pollinations') {
      return { error: `Engine miễn phí "${providerId}" đã bị tắt trong Options → bỏ qua.` };
    }
  }

  const keyMap: Record<string, string> = {
    geminiKey: keys.geminiKey || '',
    openaiKey: keys.openaiKey || '',
    anthropicKey: keys.anthropicKey || '',
    openaiBase: settings.llm.openaiBase || 'https://api.openai.com/v1',
    openaiModel: settings.llm.openaiModel || 'gpt-4o-mini',
    anthropicModel: settings.llm.anthropicModel || 'claude-sonnet-4-6',
    geminiModel: settings.llm.geminiModel || 'gemini-2.5-flash',
  };

  if (providerId === 'google' || providerId === 'pollinations') {
    // free providers không cần key
    return { provider, keys: {} };
  }
  if (providerId === 'gemini') return { provider, keys: { geminiKey: keyMap.geminiKey } };
  if (providerId === 'anthropic') return { provider, keys: { anthropicKey: keyMap.anthropicKey } };
  // openai / openai-compat
  return {
    provider,
    keys: {
      openaiKey: keyMap.openaiKey,
      openaiBase: keyMap.openaiBase,
      openaiModel: keyMap.openaiModel,
    },
  };
}

/** Provider model mặc định cho hiển thị UI. */
export function providerModel(settings: PublicSettings): string {
  const id = settings.llm.provider;
  if (id === 'gemini') return settings.llm.geminiModel;
  if (id === 'anthropic') return settings.llm.anthropicModel;
  if (id === 'openai' || id === 'openai-compat') return settings.llm.openaiModel;
  return '-';
}
