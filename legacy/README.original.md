# CF Dịch Đề — Extension dịch đề Codeforces

Extension Chrome (MV3) dịch đề bài trên **codeforces.com** giữ nguyên **100% công thức Toán, code, link, ví dụ** — không bị chèn lệch vị trí.

## Cài đặt (2 phút)

1. Mở Chrome → gõ `chrome://extensions` vào thanh địa chỉ.
2. Bật **Developer mode** (Chế độ nhà phát triển) ở góc trên phải.
3. Bấm **Load unpacked** (Tải tiện ích đã giải nén) → chọn thư mục `cf-dich-de` này.
4. Vào một trang đề bài, ví dụ `https://codeforces.com/problemset/problem/4/A` → thanh nổi **🌐 Dịch đề** xuất hiện ở góc dưới phải → bấm là xong.

## Cách dùng

- **Thanh nổi trên trang:** `🌐 Dịch đề` / `🌐 Dịch lại` — `↩ Bản gốc` — xem tiến độ dịch từng đoạn.
- **Bấm icon extension (popup):** chọn engine, ngôn ngữ, nhập key, bật *tự động dịch khi mở đề*.
- Engine có 3 lựa chọn:

| Engine | Cần gì? | Khi nào dùng |
|---|---|---|
| **Google Translate** | Không cần gì | Mặc định, nhanh, đủ dùng |
| **Gemini** (khuyến nghị) | API key miễn phí [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | **Độ chuẩn cao nhất**: hiểu ngữ cảnh toàn đề, dùng đúng thuật ngữ (dãy con, hoán vị, chu trình...), giữ token chính xác |
| **OpenAI-compatible** | Key + Base URL + model | ChatGPT, DeepSeek, LM Studio... |

## Tóm tắt đề 📝 (miễn phí, không cần key)

Bấm **📝 Tóm tắt** (trên thanh nổi hoặc trong popup) để mở panel tóm tắt gồm: **Tên bài · Nhiệm vụ · Đầu vào · Đầu ra · Ràng buộc · Ví dụ · Giới hạn** — tiếng Việt, công thức/số giữ nguyên.

Chuỗi tự động, không cần cấu hình gì:
1. **AI miễn phí** (Pollinations — không cần key) → tóm tắt thông minh toàn đề.
2. Nếu dịch vụ AI free đang gián đoạn → **tóm tắt rút gọn**: tự chọn đúng câu ý chính (câu yêu cầu "Print/Determine...", câu format input, câu ràng buộc `1 ≤ ... ≤`, ví dụ, time limit) rồi dịch Google.
3. Có **key Gemini/OpenAI** (tùy chọn) → ưu tiên dùng để chất lượng cao và ổn định hơn.
- Kết quả tóm tắt cũng được cache theo từng đề.

## Tại sao không bị lệch công thức?

Trước khi dịch, extension **tách đề thành từng đoạn** và bọc mọi thứ *không được dịch* vào token `⟦n⟧`:

- `.tex-span` — công thức của Codeforces (`1 ≤ w ≤ 100`, biến `n`, `10⁹`...) — được **giữ nguyên HTML gốc**, gắn lại đúng chỗ cũ sau khi dịch.
- `<pre>` / `<code>` — code mẫu, input/output ví dụ — giữ nguyên từng ký tự.
- Link `<a>`, ảnh, `sup/sub`, từ định danh (`YES`, `NO`, biến `x`... dạng `tex-font-style-tt`) — giữ nguyên.
- Công thức kiểu cũ `$...$`, `$$$...$$$` — bọc token trước khi đưa vào máy dịch.

Máy dịch chỉ thấy văn bản thuần với token `⟦1⟧ ⟦2⟧`, sau đó extension gắn từng công thức/code **đúng vị trí token**. Nếu máy dịch làm rơi token nào, nó vẫn được gắn lại cuối đoạn (không bao giờ mất).

## Giải quyết sự cố

- **AI miễn phí chậm/lỗi:** chỉ chờ tối đa ~20 giây, sau đó tự chuyển **tóm tắt rút gọn** (Google) — và 10 phút sau sẽ đi thẳng vào chế độ rút gọn, không chờ nữa. Google cũng lỗi thì hiển thị câu tiếng Anh gốc thay vì treo.
- **Google báo rate limit (429):** đợi 1–2 phút, hoặc chuyển sang Gemini.
- **Gemini hết quota:** extension tự chuyển sang Google dự phòng.
- **Số đoạn không khớp:** bấm `🌐 Dịch lại` (dịch lại không dùng cache).
- **Dịch lâu lần đầu:** Google dịch từng đoạn ~5–15s/đề; Gemini chỉ 1–2 lô, nhanh hơn về sau nhờ cache (tự lưu theo đề + engine + ngôn ngữ).

## Hạn chế

- Chữ in đậm/nghiêng trong câu có thể mất (nội dung vẫn đầy đủ).
- Google đôi khi xê dịch nhẹ vị trí token trong câu (Gemini gần như không).

## Cấu trúc

```
cf-dich-de/
├── manifest.json   # khai báo extension MV3 (v1.1: dịch + tóm tắt)
├── content.js      # tách đề, bảo vệ công thức, ghép kết quả, panel tóm tắt
├── content.css     # thanh công cụ nổi + panel tóm tắt
├── background.js   # engine Google / Gemini / OpenAI-compatible (dịch & tóm tắt)
├── popup.html/js   # cài đặt: engine, ngôn ngữ, key, tự động dịch
└── README.md
```
