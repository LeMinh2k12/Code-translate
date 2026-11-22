/**
 * Translate-problem — port sang kiến trúc mới.
 * Blocked bằng contest-safety khi thi (override chỉ per-session, không lưu).
 */
import type { CfModule, ModuleContext } from './module-interface';
import { registerModule } from './module-interface';
import { isProblemPage, isContestPage } from './url-match';
import {
  findStatementRoot,
  collectUnits,
  extractStatementModel,
  formatStatementText,
  restoreToString,
  rebuildUnit,
  type ExtractUnit,
} from '../../shared/dom-extract';
import { parseJsonArray, parseJsonObject, type SummaryCard } from '../../shared/llm-parse';
import { t, isLocale, type Locale } from '../../shared/i18n';
import { ensureShadow, applyStyles } from '../../shared/shadow-dom';

const ROOT_ID = 'cf-toolkit-translate-root';

const CSS = `
:host { z-index: 2147483646; }
.bar {
  position: fixed; bottom: 18px; right: 18px;
  background: #1e293b; color: #e2e8f0; border: 1px solid #334155;
  border-radius: 12px; padding: 8px 10px; display: flex; gap: 6px; align-items: center;
  box-shadow: 0 8px 24px rgba(0,0,0,.45); font-family: system-ui, sans-serif; font-size: 13px;
}
.bar button {
  border: 1px solid #475569; background: #334155; color: #e2e8f0;
  border-radius: 8px; padding: 6px 10px; font: inherit; font-weight: 600; cursor: pointer;
}
.bar button:hover { background: #475569; }
.bar button.primary { background: #2563eb; border-color: #3b82f6; color: #fff; }
.bar button.primary:hover { background: #1d4ed8; }
.bar button:disabled { opacity: .55; cursor: wait; }
.bar .status { margin-left: 4px; font-size: 11px; color: #94a3b8; max-width: 240px; }
.bar .close { background: transparent; border: 0; color: #94a3b8; font-size: 16px; padding: 4px; }

.panel, .sbs {
  position: fixed; top: 12px; left: 12px; right: 12px;
  background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,.5); font-family: system-ui, sans-serif; z-index: 2147483645;
  max-height: 80vh; display: flex; flex-direction: column;
}
.sbs { left: 50%; right: auto; transform: translateX(-50%); width: 92vw; }
.panel-head, .sbs-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid #334155; font-weight: 700; font-size: 14px;
}
.panel-body, .sbs-body { overflow: auto; padding: 12px 14px; display: grid; gap: 8px; }
.sbs-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sbs-col h3 { margin: 0 0 4px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #93c5fd; }
.sbs-col pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.55; color: #cbd5e1; }
.sum-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; margin-top: 6px; }
.sum-text { font-size: 13px; line-height: 1.55; color: #cbd5e1; }
.panel .close, .sbs .close { border: 0; background: transparent; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 4px; }

.blocked {
  position: fixed; top: 12px; left: 12px; right: 12px;
  background: #7c2d12; color: #fff; border-radius: 12px; padding: 14px 16px;
  font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5;
  box-shadow: 0 8px 24px rgba(0,0,0,.5); z-index: 2147483647; display: flex; gap: 14px; align-items: flex-start;
}
.blocked h3 { margin: 0 0 4px; font-size: 14px; }
.blocked p { margin: 0; opacity: .92; }
.blocked .actions { display: flex; gap: 8px; margin-left: auto; flex-shrink: 0; align-self: center; }
.blocked button { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.4); background: rgba(255,255,255,.15); color: #fff; cursor: pointer; font: inherit; font-weight: 600; }
.blocked button:hover { background: rgba(255,255,255,.25); }
`;

export const translateProblemModule: CfModule = {
  id: 'translate-problem',
  name: 'translate-problem',
  matches: (url) => isProblemPage(url),

  init(ctx: ModuleContext) {
    const locale: Locale = isLocale(ctx.settings.locale) ? ctx.settings.locale : 'vi';
    const cfg = ctx.settings;

    const state = {
      running: false,
      mode: 'original' as 'original' | 'translated',
      units: [] as ExtractUnit[],
      originalHtml: new Map<Element, string>(),
      lastCard: null as SummaryCard | null,
      sideBySideTexts: null as { original: string; translated: string } | null,
      sessionOverrideForContest: false,
    };

    // ---- host + shadow root ----
    let host = document.getElementById(ROOT_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = ROOT_ID;
      (document.body || document.documentElement).appendChild(host);
    }
    const shadow = ensureShadow(host);
    applyStyles(shadow, CSS);
    shadow.innerHTML = '';

    // ---- bar ----
    const bar = document.createElement('div');
    bar.className = 'bar';
    const translateBtn = document.createElement('button');
    translateBtn.className = 'primary';
    translateBtn.textContent = t('translate.bar.translate', locale);
    const originalBtn = document.createElement('button');
    originalBtn.textContent = t('translate.bar.original', locale);
    originalBtn.hidden = true;
    const summaryBtn = document.createElement('button');
    summaryBtn.textContent = t('translate.bar.summary', locale);
    const sideBySideBtn = document.createElement('button');
    sideBySideBtn.textContent = t('translate.bar.sideBySide', locale);
    const statusEl = document.createElement('span');
    statusEl.className = 'status';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.textContent = t('translate.bar.hide', locale);
    bar.append(translateBtn, originalBtn, summaryBtn, sideBySideBtn, statusEl, closeBtn);

    // ---- summary panel ----
    const summaryPanel = document.createElement('div');
    summaryPanel.className = 'panel';
    summaryPanel.style.display = 'none';
    const summaryHead = document.createElement('div');
    summaryHead.className = 'panel-head';
    const summaryTitle = document.createElement('span');
    summaryTitle.textContent = t('translate.panel.summaryTitle', locale);
    const summaryClose = document.createElement('button');
    summaryClose.className = 'close';
    summaryClose.textContent = t('translate.bar.hide', locale);
    summaryHead.append(summaryTitle, summaryClose);
    const summaryBody = document.createElement('div');
    summaryBody.className = 'panel-body';
    summaryPanel.append(summaryHead, summaryBody);

    // ---- side-by-side panel ----
    const sideBySidePanel = document.createElement('div');
    sideBySidePanel.className = 'sbs';
    sideBySidePanel.style.display = 'none';
    const sbsHead = document.createElement('div');
    sbsHead.className = 'sbs-head';
    const sbsTitle = document.createElement('span');
    sbsTitle.textContent = t('translate.sideBySide.title', locale);
    const sbsClose = document.createElement('button');
    sbsClose.className = 'close';
    sbsClose.textContent = t('translate.bar.hide', locale);
    sbsHead.append(sbsTitle, sbsClose);
    const sbsBody = document.createElement('div');
    sbsBody.className = 'sbs-body';
    const cols = document.createElement('div');
    cols.className = 'sbs-cols';
    const colOriginal = document.createElement('div');
    colOriginal.className = 'sbs-col';
    const hOriginal = document.createElement('h3');
    hOriginal.textContent = t('translate.sideBySide.original', locale);
    const originalPre = document.createElement('pre');
    colOriginal.append(hOriginal, originalPre);
    const colTranslated = document.createElement('div');
    colTranslated.className = 'sbs-col';
    const hTranslated = document.createElement('h3');
    hTranslated.textContent = t('translate.sideBySide.translated', locale);
    const translatedPre = document.createElement('pre');
    colTranslated.append(hTranslated, translatedPre);
    cols.append(colOriginal, colTranslated);
    sbsBody.appendChild(cols);
    sideBySidePanel.append(sbsHead, sbsBody);

    // ---- blocked banner ----
    const blockedHost = document.createElement('div');

    const setStatus = (text: string, cls = '') => {
      statusEl.textContent = text;
      statusEl.className = 'status ' + cls;
    };

    const updateButtons = () => {
      originalBtn.hidden = state.mode !== 'translated';
      translateBtn.textContent =
        state.mode === 'translated' ? t('translate.bar.retranslate', locale) : t('translate.bar.translate', locale);
    };

    const destroyBlocked = () => {
      blockedHost.innerHTML = '';
    };

    const showBlocked = () => {
      destroyBlocked();
      const card = document.createElement('div');
      card.className = 'blocked';
      const h = document.createElement('h3');
      h.textContent = t('translate.blocked.title', locale);
      const p = document.createElement('p');
      p.textContent = t('translate.blocked.body', locale);
      const actions = document.createElement('div');
      actions.className = 'actions';
      const cancel = document.createElement('button');
      cancel.textContent = t('translate.blocked.cancel', locale);
      cancel.addEventListener('click', () => destroyBlocked());
      actions.appendChild(cancel);
      const allow = cfg.contestSafety.allowLlmOverride;
      if (allow) {
        const confirm = document.createElement('button');
        confirm.textContent = t('translate.blocked.confirm', locale);
        confirm.addEventListener('click', () => {
          state.sessionOverrideForContest = true;
          destroyBlocked();
          void translate();
        });
        actions.appendChild(confirm);
        const note = document.createElement('p');
        note.textContent = '⚠ ' + t('translate.blocked.noOverride', locale);
        card.append(h, p, note);
        card.appendChild(actions);
      } else {
        const note = document.createElement('p');
        note.textContent = t('translate.blocked.noOverride', locale);
        card.append(h, p, note, actions);
      }
      blockedHost.appendChild(card);
    };

    const isContestBlocked = (): boolean => {
      const mode = cfg.contestSafety.mode;
      if (mode === 'off') return false;
      if (mode === 'on') return true;
      return isContestPage(new URL(window.location.href));
    };

    const restoreOriginal = () => {
      for (const [el, html] of state.originalHtml) {
        el.innerHTML = html;
        el.classList.remove('cf-tr-unit');
      }
      state.originalHtml.clear();
      state.units = [];
      state.sideBySideTexts = null;
      state.mode = 'original';
      sideBySidePanel.style.display = 'none';
      updateButtons();
    };

    const ensureUnitsAndOriginal = (root: HTMLElement): ExtractUnit[] => {
      state.units = collectUnits(root);
      state.units.forEach((u, i) => {
        u.idx = i;
        if (!state.originalHtml.has(u.el)) state.originalHtml.set(u.el, u.el.innerHTML);
      });
      return state.units;
    };

    const saveSideBySideTexts = (translated: string[]) => {
      const originals = state.units.map((u) => u.src);
      const translatedTexts = state.units.map((u, i) => restoreToString(translated[i] || '', u.save));
      state.sideBySideTexts = { original: originals.join('\n\n'), translated: translatedTexts.join('\n\n') };
    };

    async function translate(force = false): Promise<void> {
      void force;
      if (state.running) return;
      state.running = true;
      translateBtn.disabled = true;
      setStatus(t('translate.status.splitReady', locale, 0));
      try {
        if (isContestBlocked() && !state.sessionOverrideForContest) {
          showBlocked();
          return;
        }
        const root = findStatementRoot();
        if (!root) {
          setStatus(t('translate.noStatement', locale), 'err');
          return;
        }
        if (state.mode === 'translated') restoreOriginal();
        const units = ensureUnitsAndOriginal(root);
        if (!units.length) {
          setStatus(t('translate.noUnits', locale), 'err');
          return;
        }
        const srcs = units.map((u) => u.src);
        setStatus(t('translate.status.splitReady', locale, srcs.length));

        const resp = await ctx.sendBackground<{ ok: true; output: string }>({
          type: 'llm:translate',
          segments: srcs,
          targetLang: cfg.translate.targetLang,
          glossary: cfg.translate.glossaryVi,
          lane: 'translate',
        });
        if (!resp) {
          setStatus(t('translate.status.error', locale) + 'No response', 'err');
          return;
        }
        if (!resp.ok) {
          setStatus(t('translate.status.error', locale) + (resp as { error?: string }).error, 'err');
          return;
        }
        const out = parseJsonArray(resp.output as string);
        if (out.length !== units.length) {
          throw new Error(`Số đoạn dịch trả về không khớp (${out.length}/${units.length}) — bấm "Dịch lại".`);
        }
        for (const u of units) rebuildUnit(u, out[u.idx as number] as string);
        state.mode = 'translated';
        saveSideBySideTexts(out);
        updateButtons();
        setStatus(t('translate.status.ready', locale), 'ok');
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        setStatus(t('translate.status.error', locale) + msg, 'err');
      } finally {
        state.running = false;
        translateBtn.disabled = false;
      }
    }

    async function summarize(): Promise<void> {
      if (state.running) return;
      state.running = true;
      setStatus('Đang tóm tắt…');
      try {
        if (isContestBlocked() && !state.sessionOverrideForContest) {
          showBlocked();
          return;
        }
        const root = findStatementRoot();
        if (!root) {
          setStatus(t('translate.noStatement', locale), 'err');
          return;
        }
        const model = extractStatementModel(root);
        const text = formatStatementText(model);
        if (!text.trim()) {
          setStatus(t('translate.noStatement', locale), 'err');
          return;
        }
        const resp = await ctx.sendBackground<{ ok: true; output: string }>({
          type: 'llm:summarize',
          text,
          lane: 'summarize',
        });
        if (!resp) {
          setStatus(t('translate.status.error', locale) + 'No response', 'err');
          return;
        }
        if (!resp.ok) {
          setStatus(t('translate.status.error', locale) + (resp as { error?: string }).error, 'err');
          return;
        }
        const card = parseJsonObject(resp.output as string);
        state.lastCard = card;
        renderSummary(card);
        setStatus(t('translate.status.ready', locale), 'ok');
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        setStatus(t('translate.status.error', locale) + msg, 'err');
      } finally {
        state.running = false;
      }
    }

    const renderSummary = (card: SummaryCard) => {
      summaryBody.innerHTML = '';
      const blocks: Array<[string, string]> = [
        ['Tên bài', card.title],
        ['Nhiệm vụ', card.task],
        ['Đầu vào', card.input],
        ['Đầu ra', card.output],
        ['Ràng buộc', card.constraints],
        ['Lưu ý', card.note],
      ];
      for (const [label, text] of blocks) {
        if (!text) continue;
        const h = document.createElement('div');
        h.className = 'sum-label';
        h.textContent = label;
        const p = document.createElement('div');
        p.className = 'sum-text';
        p.textContent = text;
        summaryBody.append(h, p);
      }
      summaryPanel.style.display = 'flex';
    };

    const toggleSideBySide = () => {
      if (sideBySidePanel.style.display === 'flex') {
        sideBySidePanel.style.display = 'none';
        return;
      }
      if (!state.sideBySideTexts) {
        if (state.mode !== 'translated') {
          setStatus(t('translate.panel.summaryEmpty', locale), 'err');
          return;
        }
        // Fallback (should already have texts) — show placeholder
        state.sideBySideTexts = { original: '', translated: '' };
      }
      originalPre.textContent = state.sideBySideTexts.original;
      translatedPre.textContent = state.sideBySideTexts.translated;
      sideBySidePanel.style.display = 'flex';
    };

    // ---- events ----
    translateBtn.addEventListener('click', () => void translate(state.mode === 'translated'));
    originalBtn.addEventListener('click', () => {
      restoreOriginal();
      setStatus(t('translate.status.original', locale));
    });
    summaryBtn.addEventListener('click', () => {
      if (summaryPanel.style.display === 'flex') {
        summaryPanel.style.display = 'none';
        return;
      }
      if (state.lastCard) renderSummary(state.lastCard);
      else void summarize();
    });
    sideBySideBtn.addEventListener('click', toggleSideBySide);
    summaryClose.addEventListener('click', () => (summaryPanel.style.display = 'none'));
    sbsClose.addEventListener('click', () => (sideBySidePanel.style.display = 'none'));
    closeBtn.addEventListener('click', () => {
      bar.style.display = 'none';
      try {
        sessionStorage.setItem('cf-tr-hide', '1');
      } catch {}
    });

    // ---- append UI ----
    shadow.append(bar, summaryPanel, sideBySidePanel, blockedHost);
    try {
      if (sessionStorage.getItem('cf-tr-hide') === '1') bar.style.display = 'none';
    } catch {}
    updateButtons();

    // Auto-translate khi mở đề
    let autoTimer: ReturnType<typeof setTimeout> | null = null;
    if (cfg.translate.auto && !isContestBlocked()) {
      autoTimer = setTimeout(() => void translate(false), 700);
    }

    // ---- disposer: restore DOM + remove UI ----
    return () => {
      if (autoTimer) clearTimeout(autoTimer);
      restoreOriginal();
      try {
        const hostEl = document.getElementById(ROOT_ID);
        if (hostEl && hostEl.parentNode) hostEl.parentNode.removeChild(hostEl);
      } catch {}
    };
  },
};

registerModule(translateProblemModule);
export default translateProblemModule;
