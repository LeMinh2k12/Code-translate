/** Free provider — Google Translate (unofficial endpoint, dùng như code cũ). Opt-in. */
import type { ChatRequest, ChatResponse, LlmProvider, LlmError } from '../types';

async function googleReq(q: string, target: string, maxAttempts = 2): Promise<string> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=' +
    encodeURIComponent(target) +
    '&q=' +
    encodeURIComponent(q);
  let lastError: unknown = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) {
        lastError = new Error('Google Translate HTTP ' + r.status);
        continue;
      }
      const j = await r.json();
      const text = (j[0] || []).map((x: [string]) => x[0]).join('');
      return text;
    } catch (e) {
      lastError = e;
    }
  }
  throw makeError('Google Translate lỗi: ' + String(lastError && (lastError as Error).message || lastError), 'network');
}

export const googleTranslateProvider: LlmProvider = {
  id: 'google',
  async chat(req: ChatRequest): Promise<ChatResponse> {
    // Google Translate chỉ nhận text thuần — dùng req.user như một khối; nếu system chứa target lang thì ưu tiên
    const target = (req as ChatRequest & { targetLang?: string }).targetLang || 'vi';
    const text = await googleReq(req.user, target);
    return { text, provider: googleTranslateProvider.id, model: 'google-translate' };
  },
};

function makeError(message: string, code: LlmError['code']): Error & LlmError {
  const e = new Error(message) as Error & LlmError;
  e.code = code;
  return e;
}
