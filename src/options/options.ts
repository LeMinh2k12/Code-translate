import { readSettings, writeSettings, type PublicSettings } from '../shared/settings';
import { sendMessage, type SendResult } from '../shared/messaging';
import { readKeys, writeKeys, type LlmKeys } from '../shared/secrets';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

async function mask(s?: string): Promise<string> {
  if (!s) return '';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

const MODULE_KEYS: Array<{ id: string; key: keyof PublicSettings['modules'] }> = [
  { id: 'translateProblem', key: 'translateProblem' },
  { id: 'blogTranslate', key: 'blogTranslate' },
  { id: 'quickSubmit', key: 'quickSubmit' },
  { id: 'filters', key: 'filters' },
  { id: 'theme', key: 'theme' },
  { id: 'codeAnalysis', key: 'codeAnalysis' },
  { id: 'contestSafety', key: 'contestSafety' },
];

function setStatus(text: string, cls?: string) {
  const el = $('status');
  el.textContent = text;
  el.className = 'status' + (cls ? ' ' + cls : '');
}

function setLlmStatus(text: string, cls?: string) {
  const el = $('llm-status');
  el.textContent = text;
  el.className = 'status' + (cls ? ' ' + cls : '');
}

async function renderModules(cfg: PublicSettings) {
  const grid = $('modules-toggles');
  grid.innerHTML = '';
  for (const { id, key } of MODULE_KEYS) {
    const lbl = document.createElement('label');
    lbl.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'mod-' + id;
    cb.checked = !!cfg.modules[key];
    lbl.append(cb, document.createTextNode(' ' + id));
    grid.appendChild(lbl);
  }
}

async function load() {
  const cfg = await readSettings();
  $('locale').setAttribute('value', cfg.locale);
  ($('locale') as HTMLSelectElement).value = cfg.locale;
  $('themeMode').setAttribute('value', cfg.theme.mode);
  ($('themeMode') as HTMLSelectElement).value = cfg.theme.mode;
  ($('themeWidth') as HTMLInputElement).value = String(cfg.theme.contentWidth);
  ($('themeFontSize') as HTMLInputElement).value = String(cfg.theme.fontSize);
  ($('targetLang') as HTMLSelectElement).value = cfg.translate.targetLang;
  ($('allowFreeEngine') as HTMLInputElement).checked = cfg.translate.allowFreeEngine;
  ($('autoTranslate') as HTMLInputElement).checked = cfg.translate.auto;
  ($('glossaryVi') as HTMLTextAreaElement).value = cfg.translate.glossaryVi || '';
  ($('provider') as HTMLSelectElement).value = cfg.llm.provider;
  ($('provider') as HTMLSelectElement).setAttribute('value', cfg.llm.provider);
  $('keysStoreSync').setAttribute('checked', String(cfg.llm.keysStore === 'sync'));
  ($('keysStoreSync') as HTMLInputElement).checked = cfg.llm.keysStore === 'sync';
  ($('hotkey') as HTMLInputElement).value = cfg.submit.hotkey;
  ($('persistLang') as HTMLInputElement).checked = cfg.submit.persistLanguagePerContest;
  ($('contestMode') as HTMLSelectElement).value = cfg.contestSafety.mode;
  ($('contestAllowLlm') as HTMLInputElement).checked = cfg.contestSafety.allowLlmOverride;

  // Model field based on provider
  const modelKey = providerModelKey(cfg.llm.provider);
  let modelVal = '';
  if (modelKey === 'geminiModel') modelVal = cfg.llm.geminiModel;
  else if (modelKey === 'anthropicModel') modelVal = cfg.llm.anthropicModel;
  else modelVal = cfg.llm.openaiModel;
  ($('providerModel') as HTMLInputElement).value = modelVal;
  ($('openaiBase') as HTMLInputElement).value = cfg.llm.openaiBase;

  // Keys: chỉ hiện dạng masked ở ô input — người dùng nhập lại khi muốn đổi
  const keys = await readKeys();
  ($('geminiKey') as HTMLInputElement).value = ''; // không autofill theo best-practice
  ($('openaiKey') as HTMLInputElement).value = '';
  ($('anthropicKey') as HTMLInputElement).value = '';
  const gm = $('geminiKey') as HTMLInputElement;
  gm.placeholder = keys.geminiKey ? await mask(keys.geminiKey) : 'AIza...';
  const om = $('openaiKey') as HTMLInputElement;
  om.placeholder = keys.openaiKey ? await mask(keys.openaiKey) : 'sk-...';
  const am = $('anthropicKey') as HTMLInputElement;
  am.placeholder = keys.anthropicKey ? await mask(keys.anthropicKey) : 'sk-ant-...';

  await renderModules(cfg);
}

function providerModelKey(provider: string): 'geminiModel' | 'anthropicModel' | 'openaiModel' {
  if (provider === 'gemini') return 'geminiModel';
  if (provider === 'anthropic') return 'anthropicModel';
  return 'openaiModel';
}

function readModules(): Partial<PublicSettings['modules']> {
  const out: Record<string, boolean> = {};
  for (const { id, key } of MODULE_KEYS) {
    const cb = document.getElementById('mod-' + id) as HTMLInputElement | null;
    if (cb) out[key] = cb.checked;
  }
  return out;
}

async function save() {
  const cfg = await readSettings();
  const provider = ($('provider') as HTMLSelectElement).value;
  const modelKey = providerModelKey(provider);
  const model = ($('providerModel') as HTMLInputElement).value.trim();
  const keysStoreSync = ($('keysStoreSync') as HTMLInputElement).checked;

  const patch: Partial<PublicSettings> = {
    locale: ($('locale') as HTMLSelectElement).value as PublicSettings['locale'],
    theme: {
      ...cfg.theme,
      mode: ($('themeMode') as HTMLSelectElement).value as PublicSettings['theme']['mode'],
      contentWidth: Number(($('themeWidth') as HTMLInputElement).value) || 0,
      fontSize: Number(($('themeFontSize') as HTMLInputElement).value) || 0,
    },
    modules: { ...cfg.modules, ...readModules() },
    translate: {
      ...cfg.translate,
      targetLang: ($('targetLang') as HTMLSelectElement).value,
      engine: provider as PublicSettings['translate']['engine'],
      auto: ($('autoTranslate') as HTMLInputElement).checked,
      glossaryVi: ($('glossaryVi') as HTMLTextAreaElement).value.trim(),
      allowFreeEngine: ($('allowFreeEngine') as HTMLInputElement).checked,
    },
    submit: {
      ...cfg.submit,
      hotkey: ($('hotkey') as HTMLInputElement).value.trim() || 'Ctrl+Enter',
      persistLanguagePerContest: ($('persistLang') as HTMLInputElement).checked,
    },
    contestSafety: {
      ...cfg.contestSafety,
      mode: ($('contestMode') as HTMLSelectElement).value as PublicSettings['contestSafety']['mode'],
      allowLlmOverride: ($('contestAllowLlm') as HTMLInputElement).checked,
    },
    llm: {
      ...cfg.llm,
      provider: provider as PublicSettings['llm']['provider'],
      keysStore: keysStoreSync ? 'sync' : 'local',
      geminiModel: modelKey === 'geminiModel' ? model : cfg.llm.geminiModel,
      anthropicModel: modelKey === 'anthropicModel' ? model : cfg.llm.anthropicModel,
      openaiModel: modelKey === 'openaiModel' ? model : cfg.llm.openaiModel,
      openaiBase: ($('openaiBase') as HTMLInputElement).value.trim() || cfg.llm.openaiBase,
    },
  };

  await writeSettings(patch);

  // Keys (chỉ ghi khi người dùng nhập vào ô)
  const geminiKey = ($('geminiKey') as HTMLInputElement).value.trim();
  const openaiKey = ($('openaiKey') as HTMLInputElement).value.trim();
  const anthropicKey = ($('anthropicKey') as HTMLInputElement).value.trim();
  const existing = await readKeys();
  const newKeys: LlmKeys = {
    geminiKey: geminiKey || existing.geminiKey,
    openaiKey: openaiKey || existing.openaiKey,
    anthropicKey: anthropicKey || existing.anthropicKey,
  };
  await writeKeys(newKeys, keysStoreSync ? 'sync' : 'local');

  // Clear các ô nhập key sau khi lưu (tránh lộ key trên máy)
  ($('geminiKey') as HTMLInputElement).value = '';
  ($('openaiKey') as HTMLInputElement).value = '';
  ($('anthropicKey') as HTMLInputElement).value = '';

  setStatus('✓ Đã lưu.', 'ok');
}

async function testConnection() {
  setLlmStatus('Đang kiểm tra…');
  const r = await sendMessage<SendResult>({ type: 'llm:ping' });
  if (r && r.ok) {
    setLlmStatus('✓ Kết nối OK', 'ok');
  } else {
    setLlmStatus('✗ ' + ((r as { error?: string })?.error || 'Lỗi kết nối'), 'err');
  }
}

$('btn-save').addEventListener('click', () => {
  setStatus('Đang lưu…');
  save().catch((e) => setStatus('✗ ' + String(e?.message || e), 'err'));
});
$('btn-test').addEventListener('click', () => testConnection());
// Auto-save on change for simple fields
['locale', 'themeMode', 'themeWidth', 'themeFontSize', 'targetLang', 'autoTranslate', 'hotkey', 'contestMode', 'provider', 'keysStoreSync', 'glossaryVi'].forEach((id) => {
  $(id)?.addEventListener('change', () => {
    setStatus('Đang lưu…');
    save().then(() => setTimeout(() => setStatus(''), 2500)).catch((e) => setStatus('✗ ' + String(e?.message || e), 'err'));
  });
});
// Modules auto-save on toggle
$('modules-toggles')?.addEventListener('change', () => {
  setStatus('Đang lưu…');
  save().then(() => setTimeout(() => setStatus(''), 2500)).catch((e) => setStatus('✗ ' + String(e?.message || e), 'err'));
});
$('keysStoreSync')?.addEventListener('change', () => {
  // sau khi đổi store: re-save keys theo store mới nếu có key cũ
  setStatus('Đang lưu keys…');
  save().then(() => setTimeout(() => setStatus(''), 2500)).catch((e) => setStatus('✗ ' + String(e?.message || e), 'err'));
});

load();
