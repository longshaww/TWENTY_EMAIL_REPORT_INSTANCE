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
| `which channels drive the most won revenue? last 90 days` | Nhóm theo `leadSource`, lọc won (marketing → field thật) |
| `how's our funnel looking?` | `count` theo `stage` (thấy tỷ trọng từng bước) |
| `average deal size by product tier` | `avg` của amount theo `productTier` |
| `doanh thu thắng theo khu vực trong 90 ngày` | (tiếng Việt) — vẫn ra region breakdown |

> Xem thêm **mục 12** cho các prompt marketing (kênh/funnel/conversion) và cách AI **nói thật** khi
> hỏi chỉ số CRM không có (email opens, ad spend, CTR, CAC).

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

## 11. ⭐ Scope per recipient (mỗi người chỉ thấy dữ liệu của mình)

Report có thể **cá nhân hoá theo người nhận**: mỗi recipient chỉ thấy các bản ghi *của họ*.
AI planner tự bật khi prompt yêu cầu "của riêng từng người", rồi lọc theo một **field quan hệ tới
workspace member**. Các field scope được:

| Data source | Field scope |
| --- | --- |
| Opportunities | `owner` |
| Companies | `accountOwner` |

> **Chuẩn bị dữ liệu:** owner/accountOwner phải được **rải trên ≥ 2 member** thì mỗi người mới ra số
> khác nhau (chạy seed với ≥2 reps). Nếu tất cả record thuộc 1 người, mọi recipient scoped sẽ thấy
> giống nhau — không phải lỗi.

**Bật scope — Opportunities theo `owner`** (data source = Opportunities):

| Prompt | Kỳ vọng |
| --- | --- |
| `pipeline by stage — but send each rep only their own deals` | AI bật `scopePerRecipient`, chọn `owner`, xác nhận trong message |
| `monthly deals summary, personalized per person so each owner sees only the opportunities they own` | Scope ON theo `owner` |
| `won deals this quarter by product tier, scoped per recipient` | Scope ON, vẫn nhóm theo tier |
| `gửi mỗi rep chỉ deal của riêng họ` | (tiếng Việt) — vẫn bật scope theo `owner` |

**Bật scope — Companies theo `accountOwner`** (data source = Companies):

| Prompt | Kỳ vọng |
| --- | --- |
| `active accounts by region, but each account owner only sees their own accounts` | Scope ON theo `accountOwner` |

**Test tính trung thực (object KHÔNG scope được):** đổi data source sang object không có field
member (vd People):

| Prompt | Kỳ vọng |
| --- | --- |
| `send each recipient only their own contacts` | AI **không bịa** — nói rõ object này không tách theo người nhận được (mọi người sẽ thấy số giống nhau) và hỏi lại trước khi làm |

**Tắt scope lại:**

| Prompt | Kỳ vọng |
| --- | --- |
| `turn off the per-person scoping — send everyone the same full numbers` | `scopePerRecipient = false`, mọi recipient thấy full |

**Cách xác minh:**

1. Dựng report bật scope (Opportunities). Builder xác nhận scope ON qua `owner`.
2. Setup → **Subscribers**: thêm ≥ 2 member, đặt mode **"chỉ của họ" (SELF)** cho từng người.
3. **Preview / Send** → mỗi người ra **số khác nhau** (deal count / pipeline) = đúng, vì mỗi người chỉ
   thấy row `owner is <chính họ>`.
4. Đặt 1 subscriber sang mode **"tất cả" (ALL)** → người đó thấy full số của workspace (không lọc).

## 12. ⭐ Câu hỏi marketing & trung thực dữ liệu (map-to-proxy + nói thật)

App phục vụ **cả marketing lẫn sales team**. LLM đã được dạy dịch từ vựng marketing sang các
**field CRM có thật**, và **không bịa** chỉ số không tồn tại trong dữ liệu.

> **Cần `OPENROUTER_API_KEY`:** phần "nói thật / đề xuất proxy" nằm ở narrative/answer do LLM sinh.
> Fallback planner offline chỉ dựng spec, không giải thích.

**Từ vựng marketing → field thật** (data source = Opportunities, cửa sổ rộng để có số > 0):

| Prompt | Kỳ vọng (bind vào field thật) |
| --- | --- |
| `which channels drive the most revenue?` | `sum amount` where stage = CUSTOMER, groupBy `leadSource` |
| `funnel breakdown by stage` | `count` groupBy `stage` |
| `what's our win / conversion rate by stage?` | `count` groupBy `stage` — **KHÔNG** có metric "rate"; narrative mô tả tỷ trọng thắng/mở |
| `demand gen: new pipeline created this quarter by source` | `count`, timeWindow `createdAt`, groupBy `leadSource` |
| `average contract value (ACV) by product tier` | `avg amount` groupBy `productTier` |
| `revenue by industry segment` | Tự chuyển object **company**, groupBy `industry` |
| `hiệu quả từng kênh acquisition` | (tiếng Việt) — vẫn groupBy `leadSource` |

**Chỉ số KHÔNG có trong datasource → AI nói thật, không bịa field:**

| Prompt | Kỳ vọng |
| --- | --- |
| `how many email opens last week?` | AI **không tạo field giả** — dựng spec gần nhất và narrative/answer **nói rõ** CRM này không track email opens |
| `what's our cost per lead / CAC by channel?` | Nói rõ ad spend/CAC không có trong dữ liệu; đề xuất **proxy** (vd won revenue theo `leadSource`) |
| `show CTR by campaign` | Không có campaign/CTR — nói thật, không bịa object/field |
| `impressions and clicks by channel` | Nói rõ không track; nếu người dùng muốn, map về `leadSource` mix và **ghi rõ đây là proxy** |

> Điểm mấu chốt: khi có proxy hợp lý → trả lời bằng proxy **và nói rõ đã thay thế**; khi không có →
> nói thẳng "không track" và gợi ý cái đo được. Tuyệt đối **không** ra một con số/field bịa.

---

### Checklist nhanh cho reviewer

- [ ] Prompt cửa sổ rộng ra số > 0; "last 7 days" ra $0 (đúng).
- [ ] Prompt mơ hồ → AI hỏi 1 câu, không lặp.
- [ ] Chọn chart → "đổi sang pie" → **chỉ** chart đổi, block khác nguyên văn.
- [ ] Đổi theme → mọi block giữ nguyên, chart vẫn giữ chỉnh sửa trước đó.
- [ ] Đổi data source bằng câu chữ → object chuyển đúng.
- [ ] Preview hiện số thật; Save persist; reload giữ layout + lịch sử chat.
- [ ] Scope per recipient: prompt "each rep only their own deals" → bật scope theo `owner`; 2 subscriber SELF ra số khác nhau; object không scope được → AI nói thật, không bịa.
- [ ] Marketing: "channels/funnel/conversion" map về field thật (`leadSource`/`stage`); "win/conversion rate" → count theo stage (không có metric rate); chỉ số không có (email opens, CAC, CTR) → AI nói thật + đề xuất proxy, không bịa field.
