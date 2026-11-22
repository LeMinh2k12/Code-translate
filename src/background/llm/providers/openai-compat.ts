/** OpenAI-compatible provider — dùng cho OpenAI + endpoint tự host tương thích OpenAI. */
import type { ChatRequest, ChatResponse, LlmProvider, LlmError } from '../types';

export const openaiCompatProvider: LlmProvider = {
  id: 'openai-compat',
  async chat(req: ChatRequest, keys: Record<string, string>): Promise<ChatResponse> {
    const key = keys.openaiKey;
    if (!key) {
      throw makeError('Chưa nhập OpenAI API key — mở CF Toolkit Options để nhập.', 'auth');
    }
    const base = String(keys.openaiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = req.model || keys.openaiModel || 'gpt-4o-mini';
    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: req.maxTokens || 8192,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
      }),
      signal: req.signal,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = (j && j.error && j.error.message) || '';
      const code = r.status === 429 ? 'quota' : r.status === 401 || r.status === 403 ? 'auth' : r.status >= 500 ? 'network' : 'unknown';
      throw makeError(`LLM HTTP ${r.status}: ${msg || 'unknown error'}`, code, r.status);
    }
    const text = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    if (!text) throw makeError('LLM trả về rỗng.', 'bad-response');
    return { text, provider: openaiCompatProvider.id, model };
  },
};

function makeError(message: string, code: LlmError['code'], status?: number): Error & LlmError {
  const e = new Error(message) as Error & LlmError;
  e.code = code;
  e.status = status;
  return e;
}
