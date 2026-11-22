/** Gemini provider (Google AI Studio) — key do người dùng nhập qua Options page. */
import type { ChatRequest, ChatResponse, LlmProvider, LlmError } from '../types';

export const geminiProvider: LlmProvider = {
  id: 'gemini',
  async chat(req: ChatRequest, keys: Record<string, string>): Promise<ChatResponse> {
    const key = keys.geminiKey;
    if (!key) {
      throw makeError('Chưa nhập Gemini API key — mở CF Toolkit Options để nhập (miễn phí tại aistudio.google.com/apikey).', 'auth');
    }
    const model = req.model || 'gemini-2.5-flash';
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) +
      ':generateContent?key=' +
      encodeURIComponent(key);
    const body = {
      system_instruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig: { temperature: 0.15, maxOutputTokens: req.maxTokens || 8192 },
    };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: req.signal,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = (j && j.error && j.error.message) || '';
      const code = r.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(msg) ? 'quota' : r.status === 401 || r.status === 403 ? 'auth' : r.status >= 500 ? 'network' : 'unknown';
      throw makeError(`Gemini HTTP ${r.status}: ${msg || 'unknown error'}`, code, r.status);
    }
    const cand = j && j.candidates && j.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).map((p: { text?: string }) => p.text || '').join('');
    if (!text) throw makeError('Gemini trả về rỗng.', 'bad-response');
    return { text, provider: geminiProvider.id, model };
  },
};

function makeError(message: string, code: LlmError['code'], status?: number): Error & LlmError {
  const e = new Error(message) as Error & LlmError;
  e.message = message;
  e.code = code;
  e.status = status;
  return e;
}
