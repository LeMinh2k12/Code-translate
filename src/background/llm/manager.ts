/**
 * LLM Manager — một manager duy nhất cho toàn background:
 *  - giới hạn concurrency + rate limit
 *  - retry có backoff (exponential + jitter)
 *  - cache theo hash nội dung
 *  - hủy request khi người dùng rời trang (theo lane — content gửi lane tuý chọn)
 */
import { getCacheEntry, setCacheEntry, hashKey } from './cache';
import type { ChatRequest, ChatResponse, LlmProvider } from './types';

export interface LLMManagerOptions {
  maxConcurrent?: number;
  minIntervalMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
}

const DEFAULTS: Required<LLMManagerOptions> = {
  maxConcurrent: 3,
  minIntervalMs: 120,
  maxRetries: 2,
  retryBaseMs: 600,
};

export class LLMManager {
  private opts: Required<LLMManagerOptions>;
  private active = 0;
  private queue: Array<() => void> = [];
  private lastCallAt = 0;
  private inflight = new Map<string, AbortController>();

  constructor(opts: LLMManagerOptions = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  /** Hủy tất cả request theo lane (mặc định tất cả request đang chạy của tab). */
  cancelLane(lane: string): void {
    const list: string[] = [];
    for (const key of this.inflight.keys()) {
      if (lane && key.startsWith(lane)) list.push(key);
      else if (!lane) list.push(key);
    }
    for (const key of list) {
      const c = this.inflight.get(key);
      if (c) c.abort();
      this.inflight.delete(key);
    }
  }

  /** Hủy tất cả request của một tab cụ thể (lane = `tab:<id>`). */
  cancelTab(tabId: number): void {
    this.cancelLane(`tab:${tabId}`);
  }

  private async waitForSlotAndRateLimit(): Promise<void> {
    const sinceLast = Date.now() - this.lastCallAt;
    if (sinceLast < this.opts.minIntervalMs) {
      await sleep(this.opts.minIntervalMs - sinceLast);
    }
    while (this.active >= this.opts.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    this.lastCallAt = Date.now();
  }

  private releaseSlot(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }

  async chat(provider: LlmProvider, req: ChatRequest, keys: Record<string, string>): Promise<ChatResponse> {
    const lane = req.lane || `anon:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    // Supersede: nếu lane đang chạy thì hủy request cũ
    const existing = this.inflight.get(lane);
    if (existing) existing.abort();
    const controller = new AbortController();
    this.inflight.set(lane, controller);

    // Cache
    const model = req.model || '';
    const keyPayload = { provider: provider.id, model, system: req.system, user: req.user, maxTokens: req.maxTokens || 0 };
    const cacheKey = await hashKey(keyPayload);
    const hit = await getCacheEntry(cacheKey);
    if (hit) {
      this.inflight.delete(lane);
      return { text: hit.text, provider: provider.id, model };
    }

    await this.waitForSlotAndRateLimit();
    try {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
        if (controller.signal.aborted) throw new Error('Request đã bị hủy bởi người dùng.');
        try {
          const res = await provider.chat({ ...req, signal: controller.signal }, keys);
          if (res && res.text) {
            await setCacheEntry(cacheKey, res.text).catch(() => {});
          }
          return res;
        } catch (e) {
          lastError = e as Error;
          const code = (e as { code?: string })?.code;
          // Không retry cho lỗi auth/quota/bị hủy/bad-response
          if (controller.signal.aborted || code === 'auth' || code === 'quota' || code === 'bad-response') {
            throw e;
          }
          if (attempt < this.opts.maxRetries) {
            const delay = this.opts.retryBaseMs * Math.pow(2, attempt) + Math.random() * 250;
            await sleep(delay);
            continue;
          }
        }
      }
      throw lastError || new Error('LLM request thất bại.');
    } finally {
      this.inflight.delete(lane);
      this.releaseSlot();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
