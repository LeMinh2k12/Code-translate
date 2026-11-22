'use strict';
(() => {
  if (window.__cfTrLoaded) return;
  window.__cfTrLoaded = true;

  // ======================= Cấu hình mặc định =======================
  const DEFAULTS = {
    engine: 'google',            // google | gemini | openai
    target: 'vi',
    geminiKey: '',
    geminiModel: 'gemini-2.5-flash',
    openaiBase: 'https://api.openai.com/v1',
    openaiKey: '',
    openaiModel: 'gpt-4o-mini',
    auto: false
  };

  // Token bảo vệ: ⟦n⟧ (U+27E6 / U+27E7) — máy dịch không được đụng vào
  const OPEN = '\u27E6';
  const CLOSE = '\u27E7';
  const tok = (i) => OPEN + i + CLOSE;
  const TOKEN_RE_STR = OPEN + '\\s*(\\d+)\\s*' + CLOSE;

  const UNIT_SEL = 'p, li, h1, h2, h3, h4, h5, h6, .title, .section-title, ' +
    '.property-title, .header > div, td, th, figcaption, blockquote, .cf-tr-orphan';

  const SKIP_SEL = [
    'pre', 'code', 'kbd', 'samp', 'a', 'img', 'picture', 'video', 'audio',
    'button', 'textarea', 'select', 'input', 'script', 'style', 'iframe',
    'object', 'embed', 'svg', 'noscript', 'template',
    'sup', 'sub',
    '.tex-span', '.tex-equation', '.tex-font-style-tt',
    '.input-output-copier',
    'mjx-container', '.MathJax', '[class*="MathJax"]', '.katex'
  ].join(',');

  const state = {
    running: false, sumRunning: false,
    mode: 'original',
    units: [], orig: new Map(),
    plainUnits: null, plainText: '', examples: null,
    lastCard: null
  };

  // ======================= Tiện ích =======================
  function getCfg() {
    return new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, resolve));
  }

  function getRoot() {
    return document.querySelector('.problem-statement');
  }

  function bgMessage(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(payload, (resp) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!resp || !resp.ok) return reject(new Error((resp && resp.error) || 'Lỗi không xác định'));
        resolve(resp);
      });
    });
  }

  // ======================= Trích xuất & bảo vệ (dịch) =======================
  function wrapOrphans(root) {
    root.querySelectorAll('div').forEach((div) => {
      if (div.closest(SKIP_SEL)) return;
      if (div.matches(UNIT_SEL) && !div.querySelector(UNIT_SEL)) return;
      for (const n of Array.from(div.childNodes)) {
        if (n.nodeType === Node.TEXT_NODE && n.nodeValue.trim()) {
          const span = document.createElement('span');
          span.className = 'cf-tr-orphan';
          div.replaceChild(span, n);
          span.appendChild(n);
        }
      }
    });
  }

  function pushNode(node, save) {
    const i = save.length;
    save.push({ kind: 'node', value: node });
    return tok(i);
  }

  function pushText(text, save) {
    const i = save.length;
    save.push({ kind: 'text', value: text });
    return tok(i);
  }

  function protectMath(s, save) {
    s = s.replace(/\\\$/g, () => pushText('$', save));
    s = s.replace(/\$\$\$([^$]{1,800}?)\$\$\$/g, (m) => pushText(m, save));
    s = s.replace(/\$\$([^$]{1,800}?)\$\$/g, (m) => pushText(m, save));
    const n = (s.match(/\$/g) || []).length;
    if (n >= 2 && n % 2 === 0) {
      s = s.replace(/\$([^$\n]{1,300}?)\$/g, (m) => pushText(m, save));
    }
    return s;
  }

  function buildUnitText(el, save, candSet) {
    let out = '';
    const walk = (node) => {
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === Node.TEXT_NODE) { out += c.nodeValue; continue; }
        if (c.nodeType !== Node.ELEMENT_NODE) continue;
        if (candSet.has(c)) { out += pushNode(c, save); continue; }
        if (c.matches(SKIP_SEL)) { out += pushNode(c, save); continue; }
        if (c.tagName === 'BR') { out += ' '; continue; }
        walk(c);
      }
    };
    walk(el);
    out = out.replace(/[ \t\r]*\n+[ \t\r]*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
    out = protectMath(out, save);
    return out;
  }

  function depth(el) {
    let d = 0, e = el;
    while (e) { d++; e = e.parentElement; }
    return d;
  }

  function collectUnits(root) {
    wrapOrphans(root);
    const cands = Array.from(root.querySelectorAll(UNIT_SEL));
    const candSet = new Set(cands);
    const units = [];
    for (const el of cands) {
      if (el.closest(SKIP_SEL)) continue;
      const save = [];
      const src = buildUnitText(el, save, candSet);
      const prose = src.replace(new RegExp(TOKEN_RE_STR, 'g'), '').trim();
      if (!prose) continue;
      units.push({ el, save, src });
    }
    units.sort((a, b) => depth(b.el) - depth(a.el));
    return units;
  }

  function extractAll(root) {
    state.units = collectUnits(root);
    state.units.forEach((u, i) => {
      u.idx = i;
      if (!state.orig.has(u.el)) state.orig.set(u.el, u.el.innerHTML);
    });
    ensureStatementText(root);
    return state.units;
  }

  // ======================= Mô hình đề (cho tóm tắt) =======================
  // Bóc text thuần từ đề gốc: tiêu đề, các mục, công thức giữ dạng đọc được
  function preText(node) {
    let out = '';
    for (const c of node.childNodes) {
      if (c.nodeType === Node.TEXT_NODE) out += c.nodeValue;
      else if (c.nodeType === Node.ELEMENT_NODE) {
        const tag = c.tagName.toLowerCase();
        if (tag === 'br') out += '\n';
        else if (tag === 'div') out += preText(c) + '\n';
        else out += preText(c);
      }
    }
    return out;
  }

  function extractStatementModel(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('pre, code, script, style, .input-output-copier')
      .forEach((e) => e.remove());
    clone.querySelectorAll('.sample-test').forEach((e) => e.remove());
    // sup/sub → ký hiệu ^ và _ để không dính chữ số
    clone.querySelectorAll('sup').forEach((s) => { s.textContent = '^' + s.textContent; });
    clone.querySelectorAll('sub').forEach((s) => { s.textContent = '_' + s.textContent; });
    wrapOrphans(clone);

    const items = [];
    for (const el of clone.querySelectorAll(UNIT_SEL)) {
      if (el.closest(SKIP_SEL)) continue;
      if (el.querySelector(UNIT_SEL)) continue; // chỉ lấy đơn vị lá
      const t = el.textContent.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const inHeader = !!el.closest('.header');
      const isTitle = el.matches('.title') && inHeader;
      const isSection = el.matches('.section-title');
      const isProp = el.matches('.property-title');
      items.push({
        type: isTitle ? 'title' : isSection ? 'section' : isProp ? 'prop' : 'text',
        text: t,
        inHeader
      });
    }

    // Ví dụ: giữ nguyên từng ký tự, không dịch
    const examples = [];
    const sampleRoot = clone.querySelector('.sample-tests');
    if (sampleRoot) {
      const ins = Array.from(sampleRoot.querySelectorAll('.input pre'));
      const outs = Array.from(sampleRoot.querySelectorAll('.output pre'));
      const n = Math.min(ins.length, outs.length, 2);
      for (let i = 0; i < n; i++) {
        const a = preText(ins[i]).replace(/[ \t]+/g, ' ').trim();
        const b = preText(outs[i]).replace(/[ \t]+/g, ' ').trim();
        if (a || b) examples.push({ input: a.slice(0, 300), output: b.slice(0, 300) });
      }
    }
    return { items, examples };
  }

  function ensureStatementText(root) {
    if (state.plainUnits) {
      return state.plainText;
    }
    const r = root || getRoot();
    if (!r) return '';
    const model = extractStatementModel(r);
    state.plainUnits = model.items;
    state.examples = model.examples;
    let t = state.plainUnits
      .map((i) => (i.type === 'section' ? '## ' : '') + i.text)
      .join('\n');
    if (state.examples.length) {
      t += '\n\n## Examples\n' + state.examples
        .map((e, i) => 'Example ' + (i + 1) + ' - Input:\n' + e.input + '\nOutput:\n' + e.output)
        .join('\n');
    }
    state.plainText = t;
    return t;
  }

  // ======================= Ghép kết quả dịch =======================
  function splitTokens(s) {
    const re = new RegExp(TOKEN_RE_STR, 'g');
    const parts = [];
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) parts.push({ text: s.slice(last, m.index) });
      parts.push({ i: parseInt(m[1], 10) });
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push({ text: s.slice(last) });
    return parts;
  }

  function rebuild(unit, translated) {
    const { el, save } = unit;
    let parts = splitTokens(translated);

    const found = new Set(parts.filter((p) => p.i !== undefined).map((p) => p.i));
    if (found.size < save.length) {
      const re2 = /〖\s*(\d+)\s*〗|【\s*(\d+)\s*】|﹝\s*(\d+)\s*﹞|\[\[\s*(\d+)\s*\]\]|\{\s*(\d+)\s*\}/g;
      const parts2 = [];
      const found2 = new Set();
      let last = 0, m, bad = false;
      while ((m = re2.exec(translated))) {
        if (m.index > last) parts2.push({ text: translated.slice(last, m.index) });
        const idx = parseInt(m[1] || m[2] || m[3] || m[4] || m[5], 10);
        if (idx >= save.length) { bad = true; break; }
        parts2.push({ i: idx });
        found2.add(idx);
        last = m.index + m[0].length;
      }
      if (!bad && last < translated.length) parts2.push({ text: translated.slice(last) });
      if (!bad && found2.size > found.size &&
          Array.from(found).every((i) => found2.has(i))) {
        parts = parts2;
      }
    }

    const frag = document.createDocumentFragment();
    const used = new Set();
    for (const p of parts) {
      if (p.i !== undefined) {
        if (used.has(p.i)) continue;
        used.add(p.i);
        const item = save[p.i];
        if (!item) continue;
        if (item.kind === 'node') frag.appendChild(item.value.cloneNode(true));
        else frag.appendChild(document.createTextNode(item.value));
      } else if (p.text) {
        frag.appendChild(document.createTextNode(p.text.replace(/\n/g, ' ')));
      }
    }
    save.forEach((item, i) => {
      if (!used.has(i)) {
        frag.appendChild(document.createTextNode(' '));
        frag.appendChild(item.kind === 'node'
          ? item.value.cloneNode(true)
          : document.createTextNode(item.value));
      }
    });
    el.replaceChildren(frag);
    el.classList.add('cf-tr-unit');
  }

  // Khôi phục token về chuỗi thuần (dùng cho tóm tắt dạng digest)
  function restoreToString(translated, save) {
    const parts = splitTokens(translated);
    let s = '';
    const used = new Set();
    for (const p of parts) {
      if (p.i !== undefined) {
        if (used.has(p.i)) continue;
        used.add(p.i);
        s += save[p.i] ? save[p.i].value : '';
      } else {
        s += (p.text || '');
      }
    }
    save.forEach((it, i) => { if (!used.has(i)) s += ' ' + it.value; });
    return s.replace(/[ \t]{2,}/g, ' ').trim();
  }

  // ======================= Cache =======================
  const CACHE_KEY = 'cf-tr-cache';
  const SUM_KEY = 'cf-tr-sum';
  const cacheKey = (cfg) => location.pathname + '|' + cfg.engine + '|' + cfg.target;

  async function readMap(key) {
    const o = await chrome.storage.local.get(key);
    return o[key] || {};
  }

  async function readCache(cfg, srcs) {
    try {
      const ent = (await readMap(CACHE_KEY))[cacheKey(cfg)];
      if (ent && JSON.stringify(ent.srcs) === JSON.stringify(srcs)) return ent.out;
    } catch (e) { /* bỏ qua */ }
    return null;
  }

  async function writeCache(cfg, srcs, out) {
    try {
      const map = await readMap(CACHE_KEY);
      map[cacheKey(cfg)] = { srcs, out, ts: Date.now() };
      trimMap(map);
      await chrome.storage.local.set({ [CACHE_KEY]: map });
    } catch (e) { /* bỏ qua */ }
  }

  async function readSumCache(key) {
    try {
      return (await readMap(SUM_KEY))[key] || null;
    } catch (e) { return null; }
  }

  async function writeSumCache(key, card) {
    try {
      const map = await readMap(SUM_KEY);
      map[key] = { card, ts: Date.now() };
      trimMap(map);
      await chrome.storage.local.set({ [SUM_KEY]: map });
    } catch (e) { /* bỏ qua */ }
  }

  function trimMap(map) {
    const keys = Object.keys(map);
    if (keys.length > 25) {
      keys.sort((a, b) => map[a].ts - map[b].ts);
      while (keys.length > 25) delete map[keys.shift()];
    }
  }

  // Ghi nhớ AI miễn phí đang chậm → 10 phút sau đi thẳng tóm tắt rút gọn
  const AI_DEAD_KEY = 'cf-tr-ai-dead';
  async function aiDeadRecently() {
    try {
      const o = await chrome.storage.local.get(AI_DEAD_KEY);
      const ts = o[AI_DEAD_KEY] || 0;
      return !!ts && (Date.now() - ts < 10 * 60 * 1000);
    } catch (e) { return false; }
  }
  async function markAiDead() {
    try { await chrome.storage.local.set({ [AI_DEAD_KEY]: Date.now() }); } catch (e) {}
  }
  async function markAiAlive() {
    try { await chrome.storage.local.remove(AI_DEAD_KEY); } catch (e) {}
  }

  // ======================= Dịch toàn trang =======================
  async function translatePage(force) {
    if (state.running) return { ok: false, msg: 'Đang dịch, đợi chút nhé...' };
    const root = getRoot();
    if (!root) return { ok: false, msg: 'Không thấy đề bài (.problem-statement) trên trang này.' };
    state.running = true;
    showBar();
    setGoDisabled(true);
    setStatus('Đang tách câu & bảo vệ công thức...', '');
    try {
      const cfg = await getCfg();
      if (state.mode === 'translated') restoreOriginal();

      const units = extractAll(root);
      if (!units.length) throw new Error('Không tìm thấy đoạn văn nào để dịch.');
      const srcs = units.map((u) => u.src);
      setStatus('Tách được ' + srcs.length + ' đoạn. Đang dịch (' + cfg.engine + ')...', '');

      let out = force ? null : await readCache(cfg, srcs);
      if (out) {
        setStatus('Dùng bản dịch đã lưu trong cache.', 'ok');
      } else {
        const resp = await bgMessage({ type: 'cf-translate', srcs, cfg });
        out = resp.out;
        await writeCache(cfg, srcs, out);
      }
      if (out.length !== units.length) {
        throw new Error('Số đoạn dịch trả về không khớp (' + out.length + '/' + units.length + ').');
      }

      for (const u of units) rebuild(u, out[u.idx]);
      state.mode = 'translated';
      root.classList.add('cf-tr-translated');
      updateButtons();
      setStatus('✓ Đã dịch xong. Công thức & code giữ nguyên 100%.', 'ok');
      return { ok: true, msg: 'Đã dịch xong' };
    } catch (e) {
      const m = String((e && e.message) || e);
      setStatus('✗ ' + m, 'err');
      return { ok: false, msg: m };
    } finally {
      state.running = false;
      setGoDisabled(false);
    }
  }

  function restoreOriginal() {
    for (const [el, html] of state.orig) {
      el.innerHTML = html;
      el.classList.remove('cf-tr-unit');
    }
    state.mode = 'original';
    const root = getRoot();
    if (root) root.classList.remove('cf-tr-translated');
    updateButtons();
  }

  // ======================= Tóm tắt đề =======================
  function pickSummaryEngine(cfg) {
    if (cfg.engine === 'gemini' && cfg.geminiKey) return Object.assign({ engine: 'gemini' }, cfg);
    if (cfg.engine === 'openai' && cfg.openaiKey) return Object.assign({ engine: 'openai' }, cfg);
    if (cfg.geminiKey) return Object.assign({ engine: 'gemini' }, cfg);
    if (cfg.openaiKey) return Object.assign({ engine: 'openai' }, cfg);
    return null; // không có LLM → dùng digest Google
  }

  // ---------- Tách câu & nhận diện ý chính cho tóm tắt nhanh ----------
  function splitSentences(text) {
    return String(text).replace(/\s+/g, ' ').trim()
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Câu nêu yêu cầu của bài
  const TASK_RE = /(print|determine|find out|your task|you (?:have|need|must|are|should) (?:to|helped?|supposed)|compute|check (?:whether|if)|report|output (?:the|a|an|whether)|whether it is|if it is possible|is it possible|what (?:is|are) (?:the )?(?:minimum|maximum|smallest|largest)|\bminimum\b|\bmaximum\b)/i;
  // Câu mô tả format input
  const INPUT_RE = /(the first|the next|the only|each of the next|each test|the input|contains )/i;
  // Câu chứa ràng buộc
  const CONSTRAINT_RE = /(≤|<=|10\^|at most|no more than|does not exceed|not exceed|it is guaranteed|guaranteed that|the sum of|total (?:length|number)|\bpositive\b|non-negative|\bdistinct\b)/i;

  // Giới hạn thời gian/bộ nhớ từ phần header
  function parseHeaderLimits(items) {
    const parts = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.inHeader || it.type !== 'prop') continue;
      const val = (items[i + 1] && items[i + 1].type === 'text' && items[i + 1].inHeader)
        ? items[i + 1].text : '';
      if (!val) continue;
      if (/time limit/i.test(it.text)) {
        parts.push('⏱ ' + val.replace(/seconds?/i, 'giây'));
      } else if (/memory limit/i.test(it.text)) {
        parts.push('💾 ' + val.replace(/megabytes?/i, 'MB').replace(/bytes?/i, 'B'));
      }
    }
    return parts.join(' · ');
  }

  // Chọn ĐÚNG câu ý chính (không dịch nguyên đoạn kể chuyện)
  function buildDigest(items) {
    const title = (items.find((i) => i.type === 'title') || {}).text || '';
    const limits = parseHeaderLimits(items);

    const legend = [];          // câu văn phần đề
    const secs = {};            // tên mục -> mảng câu
    let sec = '';
    for (const it of items) {
      if (it.type === 'section') { sec = it.text; continue; }
      if (it.type !== 'text') continue;
      if (it.inHeader) continue; // "1 second", "stdin"... đã xử lý riêng
      if (!sec) { legend.push(it.text); continue; }
      (secs[sec] = secs[sec] || []).push(it.text);
    }
    const legendSent = [];
    for (const t of legend) legendSent.push(...splitSentences(t));
    const secSent = {};
    for (const k of Object.keys(secs)) {
      secSent[k] = [];
      for (const t of secs[k]) secSent[k].push(...splitSentences(t));
    }
    const pickSec = (re) => Object.keys(secSent).find((k) => re.test(k));
    const secIn = pickSec(/input/i);
    const secOut = pickSec(/output/i);
    const secNote = pickSec(/note/i);
    const secInter = pickSec(/interaction/i);
    const outSent = secOut ? secSent[secOut] : [];

    // 1) Nhiệm vụ: các câu có "Print/Determine/You should..." (ưu tiên câu cuối)
    let task = legendSent.filter((s) => TASK_RE.test(s)).slice(0, 3);
    if (!task.length && legendSent.length) task = legendSent.slice(-2);
    if (outSent.length && /print|output/i.test(outSent[0]) && !task.includes(outSent[0])) {
      task.push(outSent[0]);
    }

    // 2) Đầu vào: câu mô tả format
    let input = [];
    if (secIn) {
      input = secSent[secIn].filter((s) => INPUT_RE.test(s)).slice(0, 3);
      if (!input.length) input = secSent[secIn].slice(0, 2);
    }
    if (secInter && input.length < 3) {
      input = input.concat(secSent[secInter].slice(0, 1));
    }

    // 3) Đầu ra
    const output = outSent.slice(0, 2);

    // 4) Ràng buộc: quét mọi câu tìm "1 ≤ ... ≤", "guaranteed", "at most"...
    const seen = new Set();
    const constraints = [];
    const allSent = legendSent.concat([].concat(...Object.values(secSent)));
    for (const s of allSent) {
      if (constraints.length >= 4) break;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      if (CONSTRAINT_RE.test(s)) { seen.add(key); constraints.push(s); }
    }

    // 5) Lưu ý
    const note = secNote ? secSent[secNote].slice(0, 2) : [];

    const cap = (arr, n) => arr.join(' ').slice(0, n).trim();
    const blocks = [];
    if (title) blocks.push({ label: 'Tên bài', text: title });
    if (task.length) blocks.push({ label: 'Nhiệm vụ', text: cap(task, 500) });
    if (input.length) blocks.push({ label: 'Đầu vào', text: cap(input, 400) });
    if (output.length) blocks.push({ label: 'Đầu ra', text: cap(output, 300) });
    if (constraints.length) blocks.push({ label: 'Ràng buộc', text: cap(constraints, 400) });
    if (note.length) blocks.push({ label: 'Lưu ý', text: cap(note, 300) });
    if (state.examples && state.examples.length) {
      const e = state.examples[0];
      blocks.push({ label: 'Ví dụ', noTranslate: true, text: 'Input:\n' + e.input + '\nOutput:\n' + e.output });
      const e2 = state.examples[1];
      if (e2) blocks.push({ label: 'Ví dụ 2', noTranslate: true, text: 'Input:\n' + e2.input + '\nOutput:\n' + e2.output });
    }
    if (limits) blocks.push({ label: 'Giới hạn', noTranslate: true, text: limits });
    return blocks;
  }

  async function digestSummary(cfg) {
    ensureStatementText();
    const blocks = buildDigest(state.plainUnits || []);
    if (!blocks.length) throw new Error('Không trích được nội dung đề để tóm tắt.');
    // Bảo vệ công thức $...$ rồi dịch qua Google (bỏ qua block không cần dịch)
    const saves = blocks.map(() => []);
    const srcs = blocks.map((b, i) => b.noTranslate ? b.text : protectMath(b.text, saves[i]));
    try {
      const resp = await bgMessage({ type: 'cf-translate', srcs, cfg: Object.assign({}, cfg, { engine: 'google' }) });
      const out = resp.out;
      const result = blocks.map((b, i) => ({
        label: b.label,
        text: b.noTranslate ? b.text : (restoreToString(out[i] || '', saves[i]) || b.text)
      }));
      return { kind: 'digest', blocks: result, src: 'Google Translate (tóm tắt rút gọn)' };
    } catch (e) {
      // Dịch lỗi → vẫn hiện tóm tắt, giữ câu tiếng Anh gốc thay vì treo
      const result = blocks.map((b) => ({ label: b.label, text: b.text }));
      return { kind: 'digest', blocks: result, src: 'Nội dung gốc (dịch máy tạm lỗi)' };
    }
  }

  function llmCard(resp) {
    const s = resp.summary || {};
    const blocks = [];
    if (s.title) blocks.push({ label: 'Tên bài', text: s.title });
    if (s.task) blocks.push({ label: 'Nhiệm vụ', text: s.task });
    if (s.input) blocks.push({ label: 'Đầu vào', text: s.input });
    if (s.output) blocks.push({ label: 'Đầu ra', text: s.output });
    if (s.constraints) blocks.push({ label: 'Ràng buộc', text: s.constraints });
    if (s.note) blocks.push({ label: 'Lưu ý', text: s.note });
    return { kind: 'llm', blocks, src: resp.src || 'LLM' };
  }

  async function summarize() {
    if (state.sumRunning) return { ok: false, msg: 'Đang tóm tắt...' };
    const root = getRoot();
    if (!root) return { ok: false, msg: 'Không thấy đề bài (.problem-statement) trên trang này.' };
    state.sumRunning = true;
    showBar();
    setSumDisabled(true);
    setStatus('Đang tóm tắt đề...', '');
    try {
      const cfg = await getCfg();
      ensureStatementText(root);
      const llm = pickSummaryEngine(cfg);
      const sumKey = location.pathname + '|sum|' + (llm ? llm.engine + '|' + (llm.geminiModel || llm.openaiModel || '') : 'digest');
      const cached = await readSumCache(sumKey);
      if (cached) {
        state.lastCard = cached;
        renderSummary(cached);
        setStatus('Tóm tắt (đã lưu trong cache).', 'ok');
        return { ok: true, msg: 'Đã tóm tắt' };
      }
      let card;
      const tryLLM = async (engineCfg, label) => {
        setStatus('Đang tóm tắt bằng ' + label + '...', '');
        const resp = await bgMessage({ type: 'cf-summarize', text: state.plainText, cfg: engineCfg });
        return llmCard(resp);
      };
      if (llm) {
        try {
          card = await tryLLM(llm, llm.engine === 'gemini' ? 'Gemini' : 'LLM');
        } catch (e) {
          try {
            card = await tryLLM({ engine: 'free' }, 'AI miễn phí (tối đa ~20 giây)');
          } catch (e2) {
            setStatus('AI lỗi/chậm → tóm tắt rút gọn (Google)...', '');
            card = await digestSummary(cfg);
          }
        }
      } else {
        if (await aiDeadRecently()) {
          setStatus('AI miễn phí đang chậm → tóm tắt rút gọn (Google)...', '');
          card = await digestSummary(cfg);
        } else {
          try {
            card = await tryLLM({ engine: 'free' }, 'AI miễn phí, không cần key (tối đa ~20 giây)');
            markAiAlive();
          } catch (e) {
            markAiDead();
            setStatus('AI miễn phí chậm/lỗi → tóm tắt rút gọn (Google)...', '');
            card = await digestSummary(cfg);
          }
        }
      }
      await writeSumCache(sumKey, card);
      state.lastCard = card;
      renderSummary(card);
      setStatus('✓ Đã tóm tắt xong.', 'ok');
      return { ok: true, msg: 'Đã tóm tắt xong' };
    } catch (e) {
      const m = String((e && e.message) || e);
      setStatus('✗ ' + m, 'err');
      return { ok: false, msg: m };
    } finally {
      state.sumRunning = false;
      setSumDisabled(false);
    }
  }

  // ======================= Panel tóm tắt =======================
  let panel, panelBody, panelSrc;

  function buildPanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'cf-sum-panel';

    const head = document.createElement('div');
    head.id = 'cf-sum-head';
    const t = document.createElement('span');
    t.textContent = '📝 Tóm tắt đề';
    const close = document.createElement('button');
    close.id = 'cf-sum-close';
    close.textContent = '✕';
    close.addEventListener('click', () => { panel.style.display = 'none'; });
    head.append(t, close);

    panelBody = document.createElement('div');
    panelBody.id = 'cf-sum-body';

    panelSrc = document.createElement('div');
    panelSrc.id = 'cf-sum-src';

    panel.append(head, panelBody, panelSrc);
    (document.body || document.documentElement).appendChild(panel);
  }

  function renderSummary(card) {
    buildPanel();
    panelBody.textContent = '';
    for (const b of (card.blocks || [])) {
      const h = document.createElement('div');
      h.className = 'cf-sum-label';
      h.textContent = b.label;
      const p = document.createElement('div');
      p.className = 'cf-sum-text';
      p.textContent = b.text;
      panelBody.append(h, p);
    }
    panelSrc.textContent = 'Nguồn: ' + (card.src || '') +
      (card.kind === 'digest' ? ' — nhập Gemini key để có tóm tắt thông minh hơn' : ' · có thể sai sót, đọc đề gốc khi cần');
    panel.style.display = 'block';
  }

  function toggleSummary() {
    buildPanel();
    if (panel.style.display === 'block') {
      panel.style.display = 'none';
      return { ok: true, msg: 'Đã ẩn panel' };
    }
    if (state.lastCard) {
      renderSummary(state.lastCard);
      return { ok: true, msg: 'Đã hiện tóm tắt' };
    }
    return summarize();
  }

  // ======================= Thanh công cụ nổi =======================
  let bar, goBtn, origBtn, sumBtn, statusEl;

  function buildBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.id = 'cf-tr-bar';

    goBtn = document.createElement('button');
    goBtn.id = 'cf-tr-go';
    goBtn.textContent = '🌐 Dịch đề';

    origBtn = document.createElement('button');
    origBtn.id = 'cf-tr-orig';
    origBtn.textContent = '↩ Bản gốc';
    origBtn.hidden = true;

    sumBtn = document.createElement('button');
    sumBtn.id = 'cf-tr-sum';
    sumBtn.textContent = '📝 Tóm tắt';

    statusEl = document.createElement('span');
    statusEl.id = 'cf-tr-status';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'cf-tr-close';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Ẩn thanh này (phiên này)';

    goBtn.addEventListener('click', () => translatePage(state.mode === 'translated'));
    origBtn.addEventListener('click', () => {
      restoreOriginal();
      setStatus('Đã chuyển về bản gốc.', '');
    });
    sumBtn.addEventListener('click', () => toggleSummary());
    closeBtn.addEventListener('click', () => {
      bar.style.display = 'none';
      try { sessionStorage.setItem('cf-tr-hide', '1'); } catch (e) {}
    });

    bar.append(goBtn, origBtn, sumBtn, statusEl, closeBtn);
    (document.body || document.documentElement).appendChild(bar);
    try { if (sessionStorage.getItem('cf-tr-hide') === '1') bar.style.display = 'none'; } catch (e) {}
  }

  function showBar() {
    buildBar();
    bar.style.display = 'flex';
  }

  function setStatus(text, cls) {
    buildBar();
    statusEl.textContent = text;
    statusEl.className = cls || '';
  }

  function setGoDisabled(d) { if (goBtn) goBtn.disabled = d; }
  function setSumDisabled(d) { if (sumBtn) sumBtn.disabled = d; }

  function updateButtons() {
    if (!origBtn) return;
    origBtn.hidden = state.mode !== 'translated';
    goBtn.textContent = state.mode === 'translated' ? '🌐 Dịch lại' : '🌐 Dịch đề';
  }

  // ======================= Nhận tin từ popup / background =======================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'cf-do-translate') {
      translatePage(!!msg.force).then(sendResponse);
      return true;
    }
    if (msg.type === 'cf-show-original') {
      if (state.mode === 'translated') {
        restoreOriginal();
        setStatus('Đã chuyển về bản gốc.', '');
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'cf-do-summarize') {
      toggleSummary().then(sendResponse);
      return true;
    }
    if (msg.type === 'cf-progress') {
      setStatus(msg.text || ('Đang dịch ' + (msg.done || 0) + '/' + (msg.total || '…') + '...'), '');
    }
  });

  // ======================= Khởi động =======================
  function init() {
    if (!getRoot()) return;
    buildBar();
    getCfg().then((cfg) => {
      if (cfg.auto) setTimeout(() => translatePage(false), 700);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
