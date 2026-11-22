/**
 * Contest safety module — banner trên trang contest.
 * LLM blocking thực sự nằm trong translate-problem module (theo isContestPage).
 */
import type { CfModule, ModuleContext } from './module-interface';
import { registerModule } from './module-interface';
import { isContestPage } from './url-match';
import { ensureShadow, applyStyles } from '../../shared/shadow-dom';

const BANNER_ID = 'cf-contest-safety-banner';

const CSS = `
:host { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483647; font-family: system-ui, sans-serif; }
.banner { background: #7c2d12; color: #fff; border-radius: 10px; padding: 10px 16px; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,.4); display: flex; gap: 12px; align-items: center; max-width: 90vw; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #fbbf24; animation: pulse 1.2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
.hint { font-size: 11px; opacity: .85; }
`;

const contestSafetyModule: CfModule = {
  id: 'contest-safety',
  name: 'contest-safety',
  matches: (url) => isContestPage(url),
  init(ctx: ModuleContext) {
    const cfg = ctx.settings.contestSafety;
    const active = cfg.mode === 'on' || (cfg.mode === 'auto' && isContestPage(new URL(window.location.href)));
    if (!active) return () => {};

    const host = document.createElement('div');
    host.id = BANNER_ID;
    const shadow = ensureShadow(host);
    applyStyles(shadow, CSS);
    const banner = document.createElement('div');
    banner.className = 'banner';
    banner.innerHTML =
      `<span class="dot"></span><div><b>Contest Safety</b><div class="hint">Contest mode is active — LLM features (AI translate / summarize) are locked by default.</div></div>`;
    shadow.appendChild(banner);
    (document.body || document.documentElement).appendChild(host);

    ctx.setStatus('warn', 'Contest mode active — LLM features locked by default');

    return () => {
      try {
        const el = document.getElementById(BANNER_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch {}
    };
  },
};

registerModule(contestSafetyModule);
