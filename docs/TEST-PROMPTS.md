# NorthPeak Reports — Bộ prompt để test tính năng

Tài liệu này gom các prompt mẫu để test nhanh **AI email/report builder**. Prompt gõ được
bằng **tiếng Anh hoặc tiếng Việt** (model hiểu cả hai); các ví dụ tiếng Anh khớp từ khoá của
bộ fallback nên vẫn chạy khi **không có** `OPENROUTER_API_KEY`.

## Chuẩn bị

- Login: `tim@apple.dev` / `tim@apple.dev` · server `http://localhost:2020`.
- Mở một report: **Reports** (sidebar) → mở 1 record → tab **Builder**. Record page dạng
  `/object/northpeakReport/{id}`.
- Panel **✨ AI** ở bên phải là nơi gõ hầu hết các prompt bên dưới.

> **Lưu ý dữ liệu:** seed data có deal *won* rải rác **tháng 6–7/2026**, nhưng thường **rỗng
> trong 7 ngày gần nhất**. Vì vậy hãy dùng cửa sổ rộng ("last 90 days", "this quarter",
> "June–July", "monthly") để thấy số > 0. "last 7 days" ra $0 là **đúng**, không phải lỗi.

---

## 1. Tạo report từ đầu (prompt dữ liệu)

Gõ vào panel AI khi report còn trống. Kỳ vọng: AI dựng data + layout + copy, canvas hiện số thật.

| Prompt | Kỳ vọng |
| --- | --- |
| `won revenue by rep, last 90 days` | Cards + bar breakdown theo rep, có số |
| `monthly won revenue by product tier` | Nhóm theo tháng × product tier, có bảng/biểu đồ |
| `open pipeline by stage` | Pipeline theo stage (không lọc won) |
| `won revenue by region this quarter` | Nhóm theo region |
| `deals by lead source, last 90 days` | Nhóm theo kênh acquisition |
| `count of deals created in the last 30 days by rep` | Đếm (count) theo rep |
| `doanh thu thắng theo khu vực trong 90 ngày` | (tiếng Việt) — vẫn ra region breakdown |

## 2. Trợ lý AI hỏi làm rõ (grill)

Prompt mơ hồ → AI phải **hỏi lại 1 câu** trước khi làm (không tự bịa).

| Prompt | Kỳ vọng |
| --- | --- |
| `make it nicer` | Hỏi: audience / trọng tâm là gì? |
| `build me a report` | Hỏi 1 câu làm rõ đo cái gì |
| Trả lời tiếp: `for leadership, weekly won revenue and top reps` | Chuyển sang **apply**, dựng report |
| `now what?` (khi đang hỏi) | Không lặp vô hạn — tự apply theo suy đoán tốt nhất |

## 3. ⭐ Sửa khu trú 1 block (tính năng mới — merge-by-id)

**Bấm chọn 1 block trên canvas trước** (chip "Editing ◈ …" hiện ở panel AI), rồi gõ. Kỳ vọng:
**chỉ block đó đổi**, mọi block khác giữ **nguyên văn** (title, copy, số…).

| Chọn block | Prompt | Kỳ vọng |
| --- | --- | --- |
| Chart | `make this a pie chart` / `đổi chart này sang pie` | Chỉ `chartKind → pie` |
| Chart | `switch it back to a bar chart` | Chỉ chart đổi lại bar |
| Header | `rewrite this headline to be punchier` | Chỉ title/subtitle header đổi |
| Data table | `show only the top 5 rows` | Chỉ `maxRows` của bảng = 5 |
| Bar breakdown | `limit this to 8 and sort by amount` | Chỉ block bar đổi |
| Text | `make this intro shorter and friendlier` | Chỉ copy text đổi |

Không chọn block, nhưng nói rõ: `change the chart to a pie` — nếu có **nhiều** chart, AI nên
hỏi cái nào; nếu chỉ 1 chart, đổi luôn.

## 4. Đổi style / theme (áp cả email, giữ nguyên block)

| Prompt | Kỳ vọng |
| --- | --- |
| `make the whole email dark themed with a green accent` | theme `dark` + accent xanh, **mọi block giữ nguyên** |
| `use a serif font and a navy accent` | font serif + accent xanh navy |
| `switch back to light mode` | về light, block không đổi |

> Có thể so sánh với tab **Style** bên trái (accent swatch, font, light/dark, logo URL) — kết quả
> phải khớp nhau (live canvas = email gửi đi).

## 5. Sửa layout (thêm / xoá / sắp xếp)

Đây là lúc AI trả **full blocks** (không phải patch).

| Prompt | Kỳ vọng |
| --- | --- |
| `add a call-to-action button linking to our dashboard at the bottom` | Thêm block button ở cuối |
| `remove the interpretation block` | Bỏ block specEcho |
| `add a short executive summary paragraph under the title` | Thêm text block sau header |
| `move the AI narrative to the top` | Đổi thứ tự |
| `add a logo at the top and a divider after the metrics` | Thêm logo + divider |

## 6. Đổi data source (bias mềm + linh hoạt)

Data source hiện ở thanh trên cùng ("Data source ▾").

| Bối cảnh | Prompt | Kỳ vọng |
| --- | --- | --- |
| Data source = Opportunities | `won revenue by rep last 90 days` | Giữ nguyên object opportunity |
| Data source = Opportunities | `companies by industry` | **Tự chuyển** sang object company (bias không khoá) |
| Đổi picker sang **Companies** rồi hỏi | `count of companies by industry` | Bind vào company |

## 7. Templates (màn tạo report)

⌘K → **Create report from a prompt** (hoặc nút New report) → chọn template:

- **Weekly Sales Pulse**, **Rep Leaderboard**, **Pipeline Health**, **Monthly Revenue Review**,
  **Regional Performance**, **Lead-Source ROI**, **Product-Tier Breakdown**,
  **New Business This Month**, **Stuck / Aging Deals**, **Executive Summary**.
- Kỳ vọng: tạo xong nhảy vào builder với layout + theme của template, số bind theo prompt.
- Thử cả **Create from scratch** (gõ prompt tự do).

## 8. Preview / Lịch / Subscribers (tab Setup)

- **Preview & test** (thanh trên) → nạp số thật vào canvas.
- Setup → **Refresh data**, **Send now** (nếu có `BREVO_API_KEY`; không có key → skip an toàn).
- Setup → **Schedule**: đổi Frequency (Daily/Weekly/Monthly) + Send hour → **Activate**.
- Setup → **Subscribers**: thêm/bớt workspace member.

## 9. Onboarding & UX

- Mở builder **lần đầu** → hiện tour "Discover the editor" (4 bước). Bấm **?** để mở lại.
- **Chọn block** trên canvas → panel **Block** hiện editor + nút **Deselect ✕**.
- **Undo/redo** (↶ ↷) sau khi sửa block/theme.
- **Device toggle** 🖥/📱 → canvas 600px ↔ 375px.
- Cuộn canvas dài → ô nhập chat **vẫn hiển thị** (không bị đẩy mất).

## 10. Offline / degrade (tuỳ chọn)

Bỏ `OPENROUTER_API_KEY` trong Settings → app dùng **fallback planner**:

- `monthly won revenue by product tier` → vẫn ra spec hợp lệ (không grill).
- Panel AI báo đang dùng "offline planner".
- `BREVO_API_KEY` trống → **Send now** thành no-op an toàn.

---

### Checklist nhanh cho reviewer

- [ ] Prompt cửa sổ rộng ra số > 0; "last 7 days" ra $0 (đúng).
- [ ] Prompt mơ hồ → AI hỏi 1 câu, không lặp.
- [ ] Chọn chart → "đổi sang pie" → **chỉ** chart đổi, block khác nguyên văn.
- [ ] Đổi theme → mọi block giữ nguyên, chart vẫn giữ chỉnh sửa trước đó.
- [ ] Đổi data source bằng câu chữ → object chuyển đúng.
- [ ] Preview hiện số thật; Save persist; reload giữ layout + lịch sử chat.
