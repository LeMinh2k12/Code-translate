# CF Toolkit

Extension all-in-one cho Codeforces — hướng đến cộng đồng CP Việt Nam. Manifest V3, TypeScript, Vite, Chrome + Firefox.

> Giai đoạn 2 — khung dự án đang hoàn thành. Xem README cũ ở `legacy/` để đối chiếu với extension hiện có.

## Tính năng (theo lộ trình)

| Module | Trạng thái |
|---|---|
| Theme (Dark/Light/Auto) | khung — dùng trong Options page |
| Contest Safety | khung — banner trên trang contest |
| Translate problem + summarize | (Giai đoạn 3 — port từ legacy) |
| Filters (div/rating/tag) | khung |
| Quick submit + verdict | khung |
| Blog translate | khung |
| Code analysis (tương đồng — chỉ tham khảo) | khung |

## Cài đặt phát triển

```bash
npm install
npm run build:all     # tsc typecheck + vite build (sw + popup + options + content.js)
npm test              # vitest (tokens, settings, url-match)
npm run dev           # watch build
```

Cài đặt extension (Chrome): `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn thư mục `dist/`.

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

## Giới hạn hiện tại (giai đoạn 2)

- Modules translate/filters/submit/blog/analysis chưa chức thực hiện — chỉ là khung, bọc `init`/`destroy` an toàn.
- Test chỉ cover tokens / settings / url-match — parser + modules test ở giai đoạn sau.
- Icon là bản placeholder.

## License

Proprietary — do bạn sở hữu.
