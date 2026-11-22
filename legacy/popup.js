'use strict';

const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  engine: 'google',
  target: 'vi',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  openaiBase: 'https://api.openai.com/v1',
  openaiKey: '',
  openaiModel: 'gpt-4o-mini',
  auto: false
};

function toggleBoxes() {
  const eng = $('engine').value;
  $('gemini-box').classList.toggle('hidden', eng !== 'gemini');
  $('openai-box').classList.toggle('hidden', eng !== 'openai');
}

function setStatus(text, cls) {
  const s = $('status');
  s.textContent = text;
  s.className = cls || '';
}

function collect() {
  return {
    engine: $('engine').value,
    target: $('target').value,
    geminiKey: $('geminiKey').value.trim(),
    geminiModel: $('geminiModel').value.trim() || 'gemini-2.5-flash',
    openaiBase: $('openaiBase').value.trim() || 'https://api.openai.com/v1',
    openaiKey: $('openaiKey').value.trim(),
    openaiModel: $('openaiModel').value.trim() || 'gpt-4o-mini',
    auto: $('auto').checked
  };
}

function save() {
  const cfg = collect();
  chrome.storage.sync.set(cfg);
  // Engine OpenAI-compatible trỏ tới domain lạ → xin quyền truy cập
  if (cfg.engine === 'openai' && cfg.openaiBase) {
    try {
      const origin = new URL(cfg.openaiBase).origin + '/*';
      chrome.permissions.contains({ origins: [origin] }).then((has) => {
        if (!has) chrome.permissions.request({ origins: [origin] }).catch(() => {});
      }).catch(() => {});
    } catch (e) { /* base URL sai — báo khi dịch */ }
  }
}

async function sendToTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) { setStatus('Không tìm thấy tab hiện tại.', 'err'); return; }
  chrome.tabs.sendMessage(tab.id, message, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus('Hãy mở một trang đề bài trên codeforces.com rồi thử lại.', 'err');
      return;
    }
    if (resp && resp.ok) setStatus('✓ ' + (resp.msg || 'Thành công'), 'ok');
    else setStatus('✗ ' + ((resp && resp.msg) || 'Lỗi không xác định'), 'err');
  });
}

// ---- Khởi tạo: nạp cài đặt đã lưu ----
chrome.storage.sync.get(DEFAULTS, (cfg) => {
  $('engine').value = cfg.engine;
  $('target').value = cfg.target;
  $('geminiKey').value = cfg.geminiKey;
  $('geminiModel').value = cfg.geminiModel;
  $('openaiBase').value = cfg.openaiBase;
  $('openaiKey').value = cfg.openaiKey;
  $('openaiModel').value = cfg.openaiModel;
  $('auto').checked = !!cfg.auto;
  toggleBoxes();
});

$('engine').addEventListener('change', () => { toggleBoxes(); save(); });
['target', 'geminiKey', 'geminiModel', 'openaiBase', 'openaiKey', 'openaiModel', 'auto']
  .forEach((id) => $(id).addEventListener('change', save));

$('btn-translate').addEventListener('click', () => sendToTab({ type: 'cf-do-translate', force: true }));
$('btn-original').addEventListener('click', () => sendToTab({ type: 'cf-show-original' }));
$('btn-summarize').addEventListener('click', () => sendToTab({ type: 'cf-do-summarize' }));
