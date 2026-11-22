/** Free provider — Pollinations AI (no key). Opt-in, used only if enabled by user. */
import type { ChatRequest, ChatResponse, LlmProvider, LlmError } from '../types';

export const pollinationsProvider: LlmProvider = {
  id: 'pollinations',
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const r = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      throw makeError('Pollinations HTTP ' + r.status, 'network');
    }
    const j = await r.json().catch(() => null);
    const text = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    if (!text) throw makeError('Pollinations trả về rỗng.', 'bad-response');
    return { text, provider: pollinationsProvider.id, model: 'openai' };
  },
};

function makeError(message: string, code: LlmError['code']): Error & LlmError {
  const e = new Error(message) as Error & LlmError;
  e.code = code;
  return e;
}
