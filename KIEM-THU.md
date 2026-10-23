# Kết quả kiểm thử

Toàn bộ 137 bài chạy trên **Chromium thật** và **Electron thật**, không mock.
Chạy lại: `npm install && npm run e2e:setup && npm run test:all`

## 1 · Kiểm thử đơn vị — 88/88 ✓
Logic lõi (`packages/core`) và lưu trữ desktop (`packages/desktop`).

- **Khớp URL (12)** — subdomain, pattern có path, không khớp nhầm `notfacebook.com`, URL rác không làm sập, trang nội bộ trình duyệt luôn được qua.
- **Khung giờ (7)** — trong ngày, qua nửa đêm, theo thứ, dữ liệu sai định dạng.
- **Bộ máy chặn (21)** — bật/tắt cổng, hẹn giờ, quá hạn tự leo thang, Pomodoro, hoàn thành/bỏ tick, điểm & chuỗi ngày, thoát khẩn cấp, hạn mức/ngày, chế độ cứng, nâng cấp dữ liệu cũ, task lặp lại.
- **Pomodoro (8)** — tạm dừng/tiếp tục nhiều lần, chu kỳ nghỉ dài, thời lượng tuỳ chỉnh.
- **Đồng hồ & người gác (26)** — tick chung cho hai nền tảng, lời nhắc chỉ báo một lần, mốc báo thức kế tiếp, không cày điểm bằng tick/bỏ tick, chuỗi ngày đứt đúng lúc, việc lặp lại dời hạn chót, chu kỳ Pomodoro qua lần dừng, **không xoá/nới lỏng được gì khi cổng đang khoá**, đếm ngược thoát khẩn cấp.
- **Desktop (14)** — ghi tệp nguyên tử, tệp hỏng không làm sập, không ghi đĩa khi không đổi, máy chủ đồng bộ, **từ chối trang web ngoài và DNS rebinding**, bản cũ không ghi đè bản mới, người gác, khớp tên app.

## 2 · Extension trên Chromium thật — 34/34 ✓
Nạp extension vào Chromium thật; mọi tên miền trỏ về máy chủ giả nội bộ nên không cần Internet. Máy chủ giả nói được cả HTTP lẫn HTTPS trên cùng cổng, vì Chromium tự nâng `http://facebook.com` lên HTTPS theo danh sách HSTS dựng sẵn.

- **Chặn cơ bản (7)** — facebook bị chuyển sang trang chặn kèm đúng URL vừa định mở; subdomain `m.facebook.com`; danh sách trắng vẫn vào được; tab công việc luôn qua; **tab đang mở sẵn bị kéo về trang chặn**; bấm link sang trang cấm cũng chặn.
- **Mở khoá (3)** — tick xong → cổng mở → **tự quay lại trang ban đầu**; còn việc khác thì vẫn khoá; thêm việc ngay trên trang chặn.
- **Lối thoát khẩn cấp (6)** — nút khoá khi chưa hết đếm ngược; gõ sai không mở được; gõ đúng + hết chờ → mở tạm, **streak về 0, trừ 50 điểm**; nút quay lại khoá ngay; hết lượt/ngày; chế độ cứng tuyệt đối.
- **Chế độ & lịch (4)** — danh sách đen, khung giờ khoá dù không có việc, hẹn giờ tương lai, Pomodoro.
- **Giao diện (7)** — thêm/xoá việc, thêm domain có hiệu lực ngay, 4 tab, biểu đồ 14 cột, popup, nhớ cài đặt sau khi tải lại, xuất/nhập dữ liệu.
- **Không có cửa sau (3)** — không xoá được việc bắt buộc từ dashboard (có thông báo lý do); không đổi chế độ, không thêm facebook vào danh sách trắng, không reset khi đang khoá; hết cửa sổ mở tạm là luật chặn quay lại ngay, không đợi vòng tick một phút.
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

## 4 · Extension ⇄ desktop — 7/7 ✓
- Extension nhận ra app desktop đang chạy.
- Thêm việc trên extension → desktop nhận được; màn hình khoá hiện đúng việc đó.
- Tick xong trên desktop → **extension mở cổng, trình duyệt vào web lại được**.
- Việc tạo trên desktop → trình duyệt bị chặn theo.
- Tick xong trên desktop rồi thêm việc ngay trên extension → **lần tick không bị ghi đè**.
- Tắt đồng bộ → hai bên chạy độc lập.

## Lỗi đã phát hiện nhờ kiểm thử và đã sửa
1. **Mất chữ đang gõ ở ô cam kết** — panel thoát khẩn cấp bị dựng lại đồng thời do vòng làm mới định kỳ, xoá sạch nội dung người dùng vừa gõ. Đã thêm khoá chống gọi chồng và tách việc dựng panel khỏi vòng render.
2. **Hiện chữ `null` / `false` trên giao diện** — `replaceChildren` của DOM biến giá trị rỗng thành chữ. Đã thay bằng hàm `fill()` tự lọc, áp dụng cho cả 21 điểm render.
3. **Ô cài đặt bị ghi đè khi đang nhập** — vòng làm mới 30 giây ghi đè ô người dùng đang gõ. Đã bỏ qua phần tử đang được focus.
4. **Script `test:all` luôn báo "TẤT CẢ ĐỀU ĐẠT"** — thiếu `set -o pipefail` nên `lệnh | tail` nuốt mã lỗi. Đã thêm pipefail.
5. **Mất dữ liệu khi đồng bộ** — tick xong trên màn hình khoá desktop rồi thao tác ngay trên extension (trước vòng tick kế tiếp) thì extension đẩy bản cũ sang, ghi đè lần tick. Đã sửa hai phía: extension kéo bản mới về trước khi sửa, máy chủ desktop từ chối bản cũ hơn (409).
6. **Lối thoát miễn phí** — khi đang khoá, xoá việc bắt buộc, đổi sang chế độ danh sách đen hay bấm "Xoá sạch dữ liệu" đều mở cổng ngay mà không mất gì. Đã thêm "người gác" `guardChange` trong lõi, dùng chung cho extension và desktop.
7. **Việc lặp lại khoá oan** — sống lại sang ngày mới nhưng giữ hạn chót của hôm qua nên lập tức "quá hạn" và khoá cổng; việc hằng tuần thì không bao giờ sống lại nếu tuần đó không mở máy đúng thứ. Đã dời mốc theo chu kỳ.
8. **Cày điểm** — tick/bỏ tick một việc 5 lần được 150 điểm. Giờ bỏ tick trả lại điểm, thưởng dọn sạch chỉ một lần mỗi ngày.
9. **Chuỗi ngày hiển thị sai** — bỏ bê cả tuần vẫn hiện chuỗi cũ. Giờ tính chuỗi còn hiệu lực theo ngày thành công gần nhất.
10. **Khớp nhầm path** — mục `linkedin.com/feed` chặn luôn `/feedback`. Giờ khớp theo từng đoạn path.
11. **Pomodoro không bao giờ tới lượt nghỉ dài** nếu không bật tự chạy tiếp, vì dừng phiên làm mất số chu kỳ. Desktop thì không ghi nhận thời gian khi dừng sớm. Đã gom logic về lõi.
12. **Lời nhắc báo hai lần** và **cổng hở tới một phút** sau khi hết mở tạm. Giờ nhắc theo mốc lần tick trước và hẹn báo thức đúng thời điểm cổng đổi trạng thái.
13. **App desktop chặn macOS tắt máy** khi còn việc. Giờ nhường cho hệ điều hành khi tắt máy/đăng xuất.
