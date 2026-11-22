import { describe, expect, it } from 'vitest';
import { readSettings, writeSettings, DEFAULT_SETTINGS, type PublicSettings } from '../src/shared/settings';

describe('settings', () => {

  it('returns defaults when nothing stored', async () => {
    const cfg = await readSettings();
    expect(cfg.locale).toBe(DEFAULT_SETTINGS.locale);
    expect(cfg.modules.translateProblem).toBe(true);
    expect(cfg.llm.provider).toBe('gemini');
  });

  it('persists partial writes and merges', async () => {
    await writeSettings({ locale: 'en', theme: { mode: 'dark' } as PublicSettings['theme'] });
    const cfg = await readSettings();
    expect(cfg.locale).toBe('en');
    expect(cfg.theme.mode).toBe('dark');
    expect(cfg.theme.contentWidth).toBe(0); // untouched default
    expect(cfg.theme.id).toBe('dracula');
  });

  it('writes modules toggles', async () => {
    await writeSettings({ modules: { ...DEFAULT_SETTINGS.modules, quickSubmit: true } });
    const cfg = await readSettings();
    expect(cfg.modules.quickSubmit).toBe(true);
    expect(cfg.modules.filters).toBe(true);
  });
});
