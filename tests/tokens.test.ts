import { describe, expect, it } from 'vitest';
import { protectMath, splitTokens, tryAlternateTokens } from '../src/shared/tokens';

describe('protectMath', () => {
  it('wraps inline math and restores via tokens', () => {
    const save: Array<{ kind: 'text'; value: string }> = [];
    const out = protectMath('Hello $x + y$ world', save);
    expect(out).toContain('⟦0⟧');
    expect(save).toHaveLength(1);
    expect(save[0].value).toBe('$x + y$');
  });

  it('wraps $$...$$ block math', () => {
    const save: Array<{ kind: 'text'; value: string }> = [];
    const out = protectMath('Block $$x^2$$ end', save);
    expect(save).toHaveLength(1);
    expect(save[0].value).toBe('$$x^2$$');
    expect(out).not.toContain('$$x^2$$');
  });

  it('does not wrap a single $', () => {
    const save: Array<{ kind: 'text'; value: string }> = [];
    const out = protectMath('2$5', save);
    expect(save).toHaveLength(0);
    expect(out).toContain('2$5');
  });
});

describe('splitTokens', () => {
  it('splits tokens and text', () => {
    const parts = splitTokens('a ⟦0⟧ b ⟦2⟧ c');
    expect(parts.filter((p) => p.i !== undefined).map((p) => p.i)).toEqual([0, 2]);
    expect(parts.filter((p) => p.text).map((p) => p.text).join('')).toContain('a');
    expect(parts.filter((p) => p.text).map((p) => p.text).join('')).toContain('c');
  });
});

describe('tryAlternateTokens', () => {
  it('detects 【n】 alternate format', () => {
    const parts = tryAlternateTokens('a 【1】 b', 3);
    expect(parts).not.toBeNull();
    expect(parts!.filter((p) => p.i !== undefined).map((p) => p.i)).toContain(1);
  });

  it('returns null for invalid index', () => {
    expect(tryAlternateTokens('a 【99】 b', 3)).toBeNull();
  });
});
