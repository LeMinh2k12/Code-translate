# CF Toolkit

Extension all-in-one cho Codeforces — hướng đến cộng đồng CP Việt Nam. Manifest V3, TypeScript, Vite, Chrome + Firefox.

> Giai đoạn 3 — Translate problem + summarize module đã chức thực hiện (port từ legacy).

## Tính năng (theo lộ trình)

| Module | Trạng thái |
|---|---|
| Theme (Dark/Light/Auto) | khung — dùng trong Options page |
| Contest Safety | khung — banner trên trang contest |
| Translate problem + summarize | ✅ đã chức thực hiện (Giai đoạn 3) |
| Filters (div/rating/tag) | khung |
| Quick submit + verdict | khung |
| Blog translate | khung |
| Code analysis (tương đồng — chỉ tham khảo) | khung |

## Cài đặt phát triển

```bash
npm install
npm run build:all     # tsc typecheck + vite build (sw + popup + options + content.js)
npm test              # vitest (tokens, settings, url-match, dom-extract, translate-problem)
npm run package       # build + đóng gói .zip với manifest tại root của zip
npm run dev           # watch build
```

Cài đặt extension (Chrome): `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn thư mục **`dist/`** (KHÔNG phải root repo — root chỉ chứa nguồn, manifest cũ đã được di chuyển vào `legacy/`).

Đóng gói cho Chrome Web Store / Firefox Add-ons: `npm run package` → tạo `cf-toolkit-<version>.zip` (manifest tại zip root).

### CI — đóng gói tự động

Workflow `.github/workflows/release.yml` (chạy trên GitHub Actions):
- **Run workflow thủ công** (Actions → "Build & package extension" → Run workflow) → zip được upload làm workflow artifact; người dùng bấm Download ở trang Actions.
- **Tag `v*`** (vd `v0.1.0`) → build + đóng gói + zip attach thẳng lên GitHub Release — tải zip từ trang Releases của repo.

> Lưu ý: zip tự tạo của GitHub (`Download ZIP` trên trang repo) chỉ chứa **source code** — không phải extension. Extension loadable đến từ `dist/` hoặc zip do `npm run package` / workflow sinh ra.

## Kiến trúc

```
src/
├── content/      # content script (IIFE) + modules (lazy-init theo settings)
│   └── modules/  # translate-problem, blog-translate, quick-submit, filters,
│                 # theme, code-analysis, contest-safety, loader, registry
├── background/   # service worker (ESM) — LLM service DUY NHẤT nơi chứa key
│   └── llm/      # manager (queue/rate limit/retry/backoff/cancel), cache (IndexedDB),
│                 # providers (gemini/openai-compat/anthropic/google/pollinations)
├── shared/       # settings, secrets (hybrid local/sync), tokens, shadow-dom, messaging, i18n
├── popup/        # UI popup (mở Options)
└── options/      # trang cài đặt đầy đủ (modules, theme, translate, LLM, contest safety, submit)
```

## Nguyên tắc

- **API key chỉ trong background** — content script không bao giờ thấy key (chỉ gửi task descriptor với system+user prompt).
- **Chỉ xin permission tối thiểu** (xem `public/manifest.json` + giải thích rõ trong popup/docs).
- **Không thu thập dữ liệu người dùng** — không analytics/telemetry. Cache LLM chỉ lưu kết quả + createdAt, loại bỏ theo LRU.
- **Contest safety**: LLM bị khóa mặc định trong contest (theo trang contest), override phải xác nhận rõ.
- **Quick submit**: chỉ điều khiển form chính của Codeforces, không endpoint tự chế.

## Quyền & Host permissions (xem `public/manifest.json`)

| Permission | Lý do |
|---|---|
| `storage` | chrome.storage.sync cho config, chrome.storage.local cho key (mặc định) |
| `codeforces.com` + `codeforces.ml/.es` | content script + submit form |
| `generativelanguage.googleapis.com`, `api.openai.com`, `api.anthropic.com`, `translate.googleapis.com`, `text.pollinations.ai` | provider LLM chính thức + free engines (opt-in) |
| `optional_host_permissions: ["https://*/*"]` | chỉ yêu cầu runtime cho **đúng origin người dùng tự nhập** khi cấu hình endpoint tự host (Chrome Web Store: khai rõ trong README + xin đúng origin cụ thể) |

## Giới hạn hiện tại (giai đoạn 3)

- Translate-problem module đang chạy (dịch đề theo glossary, tóm tắt bằng structured JSON, contest-safety gate). **Blog translate / Quick submit / Filters / Code-analysis** vẫn là khung.
- Test cover tokens / settings / url-match / dom-extract / translate-problem.
- Icon là bản placeholder.

## Kiến trúc — Translate module (giai đoạn 3)

```
content: findStatementRoot → collectUnits → protectMath → sendBackground
  → background: pickProvider → translatePrompt(targetLang, glossary) →
    providers (gemini/openai/anthropic/google/pollinations) → parseJsonArray →
  rebuildUnit (khôi phục nodes $math/code) → side-by-side toggle
```

- Contest-safety gate ở **content module** (đọc `contestSafety.mode` từ settings):
  - `off` → không khóa.
  - `on` → luôn khóa LLM.
  - `auto` → khóa khi `isContestPage(url)`.
  - Override được chỉ khi user bật `allowLlmOverride` và confirm 1 lần mỗi phiên — không lưu trạng thái.
- Glossary (dưới dạng text, mỗi dòng `key=value`) được gửi từ content module đến background — background không bao giờ chứa key.


## License

Proprietary — do bạn sở hữu.
