/**
 * Theme module — injects dark/light CSS for Codeforces pages.
 * mode: 'light' | 'dark' | 'auto' (theo hệ thống)
 */
import type { CfModule, ModuleContext } from './module-interface';
import { registerModule } from './module-interface';
import { applyPageCss, removePageCss } from '../../shared/shadow-dom';

const CSS_ID = 'cf-toolkit-theme-style';

function cssFor(mode: 'light' | 'dark', fontSize: number, fontCode: string, width: number): string {
  const dark = mode === 'dark';
  const body = dark ? '#1f2430;color:#d8dbe0' : '#ffffff;color:#222';
  const border = dark ? '#2c3340' : '#e0e0e0';
  const block = dark ? '#262c38' : '#fafafa';
  const link = dark ? '#7cb3ff' : '#0366d6';
  const lines = [
    `html, body { background: ${body} }`,
    `body { font-size: ${fontSize || 14}px; }`,
    `a { color: ${link} !important; }`,
    `.problem-statement, .contest-table, table, .blog-content, .entry { background: ${block}; border-color: ${border}; }`,
    `pre, code { font-family: ${fontCode || "'JetBrains Mono', 'Fira Code', Consolas, monospace"}; }`,
    `:root { color-scheme: ${mode}; }`,
  ];
  if (width > 0) lines.push(`.problem-statement { max-width: ${width}px !important; }`);
  return lines.join('\n');
}

function resolveMode(mode: 'light' | 'dark' | 'auto'): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

const themeModule: CfModule = {
  id: 'theme',
  name: 'theme',
  matches: () => true,
  init(ctx: ModuleContext) {
    const cfg = ctx.settings.theme;
    let mediaListener: MediaQueryList | null = null;
    let mediaHandler: (() => void) | null = null;

    const apply = () => {
      const mode = resolveMode(cfg.mode);
      applyPageCss(CSS_ID, cssFor(mode, cfg.fontSize, cfg.fontCode, cfg.contentWidth));
    };
    apply();

    if (cfg.mode === 'auto' && window.matchMedia) {
      mediaHandler = apply;
      mediaListener = window.matchMedia('(prefers-color-scheme: dark)');
      mediaListener.addEventListener('change', apply);
    }

    return () => {
      if (mediaListener && mediaHandler) mediaListener.removeEventListener('change', mediaHandler);
      removePageCss(CSS_ID);
    };
  },
};

registerModule(themeModule);
