/**
 * DOM extraction cho problem statement — port từ v1 legacy content.js,
 * tách ra để dùng cho mọi module (translate-problem, summarize).
 *
 * Nguyên tắc:
 *  - Protect mọi thứ CHƯA được dịch (MathJax .tex-span, pre, links...) vào save list
 *  - Unit text chứa token ⟦n⟧ thay vì nội dung thực
 *  - Sau dịch: rebuild(unit, translated) đọc token + save list để khôi phục
 */
import { tok, protectMath, splitTokens, tryAlternateTokens } from './tokens';

const UNIT_SEL = 'p, li, h1, h2, h3, h4, h5, h6, .title, .section-title, ' +
  '.property-title, .header > div, td, th, figcaption, blockquote, .cf-tr-orphan';

const SKIP_SEL = [
  'pre', 'code', 'kbd', 'samp', 'a', 'img', 'picture', 'video', 'audio',
  'button', 'textarea', 'select', 'input', 'script', 'style', 'iframe',
  'object', 'embed', 'svg', 'noscript', 'template',
  'sup', 'sub',
  '.tex-span', '.tex-equation', '.tex-font-style-tt',
  '.input-output-copier',
  'mjx-container', '.MathJax', '[class*="MathJax"]', '.katex',
].join(',');

export interface ExtractSave {
  kind: 'node' | 'text';
  value: Node | string;
}

export interface ExtractUnit {
  el: Element;
  save: ExtractSave[];
  src: string;
  idx?: number;
}

/** Wrap inline text nodes ngoài unit vào span .cf-tr-orphan để chúng trở thành unit. */
export function wrapOrphans(root: ParentNode): void {
  root.querySelectorAll('div').forEach((div) => {
    if (div.closest(SKIP_SEL)) return;
    if (div.matches(UNIT_SEL) && !div.querySelector(UNIT_SEL)) return;
    for (const n of Array.from(div.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE && n.nodeValue && n.nodeValue.trim()) {
        const span = document.createElement('span');
        span.className = 'cf-tr-orphan';
        div.replaceChild(span, n);
        span.appendChild(n);
      }
    }
  });
}

function pushNode(node: Node, save: ExtractSave[]): string {
  const i = save.length;
  save.push({ kind: 'node', value: node });
  return tok(i);
}

function buildUnitText(el: Element, save: ExtractSave[], candSet: Set<Element>): string {
  let out = '';
  const walk = (node: Node) => {
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === Node.TEXT_NODE) {
        out += c.nodeValue;
        continue;
      }
      if (c.nodeType !== Node.ELEMENT_NODE) continue;
      if (candSet.has(c as Element)) {
        out += pushNode(c, save);
        continue;
      }
      if ((c as Element).matches(SKIP_SEL)) {
        out += pushNode(c, save);
        continue;
      }
      if ((c as Element).tagName === 'BR') {
        out += ' ';
        continue;
      }
      walk(c);
    }
  };
  walk(el);
  out = out.replace(/[ \t\r]*\n+[ \t\r]*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  out = protectMath(out, save);
  return out;
}

function depthOf(el: Element): number {
  let d = 0;
  let e: Element | null = el;
  while (e) {
    d++;
    e = e.parentElement;
  }
  return d;
}

/** Thu thập đơn vị văn bản để dịch (đơn vị lá). */
export function collectUnits(root: ParentNode): ExtractUnit[] {
  wrapOrphans(root);
  const cands = Array.from((root as Element).querySelectorAll(UNIT_SEL));
  const candSet = new Set(cands);
  const units: ExtractUnit[] = [];
  for (const el of cands) {
    if (el.closest(SKIP_SEL)) continue;
    const save: ExtractSave[] = [];
    const src = buildUnitText(el, save, candSet);
    const prose = src.replace(new RegExp('⟦\\s*(\\d+)\\s*⟧', 'g'), '').trim();
    if (!prose) continue;
    units.push({ el, save, src });
  }
  // Sắp xếp theo depth DESC — để con sinh trước, cha sinh sau (chống ghi đè)
  units.sort((a, b) => depthOf(b.el) - depthOf(a.el));
  return units;
}

export interface StatementItem {
  type: 'title' | 'section' | 'prop' | 'text';
  text: string;
  inHeader: boolean;
}

export interface StatementModel {
  items: StatementItem[];
  examples: Array<{ input: string; output: string }>;
}

function preText(node: Node): string {
  let out = '';
  for (const c of node.childNodes) {
    if (c.nodeType === Node.TEXT_NODE) out += c.nodeValue;
    else if (c.nodeType === Node.ELEMENT_NODE) {
      const tag = (c as Element).tagName.toLowerCase();
      if (tag === 'br') out += '\n';
      else if (tag === 'div') out += preText(c) + '\n';
      else out += preText(c);
    }
  }
  return out;
}

/** Trích xuất mô hình đề (cho tóm tắt) — không dịch. */
export function extractStatementModel(root: ParentNode): StatementModel {
  const clone = (root as Element).cloneNode(true) as Element;

  // TRÍCH XUẤT VÍ DỤ TRƯỚC (vì sau này sẽ xóa <pre>)
  const examples: Array<{ input: string; output: string }> = [];
  const sampleSection = clone.querySelector('.sample-tests');
  if (sampleSection) {
    const ins = Array.from(sampleSection.querySelectorAll('.input pre'));
    const outs = Array.from(sampleSection.querySelectorAll('.output pre'));
    const n = Math.min(ins.length, outs.length, 2);
    for (let i = 0; i < n; i++) {
      const a = preText(ins[i]).replace(/[ \t]+/g, ' ').trim();
      const b = preText(outs[i]).replace(/[ \t]+/g, ' ').trim();
      if (a || b) examples.push({ input: a.slice(0, 300), output: b.slice(0, 300) });
    }
  }

  clone.querySelectorAll('pre, code, script, style, .input-output-copier').forEach((e) => e.remove());
  clone.querySelectorAll('.sample-test').forEach((e) => e.remove());
  clone.querySelectorAll('sup').forEach((s) => {
    s.textContent = '^' + (s.textContent || '');
  });
  clone.querySelectorAll('sub').forEach((s) => {
    s.textContent = '_' + (s.textContent || '');
  });
  wrapOrphans(clone);

  const items: StatementItem[] = [];
  for (const el of clone.querySelectorAll(UNIT_SEL)) {
    if (el.closest(SKIP_SEL)) continue;
    if (el.querySelector(UNIT_SEL)) continue;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const inHeader = !!el.closest('.header');
    const isTitle = el.matches('.title') && inHeader;
    const isSection = el.matches('.section-title');
    const isProp = el.matches('.property-title');
    items.push({
      type: isTitle ? 'title' : isSection ? 'section' : isProp ? 'prop' : 'text',
      text: t,
      inHeader,
    });
  }

  return { items, examples };
}

/** Ghép mô hình đề thành chuỗi thuần (cho LLM tóm tắt). */
export function formatStatementText(model: StatementModel): string {
  let t = model.items
    .map((i) => (i.type === 'section' ? '## ' : '') + i.text)
    .join('\n');
  if (model.examples.length) {
    t +=
      '\n\n## Examples\n' +
      model.examples.map((e, i) => `Example ${i + 1} - Input:\n${e.input}\nOutput:\n${e.output}`).join('\n');
  }
  return t;
}

/** Dùng token ⟦n⟧ — khôi phục nội dung gốc (cho text đầy đủ trong side-by-side). */
export function restoreToString(translated: string, save: ExtractSave[]): string {
  const parts = splitTokens(translated);
  let s = '';
  const used = new Set<number>();
  for (const p of parts) {
    if (p.i !== undefined) {
      if (used.has(p.i)) continue;
      used.add(p.i);
      const it = save[p.i];
      if (!it) continue;
      const v = it.value;
      s += v instanceof Node ? (v.textContent || '') : String(v);
    } else {
      s += p.text || '';
    }
  }
  save.forEach((it, i) => {
    if (!used.has(i)) {
      const v = it.value;
      s += ' ' + (v instanceof Node ? (v.textContent || '') : String(v));
    }
  });
  return s.replace(/[ \t]{2,}/g, ' ').trim();
}

/** Ghép save list + translated text → DOM trong unit. */
export function rebuildUnit(unit: ExtractUnit, translated: string): void {
  const { el, save } = unit;
  let parts = splitTokens(translated);

  // Trường hợp LLM viết 【n】 thay vì ⟦n⟧ — thử khôi phục với hiệu suất thấp hơn
  const found = new Set(parts.filter((p) => p.i !== undefined).map((p) => p.i as number));
  if (found.size < save.length) {
    const alt = tryAlternateTokens(translated, save.length);
    if (alt) {
      const foundAlt = new Set(alt.filter((p) => p.i !== undefined).map((p) => p.i as number));
      const allOriginalFound = Array.from(found).every((i) => foundAlt.has(i));
      if (allOriginalFound && foundAlt.size > found.size) parts = alt;
    }
  }

  const frag = document.createDocumentFragment();
  const used = new Set<number>();
  for (const p of parts) {
    if (p.i !== undefined) {
      if (used.has(p.i)) continue;
      used.add(p.i);
      const item = save[p.i];
      if (!item) continue;
      if (item.kind === 'node') frag.appendChild((item.value as Node).cloneNode(true));
      else frag.appendChild(document.createTextNode(String(item.value)));
    } else if (p.text) {
      frag.appendChild(document.createTextNode(p.text.replace(/\n/g, ' ')));
    }
  }
  save.forEach((item, i) => {
    if (!used.has(i)) {
      frag.appendChild(document.createTextNode(' '));
      frag.appendChild(item.kind === 'node' ? (item.value as Node).cloneNode(true) : document.createTextNode(String(item.value)));
    }
  });
  el.replaceChildren(frag);
  el.classList.add('cf-tr-unit');
}

/** Low-level: tìm .problem-statement trong trang. */
export function findStatementRoot(): HTMLElement | null {
  return document.querySelector('.problem-statement');
}
