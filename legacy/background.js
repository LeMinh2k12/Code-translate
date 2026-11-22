'use strict';

// ======================= Tiện ích chung =======================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LANG_NAMES = {
  vi: 'Vietnamese', en: 'English', ru: 'Russian', es: 'Spanish',
  pt: 'Portuguese', fr: 'French', de: 'German', 'zh-CN': 'Simplified Chinese',
  ja: 'Japanese', ko: 'Korean', id: 'Indonesian', th: 'Thai', hi: 'Hindi',
  ar: 'Arabic', tr: 'Turkish', uk: 'Ukrainian', pl: 'Polish'
};

function langName(code) {
  return LANG_NAMES[code] || ('the requested language (code: ' + code + ')');
}

function progress(tabId, payload) {
  if (!tabId) return;
  try { chrome.tabs.sendMessage(tabId, Object.assign({ type: 'cf-progress' }, payload)); } catch (e) {}
}

// Từ điển thuật toán thi đấu → dùng khi target = vi
function glossaryVi() {
  return [
    'Vietnamese terminology for competitive programming (ALWAYS use these):',
    'array=mảng; string=xâu; subsequence=dãy con (các phần tử KHÔNG nhất thiết liền kề);',
    'substring=xâu con (liền kề); subarray=mảng con liền kề; permutation=hoán vị;',
    'digit=chữ số; integer=số nguyên; positive integer=số nguyên dương;',
    'non-negative=không âm; even=chẵn; odd=lẻ; divisible by=chia hết cho;',
    'quotient=thương; remainder=số dư; modulo=lấy phần dư (modulo); prime=số nguyên tố;',
    'divisor=ước số; multiple=bội; factorial=giai thừa; power=lũy thừa; exponent=số mũ;',
    'bit=bit; bitwise AND/OR/XOR=phép AND/OR/XOR theo bit; binary=nhị phân;',
    'graph=đồ thị; vertex=đỉnh; edge=cạnh; tree=cây; forest=rừng; cycle=chu trình;',
    'path=đường đi; shortest path=đường đi ngắn nhất; connected component=thành phần liên thông;',
    'degree=bậc; weight=trọng số; directed=có hướng; undirected=vô hướng;',
    'prefix=tiền tố; suffix=hậu tố; sorting=sắp xếp; increasing=tăng dần;',
    'decreasing=giảm dần; strictly increasing=tăng dần ngặt; swap=đổi chỗ;',
    'operation=thao tác; query=truy vấn; update=cập nhật; element=phần tử;',
    'index=chỉ số; 1-based=đánh số từ 1; test case=bài test; sample=ví dụ;',
    'example=ví dụ; note=chú thích; constraint=ràng buộc; input=đầu vào; output=đầu ra;',
    'interaction=tương tác; jury=ban giám khảo; hacking=giai đoạn hack;',
    'system test=bài test chính thức (system test); pretest=pretest (test thử);',
    'round=round (vòng đấu); contestant=thí sinh; participant=người tham gia.',
    'Use natural, fluent Vietnamese for a programming-contest audience.'
  ].join('\n');
}

function sysPrompt(cfg) {
  let p = [
    'You are a professional translator for competitive programming (Codeforces) problem statements.',
    'Task: translate each string in the JSON array given by the user into ' + langName(cfg.target) + '.',
    '',
    'ABSOLUTE RULES:',
    '1. Output ONLY a JSON array of translated strings — same length, same order as the input. No explanations, no markdown fences.',
    '2. Tokens that look like \u27E612\u27E7 (unicode brackets with a number) are PROTECTED placeholders for math formulas, code snippets or links.',
    '   Keep every token EXACTLY once in the output, with identical digits, placed at the natural position in the sentence where the hidden content belongs.',
    '   Never merge, split, reorder, translate or delete tokens. Never write anything inside a token.',
    '3. Outside tokens: keep numbers, variable names and notation unchanged.',
    '4. Do not add or remove sentences; do not add quotes around entries.',
    '5. The segments are paragraphs, list items and titles of ONE problem statement — use neighbouring segments as context. Translate meaning, not word by word.'
  ];
  if (cfg.target === 'vi') p.push('', glossaryVi());
  return p.join('\n');
}

function userPayload(segs, cfg) {
  return 'Translate every string in the following JSON array into ' + langName(cfg.target) +
    '. Remember: keep every \u27E6n\u27E7 token exactly once, unmodified. Respond with ONLY the JSON array.\n' +
    JSON.stringify(segs);
}

function parseJsonArray(txt) {
  let t = String(txt || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const a = t.indexOf('[');
  const b = t.lastIndexOf(']');
  if (a !== -1 && b > a) t = t.slice(a, b + 1);
  let v;
  try { v = JSON.parse(t); } catch (e) {
    throw new Error('Engine trả về JSON không hợp lệ — bấm "Dịch lại" hoặc đổi engine.');
  }
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw new Error('Kết quả dịch không phải mảng chuỗi hợp lệ.');
  }
  return v;
}

function parseJsonObject(txt) {
  let t = String(txt || '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) t = t.slice(a, b + 1);
  let v;
  try { v = JSON.parse(t); } catch (e) {
    throw new Error('Engine trả về JSON không hợp lệ — bấm "Tóm tắt" lại.');
  }
  if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.task !== 'string') {
    throw new Error('Kết quả tóm tắt không đúng định dạng — thử lại.');
  }
  for (const k of ['title', 'task', 'input', 'output', 'constraints', 'note']) {
    if (typeof v[k] !== 'string') v[k] = '';
  }
  return v;
}

function batch(arr, n) {
  const r = [];
  for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n));
  return r;
}

// ======================= Engine: Google (miễn phí) =======================
function chunkText(text, max) {
  if (text.length <= max) return [text];
  const out = [];
  let buf = '';
  for (const piece of text.split(/(?<=[.!?;:])\s+/)) {
    if (buf && (buf + ' ' + piece).length > max) { out.push(buf); buf = piece; }
    else buf = buf ? buf + ' ' + piece : piece;
    while (buf.length > max) { out.push(buf.slice(0, max)); buf = buf.slice(max); }
  }
  if (buf) out.push(buf);
  return out;
}

async function googleReq(q, target) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=' +
    encodeURIComponent(target) + '&q=' + encodeURIComponent(q);
  let lastErr = null;
  for (let a = 0; a < 2; a++) {
    let r;
    try {
      r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    } catch (e) { lastErr = e; await sleep(500 * (a + 1)); continue; }
    if (r.status === 429 || r.status === 503 || r.status >= 500) {
      lastErr = new Error('Google trả lỗi HTTP ' + r.status);
      await sleep(800 * (2 ** a) + Math.random() * 200);
      continue;
    }
    if (!r.ok) throw new Error('Google Translate lỗi HTTP ' + r.status);
    const j = await r.json();
    return (j[0] || []).map((x) => (x && x[0]) || '').join('');
  }
  throw new Error('Google Translate từ chối (rate limit). Đợi 1–2 phút rồi thử lại, hoặc dùng Gemini/LLM.');
}

async function googleOne(text, target) {
  const parts = [];
  for (const c of chunkText(text, 1200)) parts.push(await googleReq(c, target));
  return parts.join(' ');
}

async function translateGoogleAll(srcs, cfg, tabId) {
  const total = srcs.length;
  const results = new Array(total);
  let i = 0, done = 0;
  const worker = async () => {
    while (i < total) {
      const idx = i++;
      await sleep(60 + Math.random() * 140);
      results[idx] = await googleOne(srcs[idx], cfg.target);
      done++;
      progress(tabId, { done, total });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return results;
}

// ======================= Engine: Gemini =======================
async function geminiCall(sysText, userText, cfg) {
  const model = cfg.geminiModel || 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(cfg.geminiKey);
  const body = {
    system_instruction: { parts: [{ text: sysText }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { temperature: 0.15, responseMimeType: 'application/json' }
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (j && j.error && j.error.message) || '';
    throw new Error('Gemini HTTP ' + r.status + ': ' + msg);
  }
  const cand = j && j.candidates && j.candidates[0];
  return ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
}

async function geminiBatch(segs, cfg) {
  const txt = await geminiCall(sysPrompt(cfg), userPayload(segs, cfg), cfg);
  const arr = parseJsonArray(txt);
  if (arr.length !== segs.length) {
    throw new Error('Gemini trả về ' + arr.length + '/' + segs.length + ' đoạn — bấm "Dịch lại".');
  }
  return arr;
}

async function geminiSummarize(text, cfg) {
  const txt = await geminiCall(sumPrompt(), sumUserPayload(text), cfg);
  return parseJsonObject(txt);
}

async function translateGeminiAll(srcs, cfg, tabId) {
  if (!cfg.geminiKey) {
    throw new Error('Chưa nhập Gemini API key — bấm icon extension để nhập (key miễn phí tại aistudio.google.com/apikey).');
  }
  const batches = batch(srcs, 60);
  const out = [];
  for (let b = 0; b < batches.length; b++) {
    progress(tabId, { text: 'Gemini: đang dịch lô ' + (b + 1) + '/' + batches.length + '...' });
    out.push(...await geminiBatch(batches[b], cfg));
  }
  return out;
}

// ======================= Engine: OpenAI-compatible =======================
async function openaiCall(sysText, userText, cfg) {
  const base = String(cfg.openaiBase || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const r = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + cfg.openaiKey
    },
    body: JSON.stringify({
      model: cfg.openaiModel || 'gpt-4o-mini',
      temperature: 0.15,
      messages: [
        { role: 'system', content: sysText },
        { role: 'user', content: userText }
      ]
    }),
    signal: AbortSignal.timeout(120000)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (j && j.error && j.error.message) || '';
    throw new Error('LLM HTTP ' + r.status + ': ' + msg);
  }
  return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
}

async function openaiBatch(segs, cfg) {
  const txt = await openaiCall(sysPrompt(cfg), userPayload(segs, cfg), cfg);
  const arr = parseJsonArray(txt);
  if (arr.length !== segs.length) {
    throw new Error('LLM trả về ' + arr.length + '/' + segs.length + ' đoạn — bấm "Dịch lại".');
  }
  return arr;
}

async function openaiSummarize(text, cfg) {
  const txt = await openaiCall(sumPrompt(), sumUserPayload(text), cfg);
  return parseJsonObject(txt);
}

async function translateOpenAIAll(srcs, cfg, tabId) {
  if (!cfg.openaiKey) throw new Error('Chưa nhập API key cho engine OpenAI-compatible.');
  const batches = batch(srcs, 60);
  const out = [];
  for (let b = 0; b < batches.length; b++) {
    progress(tabId, { text: 'LLM: đang dịch lô ' + (b + 1) + '/' + batches.length + '...' });
    out.push(...await openaiBatch(batches[b], cfg));
  }
  return out;
}

// ======================= Engine: AI miễn phí (không cần key) =======================
async function pollinationsSummarize(text) {
  const r = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [
        { role: 'system', content: sumPrompt() },
        { role: 'user', content: sumUserPayload(text) }
      ],
      temperature: 0.2
    }),
    signal: AbortSignal.timeout(20000) // chậm quá 20s → bỏ, dùng tóm tắt rút gọn
  });
  if (!r.ok) throw new Error('AI miễn phí trả lỗi HTTP ' + r.status);
  const j = await r.json().catch(() => null);
  const txt = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  if (!txt) throw new Error('AI miễn phí trả về rỗng.');
  return parseJsonObject(txt);
}

// ======================= Prompt tóm tắt =======================
function sumPrompt() {
  return [
    'You summarize competitive programming (Codeforces) problem statements for Vietnamese students.',
    'Return ONLY a JSON object with these keys and Vietnamese values:',
    '{"title": "...", "task": "...", "input": "...", "output": "...", "constraints": "...", "note": "..."}',
    '- title: dịch tên bài sang tiếng Việt.',
    '- task: NÊU THẲNG MỤC TIÊU: bài yêu cầu làm gì và điều kiện nào được coi là đúng',
    '  (ví dụ: "Tìm số cách chia dưa hấu thành 2 phần đều có khối lượng chẵn; in YES nếu được, NO nếu không").',
    '  TỐI ĐA 3 câu. KHÔNG kể chuyện, KHÔNG chép nguyên văn đoạn mở đầu, KHÔNG nói "đề bài nói rằng".',
    '- input: format đầu vào ngắn gọn: có mấy dòng, mỗi dòng chứa gì (biến + ý nghĩa).',
    '- output: cần in ra gì.',
    '- constraints: liệt kê ràng buộc, GIỮ NGUYÊN số và công thức (ví dụ: 1 ≤ n ≤ 2·10^5; tổng n của mọi test ≤ 2·10^5).',
    '- note: lời hứa/giải thích quan trọng của đề; nếu không có thì chuỗi rỗng.',
    'Giữ nguyên 100% công thức, biến, ký hiệu, tên định danh (YES/NO, tên hàm...).',
    'Không bịa thêm dữ liệu không có trong đề. Ngắn gọn, rõ ràng, dễ đọc.'
  ].join('\n');
}

function sumUserPayload(text) {
  const t = String(text || '').slice(0, 16000);
  return 'Summarize the following Codeforces problem statement per the system rules. Respond with ONLY the JSON object.\n\n' + t;
}

// ======================= Điều phối =======================
const shouldFallback = (e) => /429|RESOURCE_EXHAUSTED|quota|rate|overload/i.test(String(e && e.message || e));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  const tabId = sender.tab && sender.tab.id;

  if (msg.type === 'cf-translate') {
    (async () => {
      const srcs = Array.isArray(msg.srcs) ? msg.srcs : [];
      const cfg = msg.cfg || {};
      const engine = cfg.engine || 'google';
      try {
        let out;
        if (engine === 'google') out = await translateGoogleAll(srcs, cfg, tabId);
        else if (engine === 'gemini') out = await translateGeminiAll(srcs, cfg, tabId);
        else if (engine === 'openai') out = await translateOpenAIAll(srcs, cfg, tabId);
        else throw new Error('Engine không rõ: ' + engine);
        sendResponse({ ok: true, out });
      } catch (e) {
        // LLM hết quota/lỗi → tự chuyển sang Google dự phòng
        if (engine !== 'google' && shouldFallback(e)) {
          try {
            progress(tabId, { text: 'Gemini/LLM lỗi, đang dùng Google dự phòng...' });
            const out = await translateGoogleAll(srcs, Object.assign({}, cfg, { engine: 'google' }), tabId);
            sendResponse({ ok: true, out });
            return;
          } catch (e2) { e = e2; }
        }
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'cf-summarize') {
    (async () => {
      const cfg = msg.cfg || {};
      try {
        let summary, src;
        if (cfg.engine === 'gemini') {
          if (!cfg.geminiKey) throw new Error('Chưa nhập Gemini API key (mở popup extension để nhập).');
          summary = await geminiSummarize(msg.text, cfg);
          src = 'Gemini (' + (cfg.geminiModel || 'gemini') + ')';
        } else if (cfg.engine === 'openai') {
          if (!cfg.openaiKey) throw new Error('Chưa nhập API key cho OpenAI-compatible.');
          summary = await openaiSummarize(msg.text, cfg);
          src = 'LLM (' + (cfg.openaiModel || '') + ')';
        } else if (cfg.engine === 'free') {
          summary = await pollinationsSummarize(msg.text);
          src = 'AI miễn phí (không cần key)';
        } else {
          throw new Error('Engine không hỗ trợ tóm tắt: ' + (cfg.engine || '?'));
        }
        sendResponse({ ok: true, summary, src });
      } catch (e) {
        sendResponse({ ok: false, error: String((e && e.message) || e) });
      }
    })();
    return true;
  }
});
