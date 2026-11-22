/**
 * Token bảo vệ: ⟦n⟧ (U+27E6 / U+27E7) — máy dịch không được đụng.
 * Dùng chung cho module translate-problem (port từ v1).
 */
export const OPEN = '⟦';
export const CLOSE = '⟧';
const TOKEN_RE = /⟦\s*(\d+)\s*⟧/g;
const ALT_TOKENS = /(?:〓\s*(\d+)\s*〓|【\s*(\d+)\s*】|﹝\s*(\d+)\s*﹞|\[\[\s*(\d+)\s*\]\]|\{\s*(\d+)\s*\})/g;

export function tok(i: number): string {
  return OPEN + i + CLOSE;
}

export function splitTokens(s: string): Array<{ text?: string; i?: number }> {
  const parts: Array<{ text?: string; i?: number }> = [];
  TOKEN_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(s))) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index) });
    parts.push({ i: parseInt(m[1], 10) });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ text: s.slice(last) });
  return parts;
}

/** Thử lấy token dạng thay thế (LLM đôi khi tự viết 【1】); trả về null nếu không tin cậy. */
export function tryAlternateTokens(s: string, saveLen: number): Array<{ text?: string; i?: number }> | null {
  const parts: Array<{ text?: string; i?: number }> = [];
  const found = new Set<number>();
  ALT_TOKENS.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = ALT_TOKENS.exec(s))) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index) });
    const idx = parseInt(m[1] || m[2] || m[3] || m[4] || m[5], 10);
    if (idx >= saveLen) return null;
    parts.push({ i: idx });
    found.add(idx);
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ text: s.slice(last) });
  return found.size > 0 ? parts : null;
}

export function protectMath(s: string, save: Array<{ kind: 'text' | 'node'; value: string }>): string {
  s = s.replace(/\\\$/g, () => pushText('$', save));
  s = s.replace(/\$\$\$([^$]{1,800}?)\$\$\$/g, (m) => pushText(m, save));
  s = s.replace(/\$\$([^$]{1,800}?)\$\$/g, (m) => pushText(m, save));
  const n = (s.match(/\$/g) || []).length;
  if (n >= 2 && n % 2 === 0) {
    s = s.replace(/\$([^$\n]{1,300}?)\$/g, (m) => pushText(m, save));
  }
  return s;
}

function pushText(text: string, save: Array<{ kind: 'text' | 'node'; value: string }>): string {
  const i = save.length;
  save.push({ kind: 'text', value: text });
  return tok(i);
}
