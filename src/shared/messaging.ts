/** Messaging typed helpers giữa content ↔ background / options. */
import browser from 'webextension-polyfill';

export type MessageOut =
  | { type: 'ping' }
  | { type: 'llm:ping' }
  | { type: 'llm:translate'; segments: string[]; targetLang: string; glossary?: string; lane?: string }
  | { type: 'llm:summarize'; text: string; lane?: string }
  | { type: 'module:status'; module: string; status: 'ok' | 'warn' | 'err'; text?: string };

export interface SendOk {
  ok: true;
  [k: string]: unknown;
}
export interface SendErr {
  ok: false;
  error: string;
}
export type SendResult = SendOk | SendErr;

export function sendMessage<T extends SendResult>(msg: MessageOut): Promise<T> {
  return new Promise((resolve) => {
    let responded = false;
    const done = (resp: SendResult | undefined) => {
      if (responded) return;
      responded = true;
      if (!resp) resolve({ ok: false, error: 'No response from background worker.' } as T);
      else resolve(resp as T);
    };
    try {
      const p = browser.runtime.sendMessage(msg as any) as Promise<SendResult>;
      Promise.resolve(p).then(
        (r) => done(r),
        (e: unknown) => done({ ok: false, error: shapeError(e) } as T),
      );
    } catch (e) {
      done({ ok: false, error: shapeError(e) } as T);
    }
  });
}

/**
 * Đăng ký handler async cho runtime.onMessage.
 * Luôn trả về true để giữ channel mở cho async response (Chrome MV3 pattern).
 */
export function onMessage(
  handler: (msg: MessageOut, sender: { tabId?: number }) => Promise<SendResult> | SendResult | void | undefined,
): void {
  browser.runtime.onMessage.addListener(async (msg: unknown, sender: { tab?: { id?: number } }) => {
    try {
      const result = handler(msg as MessageOut, { tabId: sender?.tab?.id });
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        const r = await (result as Promise<SendResult | void>);
        return r ?? { ok: true };
      }
      return result ?? { ok: true };
    } catch (e) {
      return { ok: false, error: shapeError(e) } as SendResult;
    }
  });
}

export function shapeError(e: unknown): string {
  return String((e && (e as Error).message) || e || 'unknown error');
}
