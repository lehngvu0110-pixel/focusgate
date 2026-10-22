# FocusGate — Bộ nhận diện thương hiệu

Tài liệu này mô tả ngôn ngữ thiết kế đang dùng trong app, landing page và ảnh quảng bá.
Mọi giá trị ở đây đã có sẵn trong mã nguồn — đừng chế thêm màu mới ngoài bảng này.

---

## 1. Ý tưởng

**Ổ khoá, không phải chuông báo.** Các app nhắc việc khác nói *"bạn nên làm đi"*. FocusGate thì khoá cửa lại.
Mọi lựa chọn hình ảnh đều phục vụ một cảm giác: **một công cụ nghiêm túc, tự tin, không mè nheo.**

Nền tối gần đen, viền mảnh phát sáng, chữ tracking chặt, số dạng mono — đây là ngôn ngữ của các công cụ kỹ thuật
(Linear, Vercel, Raycast). Nó nói với người xem rằng phần mềm này được viết cẩn thận, chứ không phải một app to-do nữa.

**Đỏ là trạng thái khoá. Tím-cyan là thương hiệu. Xanh lá là đã xong.** Ba màu, ba nghĩa, không dùng lẫn.

---

## 2. Logo

| Tệp | Dùng khi nào |
|---|---|
| `brand/logo.svg` | Mặc định. Nền tối hoặc sáng đều được (khối gradient tự tách khỏi nền). |
| `brand/logo-mono-white.svg` | Một màu. Đổi `fill="#FFFFFF"` thành màu bạn cần khi in hoặc dập nổi. |
| `brand/icon-{16…1024}.png` | Favicon, icon app, ảnh đại diện. |

**Khoảng trống tối thiểu** quanh logo bằng **1/4 chiều cao logo**. Đừng để chữ hay viền lấn vào.

**Kích thước nhỏ nhất**: 16px cho logo màu, 20px cho bản một màu (lỗ khoá bắt đầu bít lại dưới mức đó).

**Không làm**: xoay, đổ bóng thêm, đổi màu gradient, kéo méo tỉ lệ, đặt trên ảnh nhiều chi tiết,
viền ngoài, hay tách riêng hình ổ khoá khỏi khối nền.

**Wordmark** viết liền, hoa hai chữ đầu: **FocusGate**. Không phải "Focus Gate", không phải "focusgate".
Chữ đậm 700–800, tracking `-0.03em` đến `-0.045em` tuỳ cỡ.

---

## 3. Màu

### Thương hiệu

| Token | Hex | Dùng cho |
|---|---|---|
| `--accent` | `#6E5BFF` | Màu chính. Nút, công tắc bật, đường viền đang chọn, cột biểu đồ. |
| `--accent-hi` | `#8B7BFF` | Trạng thái hover, viền sáng. |
| `--accent-2` | `#22D3EE` | Chỉ dùng làm **điểm cuối gradient**, không dùng làm màu nền/chữ độc lập. |
| `--accent-text` | `#ADA0FF` | Chữ màu thương hiệu trên nền tối (đủ tương phản để đọc). |

Gradient chính `--grad`: `linear-gradient(135deg, #6E5BFF 0%, #7D6BFF 42%, #22D3EE 140%)` — logo, công tắc, thanh tiến trình.
Gradient nút `--grad-btn`: `linear-gradient(180deg, #8072FF, #6353F2)` — **nút bấm dùng riêng gradient này**, vì ở kích thước nhỏ gradient chính trôi sang cyan trông nhợt.

### Trạng thái — không bao giờ dùng thay màu thương hiệu

| Token | Hex (tối) | Hex (sáng) | Nghĩa |
|---|---|---|---|
| `--danger` | `#FF5A60` | `#DC2F36` | Cổng đang khoá, việc bắt buộc, hành động huỷ hoại. |
| `--success` | `#2DD4A7` | `#0E9E7A` | Đã xong, cổng mở. |
| `--warn` | `#FFB020` | `#B0700A` | Quá hạn, cửa sổ mở tạm. |

### Nền & chữ (chủ đề tối — mặc định)

```
--bg        #08080C    nền trang
--surface   #101017    thẻ, ô nhập
--surface-2 #16161F    thẻ nổi hơn, nút phụ
--surface-3 #1E1E29    tab đang chọn, thanh cuộn
--border    rgba(255,255,255,.07)   viền hairline
--text      #F2F2F6    chữ chính
--text-2    #A5A5B8    chữ phụ
--muted     #6C6C80    nhãn, chú thích
--faint     #4A4A5C    chữ mờ nhất
```

Chủ đề sáng có bộ token tương ứng trong `packages/extension/src/styles.css` dưới `:root[data-theme="light"]`.
**Tối là mặc định** — app không tự đổi theo hệ điều hành, người dùng phải tự chọn trong Cài đặt.

### Màu dữ liệu (biểu đồ)

Biểu đồ chỉ có **một chuỗi dữ liệu → một hue**: `#6E5BFF` trên nền tối, `#5B4FD6` trên nền sáng.
Cả hai đã được kiểm định: nằm trong dải sáng cho phép, đạt sàn chroma, tương phản ≥ 3:1 với nền.
Cột không có dữ liệu dùng `--chart-zero` (xám mờ), không tô màu thương hiệu.
Không dùng chú giải khi chỉ có một chuỗi — tiêu đề đã gọi tên nó rồi.

---

## 4. Chữ

| Vai trò | Font | Thiết lập |
|---|---|---|
| Tiêu đề, giao diện | **Be Vietnam Pro** (landing page) · system-ui / SF Pro (trong app) | 640–800, tracking `-0.02em` → `-0.05em` (cỡ càng lớn tracking càng chặt) |
| Số, thời gian, URL, phiên bản | **JetBrains Mono** / SF Mono | `font-variant-numeric: tabular-nums`, tracking `-0.02em` |
| Nhãn nhỏ (`.eyebrow`) | Font sans, **in hoa**, tracking `+0.13em`, weight 640 | |

**Quy tắc bắt buộc với tiếng Việt:**

1. **`line-height` tối thiểu 1.14 cho tiêu đề lớn, 1.18 cho tiêu đề 2 dòng trở lên.** Dấu chồng (ổ, ẵ, ữ, ế)
   cao hơn chữ hoa Latin; để 1.0–1.1 là dấu đâm vào dòng trên. Đây là lỗi hay gặp nhất khi bê nguyên
   thiết kế tiếng Anh sang.
2. **Không đặt chữ tiếng Việt bằng font mono.** Nhiều font mono thiếu glyph dấu chồng, trình duyệt sẽ tách
   dấu thành ký tự rời — "VẤN ĐỀ" hiện thành "VÂN ĐỀ`". Mono chỉ dùng cho số, giờ, URL, mã phiên bản.
3. Tracking âm mạnh (`-0.045em`) chỉ dùng từ cỡ 30px trở lên. Chữ nhỏ mà bóp chặt sẽ dính dấu.

---

## 5. Thành phần đặc trưng

- **Ổ khoá phát sáng** — khối bo 20–23px, nền `--surface-2`, viền màu trạng thái, quầng sáng
  `box-shadow: 0 0 44px -12px <màu trạng thái>`, kèm vòng nhịp thở (`@keyframes ring`, 3.4s).
  Đỏ khi khoá, xanh lá khi mở. Đây là hình ảnh nhận diện mạnh nhất của sản phẩm — dùng nó trong mọi ảnh quảng bá.
- **Vạch gradient bên trái thẻ việc bắt buộc** — rộng 2.5px, gradient dọc từ `--danger` xuống trong suốt, có glow.
- **Viền hairline + highlight trên** — mọi thẻ đều có `inset 0 1px 0 rgba(255,255,255,.045)`. Chi tiết nhỏ này
  là thứ tạo cảm giác "vật liệu" thay vì "hình chữ nhật phẳng".
- **Aurora nền** — hai vệt radial tím/cyan ở mép trên, `filter: blur(34px)`. Luôn ở mép, không bao giờ ở giữa.
- **Hạt nhiễu** — SVG feTurbulence, opacity `.32`, `mix-blend-mode: overlay`. Khử dải màu ở vùng gradient.

---

## 6. Giọng văn

- **Nói thẳng, không hứa hão.** "Cổng chỉ mở khi việc xong" — không phải "Nâng tầm năng suất của bạn".
- **Thừa nhận giới hạn.** Mục "Nói thật về giới hạn" là điểm mạnh, không phải điểm yếu. Người đọc tin bạn hơn.
- **Xưng hô: "bạn".** Không "quý khách", không "người dùng".
- **Không emoji trong giao diện**, trừ 🔥 cho chuỗi ngày (đã thành quy ước chung).
- **Câu ngắn. Động từ chủ động.** Nút ghi đúng việc nó làm: "Thêm việc", rồi toast báo "Đã thêm việc".

---

## 7. Bộ tài sản quảng bá

Nằm trong `dist/social/` — tất cả xuất ở **@2x**, PNG.

| Tệp | Kích thước | Dùng ở đâu |
|---|---|---|
| `og-1200x630.png` | 1200×630 | Ảnh xem trước khi dán link (Facebook, LinkedIn, X, Zalo) |
| `post-1080x1080.png` | 1080×1080 | Bài đăng vuông Instagram / Facebook |
| `story-1080x1920.png` | 1080×1920 | Story, Reels cover |
| `cover-1500x500.png` | 1500×500 | Ảnh bìa X / LinkedIn |
| `carousel-1-van-de.png` | 1080×1080 | Carousel slide 1 — vấn đề |
| `carousel-2-cach-lam.png` | 1080×1080 | Carousel slide 2 — cách làm |
| `carousel-3-bang-chung.png` | 1080×1080 | Carousel slide 3 — bằng chứng |
| `mockup-trang-chan.png` | 1600×1000 | Ảnh sản phẩm đóng khung trình duyệt |
| `mockup-bang-dieu-khien.png` | 1600×1000 | Bảng điều khiển đóng khung |
| `mockup-man-hinh-khoa.png` | 1600×1000 | Màn hình khoá trong khung cửa sổ macOS |

**Sửa nội dung**: mở `social/card.html`, đổi chữ, rồi chạy `npm run social` để xuất lại toàn bộ.
Chạy trên máy Mac của bạn sẽ đẹp hơn vì có sẵn SF Pro / Be Vietnam Pro.

**Chụp lại ảnh giao diện**: `node tests/e2e/shots.mjs` (extension) và
`xvfb-run -a node tests/e2e/shots-desktop.mjs` (app desktop) — trên macOS bỏ `xvfb-run`.

---

## 8. Danh sách kiểm tra trước khi đăng

- [ ] Dấu tiếng Việt không đâm vào dòng trên (kiểm tra ổ, ẵ, ữ, ế, ộ).
- [ ] Không có chữ tiếng Việt nào đặt bằng font mono.
- [ ] Logo có đủ khoảng trống, không bị cắt mép.
- [ ] Ảnh chụp là giao diện thật, không phải bản dựng tay.
- [ ] Số liệu nêu ra đúng với thực tế (103 bài kiểm thử, 0 máy chủ).
- [ ] Đỏ chỉ dùng cho trạng thái khoá, xanh lá chỉ cho đã xong.
