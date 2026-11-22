import browser from 'webextension-polyfill';
import { readSettings } from '../shared/settings';
import { sendMessage } from '../shared/messaging';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const MODULE_NAMES: Record<string, string> = {
  translateProblem: 'translate-problem',
  blogTranslate: 'blog-translate',
  quickSubmit: 'quick-submit',
  filters: 'filters',
  theme: 'theme',
  codeAnalysis: 'code-analysis',
  contestSafety: 'contest-safety',
};

function setStatus(text: string, cls?: string) {
  const el = $('status');
  el.textContent = text;
  el.className = 'status' + (cls ? ' ' + cls : '');
}

async function render() {
  const cfg = await readSettings();
  const list = $('modules-list');
  list.innerHTML = '';
  for (const [key, name] of Object.entries(MODULE_NAMES)) {
    const li = document.createElement('li');
    if (cfg.modules[key as keyof typeof cfg.modules]) li.className = 'on';
    const n = document.createElement('span');
    n.className = 'name';
    n.textContent = name;
    const s = document.createElement('span');
    s.className = 'state';
    s.textContent = cfg.modules[key as keyof typeof cfg.modules] ? 'ON' : 'off';
    li.append(n, s);
    list.appendChild(li);
  }
}

$('btn-options').addEventListener('click', async () => {
  setStatus('Opening Options…');
  try {
    await browser.runtime.openOptionsPage();
    window.close();
  } catch (e) {
    setStatus('Could not open Options: ' + String(e), 'err');
  }
});

(async () => {
  await render();
  // Ping background (harmless) to show connectivity
  sendMessage({ type: 'ping' })
    .then((r) => {
      if (r && r.ok) setStatus('Background OK', 'ok');
      else setStatus('Background unreachable', 'err');
    })
    .catch(() => setStatus('Background unreachable', 'err'));
})();
