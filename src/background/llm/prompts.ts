/** Prompts cho LLM — chỉ chạy trong background. */

export const LANG_NAMES: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  ru: 'Russian',
  'zh-CN': 'Simplified Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  id: 'Indonesian',
  th: 'Thai',
  hi: 'Hindi',
  ar: 'Arabic',
  tr: 'Turkish',
  uk: 'Ukrainian',
  pl: 'Polish',
};

export function langName(code: string): string {
  return LANG_NAMES[code] || code;
}

export function glossaryVi(): string {
  return [
    'Vietnamese terminology for competitive programming (ALWAYS use these):',
    'array=mảng; string=xâu; subsequence=dãy con (các phần tử KHÔNG nhất thiết liền kề);',
    'substring=xâu con (liền kề); subarray=mảng con liền kề; permutation=hoán vị;',
    'digit=chữ số; integer=số nguyên; positive integer=số nguyên dương;',
    'graph=đồ thị; vertex=đỉnh; edge=cạnh; tree=cây; forest=rừng; cycle=chu trình;',
    'graph path=đường đi; shortest path=đường đi ngắn nhất; connected component=thành phần liên thông;',
    'prefix=tiền tố; suffix=hậu tố; sorting=sắp xếp; increasing=tăng dần;',
    'operation=thao tác; query=truy vấn; test case=bài test; sample=ví dụ;',
    'constraint=ràng buộc; input=đầu vào; output=đầu ra;',
    'Use natural, fluent Vietnamese for a programming-contest audience.',
  ].join('\n');
}

export function translatePrompt(targetLang: string, extraGlossary: string): string {
  const lines = [
    'You are a professional translator for competitive programming (Codeforces) problem statements.',
    `Task: translate each string in the JSON array given by the user into ${langName(targetLang)}.`,
    '',
    'ABSOLUTE RULES:',
    '1. Output ONLY a JSON array of translated strings — same length, same order as the input. No explanations.',
    '2. Tokens like ⟦1⟧ are PROTECTED placeholders for math formulas, code snippets or links.',
    '   Keep every token EXACTLY once, with identical digits, at the natural position in the sentence.',
    '   Never merge, split, reorder, translate or delete tokens. Never write inside a token.',
    '3. Outside tokens: keep numbers, variable names and notation unchanged.',
    '4. Do not add or remove sentences.',
    '5. The segments are paragraphs, list items and titles of ONE problem statement — translate meaning, not word by word.',
  ];
  if (targetLang === 'vi') {
    lines.push('', glossaryVi());
  }
  if (extraGlossary.trim()) {
    lines.push('', 'Additional user glossary:', extraGlossary.trim());
  }
  return lines.join('\n');
}

export function translateUserPayload(segments: string[], targetLang: string): string {
  return (
    'Translate every string in the following JSON array into ' +
    langName(targetLang) +
    '. Keep every ⟦n⟧ token exactly once, unmodified. Respond with ONLY the JSON array.\n' +
    JSON.stringify(segments)
  );
}

export function summarizePrompt(): string {
  return [
    'You summarize competitive programming (Codeforces) problem statements for students.',
    'Return ONLY a JSON object with these keys and values:',
    '{"title":"...","task":"...","input":"...","output":"...","constraints":"...","note":"..."}',
    '- title: translate the problem title.',
    '- task: state the goal — what to do and what counts as correct. Max 3 sentences. NO storytelling.',
    '- constraints: list key constraints. Keep numbers and formulas EXACTLY (e.g. 1 ≤ n ≤ 2·10^5).',
    '- input/output: brief format.',
    '- note: important note; empty string if none.',
    'Keep 100% of formulas, variables, YES/NO and identifier names. Do not invent data absent from the statement.',
    'Do NOT reveal the solution.',
  ].join('\n');
}
