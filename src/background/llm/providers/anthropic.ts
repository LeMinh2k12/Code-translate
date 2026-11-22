/** Anthropic provider — Messages API. */
import type { ChatRequest, ChatResponse, LlmProvider, LlmError } from '../types';

const ANTHROPIC_HOST = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';

export const anthropicProvider: LlmProvider = {
  id: 'anthropic',
  async chat(req: ChatRequest, keys: Record<string, string>): Promise<ChatResponse> {
    const key = keys.anthropicKey;
    if (!key) {
      throw makeError('Chưa nhập Anthropic API key — mở CF Toolkit Options để nhập.', 'auth');
    }
    const model = req.model || keys.anthropicModel || 'claude-sonnet-4-6';
    const r = await fetch(ANTHROPIC_HOST + '/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens || 8192,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      }),
      signal: req.signal,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = (j && j.error && j.error.message) || '';
      const code = r.status === 429 ? 'quota' : r.status === 401 || r.status === 403 ? 'auth' : r.status >= 500 ? 'network' : 'unknown';
      throw makeError(`Anthropic HTTP ${r.status}: ${msg || 'unknown error'}`, code, r.status);
    }
    const text = (j && j.content ? j.content : []).map((p: { text?: string }) => p.text || '').join('');
    if (!text) throw makeError('Anthropic trả về rỗng.', 'bad-response');
    return { text, provider: anthropicProvider.id, model };
  },
};

function makeError(message: string, code: LlmError['code'], status?: number): Error & LlmError {
  const e = new Error(message) as Error & LlmError;
  e.code = code;
  e.status = status;
  return e;
}
