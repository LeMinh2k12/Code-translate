/** Direct tests for the translate-problem module — gate, flow, rebuild. */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/shared/settings';
import type { ModuleContext } from '../src/content/modules/module-interface';
import type { PublicSettings } from '../src/shared/settings';
import translateProblemModule from '../src/content/modules/translate-problem';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeCtx(settings: PublicSettings, output: unknown): ModuleContext {
  return {
    settings,
    moduleId: 'translate-problem',
    sendBackground: async (): Promise<{ ok: true; output: string }> => ({
      ok: true,
      output: typeof output === 'string' ? output : JSON.stringify(output),
    }),
    setStatus: () => {},
  } as ModuleContext;
}

describe('translate-problem module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows contest-safety blocked banner when mode=on and never translates', async () => {
    document.body.innerHTML = '<div class="problem-statement"><p>Text with <span class="tex-span">n</span> inside.</p></div>';
    const settings = { ...structuredClone(DEFAULT_SETTINGS), contestSafety: { mode: 'on' as const, allowLlmOverride: false } };
    const ctx = fakeCtx(settings, '["fake"]');
    const disposer = await translateProblemModule.init(ctx);

    const host = document.getElementById('cf-toolkit-translate-root');
    const shadow = (host as HTMLElement).shadowRoot!;
    const translateBtn = shadow.querySelector('.bar button.primary') as HTMLButtonElement;
    expect(translateBtn).toBeTruthy();

    translateBtn.click();
    await sleep(80);

    // Blocked banner must be visible — translate must NOT run
    expect(shadow.querySelector('.blocked')).toBeTruthy();
    if (typeof disposer === 'function') await disposer();
  });

  it('translates and rebuilds DOM when contest mode is off', async () => {
    document.body.innerHTML = '<div class="problem-statement"><p>Hello <span class="tex-span">n ≤ 100</span> world.</p></div>';
    const settings = { ...structuredClone(DEFAULT_SETTINGS), contestSafety: { mode: 'off' as const, allowLlmOverride: false } };
    const ctx = fakeCtx(settings, JSON.stringify(['Xin ⟦0⟧ thế giới']));
    const disposer = await translateProblemModule.init(ctx);

    const host = document.getElementById('cf-toolkit-translate-root');
    const shadow = (host as HTMLElement).shadowRoot!;
    const translateBtn = shadow.querySelector('.bar button.primary') as HTMLButtonElement;
    translateBtn.click();
    await sleep(250);

    const stmt = document.querySelector('.problem-statement') as HTMLElement;
    expect(stmt.innerHTML).toContain('Xin'); // translated text applied
    expect(stmt.innerHTML).toContain('tex-span'); // protected node kept
    if (typeof disposer === 'function') await disposer();
  });
});

describe('re-translate + restore flow', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="problem-statement"><p>Heading <span class="tex-span">1</span> tail.</p></div>';
  });

  it('restore original button restores the page', async () => {
    const settings = { ...structuredClone(DEFAULT_SETTINGS), contestSafety: { mode: 'off' as const, allowLlmOverride: false } };
    const ctx = fakeCtx(settings, JSON.stringify(['A ⟦0⟧ B']));
    const disposer = await translateProblemModule.init(ctx);

    const host = document.getElementById('cf-toolkit-translate-root');
    const shadow = (host as HTMLElement).shadowRoot!;
    const btn = shadow.querySelector('.bar button.primary') as HTMLButtonElement;
    btn.click();
    await sleep(200);

    // Original button should now be visible
    const originalBtn = Array.from(shadow.querySelectorAll('.bar button')).find((b) => (b as HTMLButtonElement).textContent?.includes('gốc') || (b as HTMLButtonElement).textContent?.includes('riginal'));
    expect(originalBtn).toBeTruthy();

    (originalBtn as HTMLButtonElement).click();
    const stmt = document.querySelector('.problem-statement') as HTMLElement;
    expect(stmt.innerHTML).toContain('Heading');
    expect(stmt.innerHTML).not.toContain('A ⟦0⟧'); // translated ⟦0⟧ token gone — restored original text
    expect(stmt.innerHTML).toContain('tex-span'); // still there

    if (typeof disposer === 'function') await disposer();
  });
});
