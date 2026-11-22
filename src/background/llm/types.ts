/** Kiểu dùng chung cho LLM service (chỉ chạy trong background service worker). */
export type LlmErrorCode =
  | 'quota'
  | 'auth'
  | 'network'
  | 'timeout'
  | 'bad-response'
  | 'unknown';

export interface LlmError {
  message: string;
  code: LlmErrorCode;
  status?: number;
}

export interface ChatRequest {
  system: string;
  user: string;
  model?: string; // Override model (nếu không: lấy từ settings)
  maxTokens?: number;
  signal?: AbortSignal;
  lane?: string;
  /** Target language (chỉ google provider dùng) */
  targetLang?: string;
}

export interface ChatResponse {
  text: string;
  provider: string;
  model: string;
}

export interface LlmProvider {
  id: string;
  chat(req: ChatRequest, keys: Record<string, string>): Promise<ChatResponse>;
}
