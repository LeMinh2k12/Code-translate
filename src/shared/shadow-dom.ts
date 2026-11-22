/** Shadow DOM / style helpers cho UI do extension chèn vào trang. */
export function ensureShadow(host?: HTMLElement): ShadowRoot {
  let hostEl = host;
  if (!hostEl) {
    const id = 'cf-toolkit-root';
    hostEl = document.querySelector<HTMLElement>('#' + id) ?? undefined;
    if (!hostEl) {
      const el = document.createElement('div');
      el.id = id;
      (document.body || document.documentElement).appendChild(el);
      hostEl = el;
    }
  }
  if (!hostEl.shadowRoot) {
    hostEl.attachShadow({ mode: 'open' });
  }
  return hostEl.shadowRoot!;
}

/** Áp dụng style (inline <style> bên trong shadow root; fallback adoptedStyleSheets nếu có). */
export function applyStyles(shadow: ShadowRoot, css: string): void {
  const style = shadow.querySelector('style');
  if (style) {
    style.textContent = css;
    return;
  }
  const el = document.createElement('style');
  el.textContent = css;
  shadow.appendChild(el);
}

/** Áp dụng style cho toàn trang (theme), chạy một lần với id cố định. */
export function applyPageCss(id: string, css: string): void {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    (document.head || document.documentElement).appendChild(el);
  }
  el.textContent = css;
}

export function removePageCss(id: string): void {
  document.getElementById(id)?.remove();
}
