/**
 * Settings — chìa khóa riêng tư tách biệt khỏi config.
 *
 * - `chrome.storage.sync` chứa cấu hình KHÔNG chứa key (i18n, theme, module toggles...).
 * - `chrome.storage.local` chứa API key mặc định (hybrid option: cho phép sync bằng opt-in).
 *
 * Content script KHÔNG BAO GIỜ đọc key: module này export `readSettings()` (không chứa key).
 * Key chỉ được đọc trong background (`src/background/llm/runtime.ts`).
 */
import browser from 'webextension-polyfill';

export const SCHEMA_VERSION = 1;

export type Locale = 'vi' | 'en';
export type ProviderId = 'google' | 'pollinations' | 'gemini' | 'openai' | 'anthropic' | 'openai-compat';

export interface ModuleToggles {
  translateProblem: boolean;
  blogTranslate: boolean;
  quickSubmit: boolean;
  filters: boolean;
  theme: boolean;
  codeAnalysis: boolean;
  contestSafety: boolean;
}

export interface PublicSettings {
  version: number;
  locale: Locale;
  theme: {
    mode: 'light' | 'dark' | 'auto';
    id: string; // 'dracula' | 'solarized-dark' | 'nord' | 'gruvbox' | 'plain-dark' | 'plain-light'
    contentWidth: number; // px, nội dung đề (0 = mặc định của CF)
    fontSize: number; // px
    fontCode: string; // font họ code (tên font hệ thống / Google font name)
  };
  modules: ModuleToggles;
  translate: {
    targetLang: string; // 'vi' mặc định
    engine: ProviderId;
    auto: boolean; // tự động dịch khi mở đề
    glossaryVi: string; // glossary bổ sung (tùy chọn)
    allowFreeEngine: boolean; // cho phép dùng Google Translate / Pollinations miễn phí
  };
  blog: {
    auto: boolean;
  };
  submit: {
    hotkey: string; // "Ctrl+Enter"
    templates: Record<string, string>; // starter template theo ngôn ngữ
    persistLanguagePerContest: boolean;
  };
  filters: {
    hideAc: boolean;
    hideUnseen: boolean;
    hideEasyEasy: boolean;
    manualOnly: boolean; // chỉ áp dụng filter do người dùng đặt
    activePreset: string; // tên preset đang dùng
  };
  contestSafety: {
    mode: 'auto' | 'on' | 'off';
    allowLlmOverride: boolean; // cho phép bật LLM trong contest sau khi confirm
  };
  llm: {
    provider: ProviderId;
    geminiModel: string;
    anthropicModel: string;
    openaiBase: string;
    openaiModel: string;
    keysStore: 'local' | 'sync';
  };
}

export const DEFAULT_SETTINGS: PublicSettings = {
  version: SCHEMA_VERSION,
  locale: 'vi',
  theme: {
    mode: 'auto',
    id: 'dracula',
    contentWidth: 0,
    fontSize: 0,
    fontCode: '',
  },
  modules: {
    translateProblem: true,
    blogTranslate: true,
    quickSubmit: false,
    filters: true,
    theme: true,
    codeAnalysis: false,
    contestSafety: true,
  },
  translate: {
    targetLang: 'vi',
    engine: 'google',
    auto: false,
    glossaryVi: '',
    allowFreeEngine: true,
  },
  blog: { auto: false },
  submit: {
    hotkey: 'Ctrl+Enter',
    templates: {
      cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    int n; cin >> n;\n    // TODO\n    return 0;\n}\n',
      java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // TODO\n    }\n}\n',
        py: 'n = int(input())\n# TODO\n',
        js: 'const fs = require("fs");\n// TODO\n',
      },
      persistLanguagePerContest: true,
    },
  filters: {
    hideAc: false,
    hideUnseen: false,
    hideEasyEasy: false,
    manualOnly: false,
    activePreset: '',
  },
  contestSafety: {
    mode: 'auto',
    allowLlmOverride: false,
  },
  llm: {
    provider: 'gemini',
    geminiModel: 'gemini-2.5-flash',
    anthropicModel: 'claude-sonnet-4-6',
    openaiBase: 'https://api.openai.com/v1',
    openaiModel: 'gpt-4o-mini',
    keysStore: 'local',
  },
};

/** Ngôn ngữ dịch hỗ trợ (target) */
export const SUPPORTED_LANGS: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  ru: 'Русский',
  'zh-CN': '中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  id: 'Indonesian',
  th: 'ไทย',
  hi: 'हिन्दी',
};

const STORAGE_KEY = 'cf-toolkit:settings';

export async function readSettings(): Promise<PublicSettings> {
  let stored: Partial<PublicSettings> = {};
  try {
    const r = await browser.storage.sync.get(STORAGE_KEY);
    stored = (r && (r as Record<string, Partial<PublicSettings>>)[STORAGE_KEY]) || {};
  } catch {
    stored = {};
  }
  const merged = deepMerge(DEFAULT_SETTINGS, stored);
  if (merged.version < SCHEMA_VERSION) merged.version = SCHEMA_VERSION; // migration hook
  return merged;
}

export async function writeSettings(cfg: Partial<PublicSettings>): Promise<PublicSettings> {
  const current = await readSettings();
  const next = deepMerge(current, cfg);
  await browser.storage.sync.set({ [STORAGE_KEY]: next });
  return next;
}

export function onSettingsChange(cb: (cfg: PublicSettings) => void): () => void {
  const handler = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    readSettings().then(cb).catch(() => {});
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}

function deepMerge<T>(base: T, over: unknown): T {
  if (over === null || over === undefined) return base;
  if (Array.isArray(base)) return (over as T) ?? base;
  if (isPlainObject(base) && isPlainObject(over)) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over)) {
      out[k] = k in base ? deepMerge((base as Record<string, unknown>)[k], v) : v;
    }
    return out as T;
  }
  return (over as T) ?? base;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
