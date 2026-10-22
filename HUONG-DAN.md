# FocusGate — Xong việc rồi hẵng lướt

Bộ đôi chặn xao nhãng cho macOS:

| Thành phần | Lo việc gì |
|---|---|
| **Extension trình duyệt** | Chặn thật các trang web khi bạn còn việc chưa xong. Nhắc ngay khi mở trình duyệt. |
| **App desktop (macOS)** | Bật lên cùng máy, hiện màn hình khoá toàn màn hình, canh chừng các app ngoài trình duyệt. |

Hai phần **tự tìm thấy nhau** và dùng chung một danh sách việc. Cài phần nào trước cũng được; dùng riêng từng phần vẫn chạy bình thường.

---

## 1. Cài extension cho Chrome (2 phút)

1. Lấy extension về một chỗ **cố định**, ví dụ `~/Documents/FocusGate`, theo một trong hai cách:
   - Tải `focusgate-extension.zip` ở mục **Releases** của repo GitHub rồi giải nén, hoặc
   - Tải mã nguồn (`git clone` hay nút **Code → Download ZIP**) và dùng thư mục `packages/extension`.
   > Đừng để trong Downloads rồi xoá: Chrome nạp trực tiếp từ thư mục này, xoá đi là extension biến mất.
2. Mở Chrome → gõ `chrome://extensions` vào thanh địa chỉ.
3. Bật **Developer mode** (góc trên bên phải).
4. Bấm **Load unpacked** → chọn thư mục vừa giải nén (hoặc `packages/extension` nếu dùng mã nguồn). Đó là thư mục có tệp `manifest.json`.
5. Ghim biểu tượng ổ khoá vào thanh công cụ cho tiện.

Xong. Bảng điều khiển tự mở ở lần cài đầu tiên.

**Microsoft Edge / Brave / Cốc Cốc / Arc**: y hệt các bước trên (`edge://extensions`, `brave://extensions`…).

---

## 2. Cài app desktop cho macOS

### Cách khuyến nghị — dựng ngay trên máy bạn (1 lần nháy đúp)

Nháy đúp **`0-Tao-app-desktop.command`**. Script sẽ tự: cài thư viện → dựng mã → đóng gói `FocusGate.app` → chép vào `/Applications` → bật lên.

Yêu cầu duy nhất: **Node.js** (bản LTS tại <https://nodejs.org>, hoặc `brew install node`). Lần đầu chạy sẽ tải Electron khoảng 130 MB nên hơi lâu, các lần sau rất nhanh.

Cách này cho ra app **ký đúng chuẩn ngay trên máy bạn**, không vướng cảnh báo bảo mật.

### Muốn chạy thử nhanh không cần đóng gói
```bash
npm install && npm run build
cd packages/desktop && npx electron .
```

Sau khi cài, biểu tượng ổ khoá nằm ở **thanh menu trên cùng bên phải** (app cố ý không hiện trong Dock).

### Quyền cần cấp (macOS sẽ tự hỏi)

| Quyền | Để làm gì | Bắt buộc? |
|---|---|---|
| **Trợ năng** (Accessibility) | Biết app nào đang mở và ẩn app bị chặn | Không — thiếu thì vẫn hiện màn hình khoá, chỉ không tự ẩn app |
| **Thông báo** | Báo hết phiên Pomodoro, hết giờ nghỉ | Không |
| **Mở khi đăng nhập** | Nhắc việc ngay khi bật máy | Nên bật (mặc định đã bật) |

Cấp ở: **Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Trợ năng** → bật FocusGate.

---

## 3. Safari (tuỳ chọn — cần Xcode)

Safari không nhận extension dạng thư mục như Chrome. Phải dựng qua Xcode:

1. Cài **Xcode** từ App Store (~7 GB, miễn phí).
2. Nháy đúp `2-Tao-ban-Safari.command` ở thư mục gốc của mã nguồn.
3. Làm theo hướng dẫn hiện trên màn hình (mở project → bấm Run → bật tiện ích trong Safari).

Nếu thấy phiền, **chỉ dùng Chrome là đủ** — app desktop vẫn lo phần chặn app và nhắc khi bật máy.

---

## 4. Dùng như thế nào

### Thêm việc
Bảng điều khiển (biểu tượng ổ khoá → ⚙) → tab **Việc cần làm**.

- **Bắt buộc** (mặc định bật): còn việc này thì web bị khoá.
- **Bắt đầu nhắc / khoá lúc**: để trống là khoá ngay; đặt "7:00 sáng mai" thì sáng mai bật máy mới khoá.
- **Hạn chót**: quá hạn, việc không-bắt-buộc sẽ **tự động** thành bắt buộc.
- **Lặp lại**: hằng ngày / thứ 2–6 / hằng tuần — tự sống lại vào chu kỳ sau.
- **Tab công việc**: bấm *Chọn từ tab đang mở…* để gắn nguyên cụm tab đang làm vào việc. Các tab này **luôn vào được** kể cả khi khoá chặt, và bấm *Mở tab* là mở lại cả cụm.

### Giao diện
FocusGate mặc định dùng **nền tối** — đó là nhận diện của sản phẩm, không đổi theo hệ điều hành. Muốn nền sáng: **Cài đặt → Giao diện → Sáng**.

### Hai chế độ chặn
Tab **Chặn & lịch**:

- **Khoá chặt** (mặc định): chỉ danh sách trắng mới vào được. Danh sách trắng đã có sẵn Google, Drive, LMS Bách Khoa, GitHub, StackOverflow, arXiv, Khan Academy…
- **Nhẹ hơn**: chỉ chặn danh sách đen (Facebook, TikTok, YouTube, Shopee, Netflix, kenh14…).

Cả hai danh sách sửa được thoải mái. Gõ `youtube.com` để chặn cả trang, hoặc `youtube.com/shorts` để chỉ chặn Shorts.

### Khung giờ tập trung
Đặt ví dụ 19:00–22:00 thứ 2–6: trong khung đó cổng tự khoá dù không có việc nào. Hỗ trợ cả khung qua nửa đêm (22:00 → 01:00).

### Pomodoro
Bấm **Tập trung** ở một việc để chạy 25 phút. Trong lúc phiên chạy, cổng khoá luôn. Phút tập trung được cộng vào biểu đồ ở tab **Thống kê**.

### Điểm và chuỗi ngày
- Xong 1 việc: **+10 điểm**. Dọn sạch việc bắt buộc trong ngày: **+20**. Mỗi 5 phút tập trung: **+1**.
- Ngày nào cũng dọn sạch việc → **chuỗi ngày** tăng. Bỏ một ngày là đứt.

---

## 5. Lối thoát khẩn cấp — và vì sao nó "khó chịu"

Có lúc bạn thực sự cần vào Facebook gấp. FocusGate không khoá chết bạn, nhưng cũng không cho thoát dễ:

1. Mở phần **"Tôi thực sự cần thoát khẩn cấp"**.
2. **Chờ 30 giây** — đủ lâu để cơn thèm đi qua.
3. **Gõ tay** nguyên một câu cam kết dài (dán không được tính).
4. Bấm xác nhận → cổng mở **10 phút** rồi khoá lại.

Cái giá: **chuỗi ngày về 0, mất 50 điểm**, và mỗi ngày chỉ có **2 lượt**.

Có nút **"Tôi quay lại làm việc"** để khoá lại sớm.

Muốn khắt khe hơn nữa? Tab **Cài đặt** → tắt hẳn "Cho phép thoát khẩn cấp" = **chế độ cứng tuyệt đối**, chỉ hoàn thành việc mới mở được cổng.

---

## 6. Nói thật về giới hạn

Không phần mềm nào chạy trên máy bạn mà ngăn được chính bạn 100%. Cụ thể:

| Cách "lách" | FocusGate làm được gì |
|---|---|
| Tắt extension ở `chrome://extensions` | Không ngăn được. Xem cách khoá cứng bên dưới. |
| Mở trình duyệt khác chưa cài extension | Không ngăn được — nên cài cho mọi trình duyệt bạn dùng. |
| Force Quit app desktop từ Activity Monitor | Không ngăn được (đây cũng là van an toàn). |
| Dùng điện thoại | Ngoài tầm với. |
| Đóng cửa sổ khoá / Cmd+Q | **Bị chặn** khi còn việc bắt buộc. |
| Mở app trong danh sách chặn | **Bị ẩn đi** + màn hình khoá bật lên (cần quyền Trợ năng). |
| Gõ thẳng URL, bấm link, chuyển tab | **Bị chặn** ở tầng mạng, kể cả tab đang mở sẵn. |

**Khoá cứng extension (tuỳ chọn, cho ai hay tự lách):**
Chrome cho phép ép cài extension bằng chính sách hệ thống, khi đó nút *Remove* bị vô hiệu hoá. Cần mật khẩu admin:

```bash
# Lấy ID extension ở chrome://extensions (bật Developer mode để thấy)
sudo defaults write /Library/Preferences/com.google.Chrome ExtensionSettings -dict-add \
  "<ID_EXTENSION>" '{"installation_mode":"normal_installed","toolbar_pin":"force_pinned"}'
# Khởi động lại Chrome
```
Gỡ bỏ chính sách này:
```bash
sudo defaults delete /Library/Preferences/com.google.Chrome ExtensionSettings
```

Nói cho cùng: công cụ tạo **ma sát**, còn quyết định vẫn là của bạn. Ma sát đúng chỗ là đủ để đổi thói quen.

---

## 7. Dữ liệu của bạn

- **Không có máy chủ, không tài khoản, không Internet.** Mọi thứ nằm trên máy bạn.
- Extension lưu trong `chrome.storage.local`; app desktop lưu ở
  `~/Library/Application Support/FocusGate/focusgate-state.json`.
- Đồng bộ giữa hai bên đi qua `http://127.0.0.1:47823` — chỉ localhost, và máy chủ **từ chối** mọi yêu cầu đến từ trang web thường (chỉ nhận từ extension).
- Sao lưu / khôi phục: tab **Cài đặt → Xuất tệp sao lưu**.

---

## 8. Gỡ cài đặt

```bash
# App desktop
rm -rf /Applications/FocusGate.app
rm -rf ~/Library/Application\ Support/FocusGate
```
Extension: `chrome://extensions` → Remove. (Nếu đã dùng chính sách khoá cứng thì xoá chính sách trước — xem mục 6.)

---

## 9. Tài sản thương hiệu & quảng bá

```
brand/          logo SVG (bản gradient + bản một màu), bộ icon PNG 16→1024, BRAND.md
quang-ba/       ảnh đăng mạng xã hội đã xuất sẵn + mẫu card.html để tự sửa chữ
web/            mã nguồn landing page song ngữ Việt/Anh
anh-minh-hoa/   ảnh chụp giao diện thật
```

`brand/BRAND.md` là tài liệu đầy đủ: bảng màu kèm ý nghĩa, thang chữ, **quy tắc riêng cho tiếng Việt**
(line-height tối thiểu, không đặt chữ Việt bằng font mono), các thành phần đặc trưng và danh sách kiểm tra trước khi đăng.

Muốn đổi chữ trên ảnh quảng bá: sửa `quang-ba/card.html` rồi chạy `npm run social`.
Chạy trên máy Mac sẽ ra chữ đẹp hơn vì có sẵn SF Pro.

---

## 10. Dành cho người muốn nghịch code

```
focusgate/
  packages/core/        logic dùng chung (quyết định chặn, lịch, điểm, pomodoro) + 48 unit test
  packages/extension/   Chrome MV3: service worker, declarativeNetRequest, 3 trang giao diện
  packages/desktop/     Electron macOS: màn hình khoá, tray, canh app, máy chủ đồng bộ
  tests/e2e/            kiểm thử trên Chromium thật + Electron thật
```

```bash
npm install
npm run build          # đồng bộ core sang 2 gói + đóng gói extension
npm test               # 58 unit test
npm run e2e            # 31 bài trên Chromium thật
npm run e2e:desktop    # 8 bài trên Electron thật
npm run e2e:integration# 6 bài extension ⇄ desktop
npm run test:all       # chạy tất cả
npm run social         # xuất lại bộ ảnh quảng bá
```

Đóng gói lại app macOS (cần tải sẵn bản Electron darwin-arm64):
```bash
ELECTRON_OVERRIDE_DIST_PATH=/đường/dẫn/electron-darwin node scripts/package-mac.mjs
```
