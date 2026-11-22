/** Kiểu module chung cho content script. */
import type { PublicSettings } from '../../shared/settings';
import type { SendResult, MessageOut } from '../../shared/messaging';

export interface ModuleContext {
  settings: PublicSettings;
  /** ID của module (để liên kết lỗi/status). */
  moduleId: string;
  /** Gọi đến background LLM service (không bao giờ gửi key — key chỉ ở background). */
  sendBackground: <T extends SendResult>(msg: MessageOut) => Promise<T>;
  /** Thông báo cho user về trạng thái module (tooltip/overlay tùy module tự render). */
  setStatus: (status: 'ok' | 'warn' | 'err', text: string) => void;
}

export interface CfModule {
  id: string;
  /** i18n key hoặc slug (chỉ để tham chiếu). */
  name: string;
  /** Miền URL content-script cần áp dụng (ví dụ 'problem', 'contests', 'problemset', 'blog', 'all'). */
  matches(url: URL): boolean;
  init(ctx: ModuleContext): void | Promise<void>;
  destroy?(): void | Promise<void>;
}

/** Registry tĩnh: modules khai báo ở đây (được import ở index.ts). */
export const MODULE_REGISTRY: CfModule[] = [];

export function registerModule(m: CfModule): void {
  if (!MODULE_REGISTRY.some((x) => x.id === m.id)) MODULE_REGISTRY.push(m);
}

/** Xóa cache module (dùng cho tests / reload). */
export function __resetModules(): void {
  MODULE_REGISTRY.length = 0;
}
