/** Parse helpers for LLM outputs (port từ v1, giữ cứng rắn). */
export function parseJsonArray(txt: string): string[] {
  let t = String(txt || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const a = t.indexOf('[');
  const b = t.lastIndexOf(']');
  if (a !== -1 && b > a) t = t.slice(a, b + 1);
  let v: unknown;
  try {
    v = JSON.parse(t);
  } catch {
    throw new Error('Engine trả về JSON không hợp lệ — bấm "Dịch lại" hoặc đổi engine.');
  }
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw new Error('Kết quả dịch không phải mảng chuỗi hợp lệ.');
  }
  return v as string[];
}

export interface SummaryCard {
  title: string;
  task: string;
  input: string;
  output: string;
  constraints: string;
  note: string;
}

export function parseJsonObject(txt: string): SummaryCard {
  let t = String(txt || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) t = t.slice(a, b + 1);
  let v: unknown;
  try {
    v = JSON.parse(t);
  } catch {
    throw new Error('Engine trả về JSON không hợp lệ — bấm "Tóm tắt" lại.');
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error('Kết quả tóm tắt không đúng định dạng — thử lại.');
  }
  const o = v as Record<string, unknown>;
  const pick = (k: string): string => (typeof o[k] === 'string' ? (o[k] as string) : '');
  return {
    title: pick('title'),
    task: pick('task'),
    input: pick('input'),
    output: pick('output'),
    constraints: pick('constraints'),
    note: pick('note'),
  };
}
