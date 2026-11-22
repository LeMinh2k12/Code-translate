/** UI dictionary (vi/en) cho phần UI của extension. Dùng cho shadow-DOM components. */
export type Locale = 'vi' | 'en';

const dict: Record<Locale, Record<string, string | ((...args: any[]) => string)>> = {
  vi: {
    'translate.bar.translate': '🌐 Dịch đề',
    'translate.bar.retranslate': '🌐 Dịch lại',
    'translate.bar.original': '↩ Bản gốc',
    'translate.bar.summary': '📝 Tóm tắt',
    'translate.bar.sideBySide': '▤ Song ngữ',
    'translate.bar.hide': '✕',
    'translate.status.splitReady': (n: number) => `Tách được ${n} đoạn — đang dịch…`,
    'translate.status.ready': 'Đã dịch xong — công thức & code giữ nguyên 100%',
    'translate.status.original': 'Đã chuyển về bản gốc.',
    'translate.status.cache': 'Dùng bản dịch đã lưu.',
    'translate.status.error': '✗ ',
    'translate.panel.summaryTitle': '📝 Tóm tắt đề',
    'translate.panel.summaryEmpty': 'Chưa tóm tắt — bấm 📝 Tóm tắt để tạo.',
    'translate.sideBySide.title': 'Song ngữ',
    'translate.sideBySide.original': 'Bản gốc',
    'translate.sideBySide.translated': 'Bản dịch',
    'translate.sideBySide.close': '✕',
    'translate.blocked.title': '⚠️ Contest Safety — LLM bị khóa',
    'translate.blocked.body': 'Bạn đang thi/contest — theo quy định Codeforces, hãy mở đề gốc và tránh dùng AI. Module này đang chặn LLM theo mặc định.',
    'translate.blocked.confirm': 'Bỏ qua (phiên này)',
    'translate.blocked.cancel': 'Không, hủy thao tác',
    'translate.blocked.noOverride': 'Bật "Cho phép bật LLM trong contest" trong Options nếu bạn muốn override sau xác nhận.',
    'translate.noStatement': 'Không thấy đề bài (.problem-statement) trên trang này.',
    'translate.noUnits': 'Không tìm thấy đoạn văn nào để dịch.',
  },
  en: {
    'translate.bar.translate': '🌐 Translate',
    'translate.bar.retranslate': '🌐 Re-translate',
    'translate.bar.original': '↩ Original',
    'translate.bar.summary': '📝 Tóm tắt',
    'translate.bar.sideBySide': '▤ Side-by-side',
    'translate.bar.hide': '✕',
    'translate.status.splitReady': (n: number) => `Extracted ${n} segments — translating…`,
    'translate.status.ready': 'Translated — formulas & code kept 100%',
    'translate.status.original': 'Switched to original.',
    'translate.status.cache': 'Using cached translation.',
    'translate.status.error': '✗ ',
    'translate.panel.summaryTitle': '📝 Summary',
    'translate.panel.summaryEmpty': 'Not summarized yet — click 📝 Tóm tắt to generate.',
    'translate.sideBySide.title': 'Side-by-side',
    'translate.sideBySide.original': 'Original',
    'translate.sideBySide.translated': 'Translated',
    'translate.sideBySide.close': '✕',
    'translate.blocked.title': '⚠️ Contest Safety — LLM locked',
    'translate.blocked.body': 'You are in a contest — Codeforces rules forbid using external AI. The LLM is locked by default.',
    'translate.blocked.confirm': 'Override (this session)',
    'translate.blocked.cancel': 'No, cancel',
    'translate.blocked.noOverride': 'Enable "Allow LLM override in contest" in Options if you want to override after confirmation.',
    'translate.noStatement': 'No problem statement found on this page.',
    'translate.noUnits': 'No paragraphs found to translate.',
  },
};

export function t(key: string, locale: Locale = 'vi', ...args: unknown[]): string {
  const entry = dict[locale]?.[key] ?? dict['en'][key] ?? key;
  if (typeof entry === 'function') return (entry as (...a: any[]) => string)(...args);
  return String(entry);
}

export function isLocale(v: unknown): v is Locale {
  return v === 'vi' || v === 'en';
}
