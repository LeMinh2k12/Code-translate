/** Module loader — đọc settings rồi chỉ init module được bật & match URL. */
import { MODULE_REGISTRY, type CfModule, type ModuleContext } from './module-interface';
import { onSettingsChange, readSettings, type PublicSettings } from '../../shared/settings';
import { sendMessage, type SendResult, type MessageOut } from '../../shared/messaging';

export interface LoaderHandle {
  /** Dừng tất cả module và dừng lắng nghe settings thay đổi. */
  stop(): Promise<void>;
  /** Tear down + re-init (dùng khi settings đổi). */
  reload(): Promise<void>;
  /** Status hiện tại của loader. */
  isActive(): boolean;
}

interface ActiveModule {
  module: CfModule;
  ctx: ModuleContext;
  disposer: () => void | Promise<void>;
}

const MODULE_KEY: Record<string, keyof PublicSettings['modules']> = {
  'translate-problem': 'translateProblem',
  'blog-translate': 'blogTranslate',
  'quick-submit': 'quickSubmit',
  filters: 'filters',
  theme: 'theme',
  'code-analysis': 'codeAnalysis',
  'contest-safety': 'contestSafety',
};

function isEnabled(module: CfModule, settings: PublicSettings): boolean {
  const key = MODULE_KEY[module.id];
  if (!key) return false; // module không nằm trong settings → mặc định tắt
  return !!settings.modules[key];
}

function buildCtx(module: CfModule, settings: PublicSettings): ModuleContext {
  return {
    settings,
    moduleId: module.id,
    sendBackground: <T extends SendResult>(msg: MessageOut) => sendMessage<T>(msg),
    setStatus: (status: 'ok' | 'warn' | 'err', text: string) => {
      void sendMessage({ type: 'module:status', module: module.id, status, text });
    },
  };
}

function debounce<F extends (...args: never[]) => void>(fn: F, ms: number): F {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as F;
}

export function createLoader(opts?: { debounceMs?: number; autoInit?: boolean }): LoaderHandle {
  const debounceMs = opts?.debounceMs ?? 200;
  const autoInit = opts?.autoInit ?? true;
  let active: ActiveModule[] = [];
  let settings: PublicSettings | null = null;
  let stopped = false;

  const activate = async (): Promise<void> => {
    if (stopped) return;
    await deactivate();
    settings = await readSettings();
    const url = new URL(window.location.href);
    for (const module of MODULE_REGISTRY) {
      if (!isEnabled(module, settings)) continue;
      let matches = false;
      try {
        matches = module.matches(url);
      } catch {
        matches = false;
      }
      if (!matches) continue;
      const ctx = buildCtx(module, settings);
      let disposer: ActiveModule['disposer'] | undefined;
      try {
        const result = await module.init(ctx);
        if (typeof result === 'function') disposer = result;
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        console.warn(`[cf-toolkit] module "${module.id}" init failed:`, e);
        void sendMessage({ type: 'module:status', module: module.id, status: 'err', text: msg });
      }
      if (!disposer && typeof module.destroy === 'function') {
        disposer = module.destroy.bind(module);
      }
      active.push({ module, ctx, disposer: disposer || (async () => {}) });
    }
  };

  const deactivate = async (): Promise<void> => {
    const list = active;
    active = [];
    for (const a of list) {
      try {
        await a.disposer();
      } catch (e) {
        console.warn(`[cf-toolkit] module "${a.module.id}" destroy failed:`, e);
      }
    }
  };

  const debouncedReload = debounce(async () => {
    try {
      await activate();
    } catch (e) {
      console.warn('[cf-toolkit] loader reload failed:', e);
    }
  }, debounceMs);

  const unsubscribe = onSettingsChange(() => debouncedReload());

  if (autoInit) {
    Promise.resolve().then(activate);
  }

  return {
    async stop() {
      stopped = true;
      unsubscribe();
      await deactivate();
    },
    async reload() {
      if (stopped) return;
      await activate();
    },
    isActive: () => active.length > 0,
  };
}
