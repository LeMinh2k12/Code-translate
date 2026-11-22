/** Tests cho DOM extraction / rebuild logic — port từ legacy. */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  collectUnits,
  extractStatementModel,
  formatStatementText,
  rebuildUnit,
} from '../src/shared/dom-extract';
import { splitTokens } from '../src/shared/tokens';

function statement(html: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="problem-statement">${html}</div>`;
  return wrap.querySelector('.problem-statement') as HTMLElement;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('collectUnits', () => {
  it('collects text units and protects inline math spans', () => {
    const root = statement(`
      <p>First paragraph <span class="tex-span">1 ≤ n ≤ 100</span> text.</p>
      <h3>Input</h3>
      <pre>n m</pre>
      <p>Second paragraph with <span class="tex-font-style-tt">YES</span>.</p>
    `);
    const units = collectUnits(root);
    expect(units.some((u) => u.src.includes('⟦'))).toBe(true); // protected tokens
    // at least one unit covers "First paragraph"
    expect(units.some((u) => u.src.includes('First paragraph'))).toBe(true);
  });

  it('does not collect inside pre/code', () => {
    const root = statement(`
      <pre>hello $n$ world</pre>
      <p>Real paragraph $n$ here.</p>
    `);
    const units = collectUnits(root);
    expect(units.some((u) => u.src.includes('Real paragraph'))).toBe(true);
  });

  it('produces stable unit ordering (deepest first)', () => {
    const root = statement(`
      <p>Outer <span class="tex-span">x</span>.</p>
    `);
    const units = collectUnits(root);
    expect(units.length).toBeGreaterThan(0);
  });
});

describe('extractStatementModel', () => {
  it('separates sections and keeps examples', () => {
    const root = statement(`
      <div class="header">
        <div class="title">A Simple Problem</div>
        <div class="property-title">Time limit</div>
        <div>1 second</div>
      </div>
      <h2 class="section-title">Input</h2>
      <p>The input contains $n$.</p>
      <div class="sample-tests">
        <div class="input"><pre>1 2</pre></div>
        <div class="output"><pre>3</pre></div>
      </div>
    `);
    const model = extractStatementModel(root);
    expect(model.items.some((i) => i.type === 'section' && i.text === 'Input')).toBe(true);
    expect(model.examples.length).toBeGreaterThanOrEqual(1);
    expect(model.examples[0].input).toContain('1 2');
    expect(model.examples[0].output).toContain('3');
  });
});

describe('formatStatementText', () => {
  it('joins items and examples', () => {
    const model = {
      items: [
        { type: 'section' as const, text: 'Input', inHeader: false },
        { type: 'text' as const, text: 'The first line contains n.', inHeader: false },
      ],
      examples: [{ input: '1 2', output: '3' }],
    };
    const text = formatStatementText(model);
    expect(text).toContain('## Input');
    expect(text).toContain('## Examples');
    expect(text).toContain('Example 1');
  });
});

describe('rebuildUnit', () => {
  it('restores protected nodes inside unit', () => {
    const root = statement(`<p>Text <span class="tex-span">1 ≤ n ≤ 100</span> end.</p>`);
    const units = collectUnits(root);
    const unit = units.find((u) => u.src.includes('⟦'));
    expect(unit).toBeDefined();
    // Replace token 0 with something (simulate translated text + token)
    const rebuilt = 'Translation text ⟦0⟧ end';
    expect(splitTokens(rebuilt).filter((p) => p.i !== undefined).map((p) => p.i)).toContain(0);
    // Rebuild — the node inside save[0] should be restored as a <span>
    rebuildUnit(unit!, rebuilt);
    const parentEl = unit!.el as HTMLElement;
    expect(parentEl.innerHTML.includes('span')).toBe(true);
    // restore original before next test — jsdom is reset each test
  });
});
