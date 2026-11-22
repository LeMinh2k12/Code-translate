/**
 * Contest safety module — skeleton.
 * Detects contest pages and shows a banner when contest mode is active.
 * LLM-blocking wiring happens in translate-problem (later).
 */
import type { CfModule, ModuleContext } from './module-interface';
import { registerModule } from './module-interface';
import { isContestPage } from './url-match';
import { ensureShadow, applyStyles } from '../../shared/shadow-dom';

export const CONTEST_BANNER_ID = 'cf-contest-safety-banner';
let bannerHost: HTMLElement | null = null;

function showContestBanner(): void {
  if (document.getElementById(CONTEST_BANNER_ID)) return;
  bannerHost = document.createElement('div');
  bannerHost.id = CONTEST_BANNER_ID;
  const shadow = ensureShadow(bannerHost);
  applyStyles(
    shadow,
    `:host{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;font-family:system-ui,sans-serif}
     .banner{background:#7c2d12;color:#fff;border-radius:10px;padding:10px 16px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.4);display:flex;gap:12px;align-items:center;max-width:90vw}
     .dot{width:8px;height:8px;border-radius:50%;background:#fbbf24;animation:pulse 1.2s infinite}
     @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
     .hint{font-size:11px;opacity:.85}`,
  );
  const el = document.createElement('div');
  el.className = 'banner';
  el.innerHTML =
    `<span class="dot"></span><div><b>Contest Safety</b><div class="hint">Contest mode is active — LLM features (AI translate / summarize) are locked by default.</div></div>`;
  shadow.appendChild(el);
  (document.body || document.documentElement).appendChild(bannerHost);
}

function hideContestBanner(): void {
  document.getElementById(CONTEST_BANNER_ID)?.remove();
  bannerHost = null;
}

const contestSafetyModule: CfModule = {
  id: 'contest-safety',
  name: 'contest-safety',
  matches: (url) => isContestPage(url),
  init(ctx: ModuleContext) {
    const cfg = ctx.settings.contestSafety;
    const active = cfg.mode === 'on' || (cfg.mode === 'auto' && isContestPage(new URL(window.location.href)));
    if (active) {
      showContestBanner();
      ctx.setStatus('warn', 'Contest mode active — LLM features locked by default');
    }
  },
  destroy() {
    hideContestBanner();
  },
};

export function contestSafetyIsActive(url: URL): boolean {
  void url;
  return isContestPage(new URL(window.location.href));
}

registerModule(contestSafetyModule);
