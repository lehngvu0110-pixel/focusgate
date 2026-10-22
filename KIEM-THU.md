# Kết quả kiểm thử

Toàn bộ 103 bài chạy trên **Chromium thật** và **Electron thật**, không mock.
Chạy lại: `npm install && npm run e2e:setup && npm run test:all`

## 1 · Kiểm thử đơn vị — 58/58 ✓
Logic lõi (`packages/core`) và lưu trữ desktop (`packages/desktop`).

- **Khớp URL (12)** — subdomain, pattern có path, không khớp nhầm `notfacebook.com`, URL rác không làm sập, trang nội bộ trình duyệt luôn được qua.
- **Khung giờ (7)** — trong ngày, qua nửa đêm, theo thứ, dữ liệu sai định dạng.
- **Bộ máy chặn (21)** — bật/tắt cổng, hẹn giờ, quá hạn tự leo thang, Pomodoro, hoàn thành/bỏ tick, điểm & chuỗi ngày, thoát khẩn cấp, hạn mức/ngày, chế độ cứng, nâng cấp dữ liệu cũ, task lặp lại.
- **Pomodoro (8)** — tạm dừng/tiếp tục nhiều lần, chu kỳ nghỉ dài, thời lượng tuỳ chỉnh.
- **Desktop (10)** — ghi tệp nguyên tử, tệp hỏng không làm sập, máy chủ đồng bộ, **từ chối trang web ngoài**, khớp tên app.

## 2 · Extension trên Chromium thật — 31/31 ✓
Nạp extension vào Chromium thật; mọi tên miền trỏ về máy chủ giả nội bộ nên không cần Internet.

- **Chặn cơ bản (7)** — facebook bị chuyển sang trang chặn kèm đúng URL vừa định mở; subdomain `m.facebook.com`; danh sách trắng vẫn vào được; tab công việc luôn qua; **tab đang mở sẵn bị kéo về trang chặn**; bấm link sang trang cấm cũng chặn.
- **Mở khoá (3)** — tick xong → cổng mở → **tự quay lại trang ban đầu**; còn việc khác thì vẫn khoá; thêm việc ngay trên trang chặn.
- **Lối thoát khẩn cấp (6)** — nút khoá khi chưa hết đếm ngược; gõ sai không mở được; gõ đúng + hết chờ → mở tạm, **streak về 0, trừ 50 điểm**; nút quay lại khoá ngay; hết lượt/ngày; chế độ cứng tuyệt đối.
- **Chế độ & lịch (4)** — danh sách đen, khung giờ khoá dù không có việc, hẹn giờ tương lai, Pomodoro.
- **Giao diện (7)** — thêm/xoá việc, thêm domain có hiệu lực ngay, 4 tab, biểu đồ 14 cột, popup, nhớ cài đặt sau khi tải lại, xuất/nhập dữ liệu.
- **Độ bền (4)** — dữ liệu nằm trong `chrome.storage`, luật chặn được dọn sạch khi cổng mở, trang nội bộ không bị chặn, danh sách đen mặc định phủ đúng.

## 3 · App desktop trên Electron thật — 8/8 ✓
- Bật app khi còn việc → hiện màn hình khoá đúng nội dung.
- Không có việc bắt buộc → **không** khoá.
- Tick xong → màn hình khoá tự ẩn.
- Thêm việc ngay trên màn hình khoá.
- **Không thoát được app khi còn việc bắt buộc.**
- Trạng thái ghi ra đĩa ngay, mở lại vẫn đúng.
- Lối thoát khẩn cấp: chờ + gõ đúng câu mới mở.
- Máy chủ đồng bộ chạy cùng app.

## 4 · Extension ⇄ desktop — 6/6 ✓
- Extension nhận ra app desktop đang chạy.
- Thêm việc trên extension → desktop nhận được; màn hình khoá hiện đúng việc đó.
- Tick xong trên desktop → **extension mở cổng, trình duyệt vào web lại được**.
- Việc tạo trên desktop → trình duyệt bị chặn theo.
- Tắt đồng bộ → hai bên chạy độc lập.

## Lỗi đã phát hiện nhờ kiểm thử và đã sửa
1. **Mất chữ đang gõ ở ô cam kết** — panel thoát khẩn cấp bị dựng lại đồng thời do vòng làm mới định kỳ, xoá sạch nội dung người dùng vừa gõ. Đã thêm khoá chống gọi chồng và tách việc dựng panel khỏi vòng render.
2. **Hiện chữ `null` / `false` trên giao diện** — `replaceChildren` của DOM biến giá trị rỗng thành chữ. Đã thay bằng hàm `fill()` tự lọc, áp dụng cho cả 21 điểm render.
3. **Ô cài đặt bị ghi đè khi đang nhập** — vòng làm mới 30 giây ghi đè ô người dùng đang gõ. Đã bỏ qua phần tử đang được focus.
