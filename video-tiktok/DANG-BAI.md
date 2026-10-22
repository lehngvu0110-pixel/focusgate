# Video TikTok — hướng dẫn đăng

Hai video, hai góc khác nhau. **Đừng đăng cùng ngày** — cách nhau 3–5 ngày để không tự cạnh tranh.

| Tệp | Góc | Độ dài |
|---|---|---|
| `focusgate-tiktok-vi.mp4` · `-en.mp4` | **Demo sản phẩm** — ghi việc → bị chặn → tick xong → cổng mở | 58,7 giây |
| `focusgate-tiktok-loi-thoat-vi.mp4` · `-en.mp4` | **Lối thoát khẩn cấp** — cái giá của một lần bỏ dở | 59,4 giây |
| `*-cover.png` | Ảnh bìa gợi ý (chính là khung hình đầu của từng video) | — |

Tất cả: 1080×1920 · 30fps · H.264 · dọc 9:16.

### Hai bản âm thanh — chọn một

| Tệp | Âm thanh | Dùng khi nào |
|---|---|---|
| `focusgate-tiktok-*.mp4` | **Im lặng** (chỉ có rãnh âm rỗng để nền tảng nhận đúng định dạng) | Đăng TikTok và ghép **nhạc trending ngay trong app**. Thuật toán ưu tiên video dùng nhạc có sẵn trên nền tảng, nên đây vẫn là lựa chọn mạnh nhất cho TikTok. |
| `focusgate-tiktok-*-co-tieng.mp4` | **Nhạc nền + hiệu ứng giao diện** — tiếng gõ phím, tiếng khoá lúc bị chặn, tiếng chuông lúc cổng mở, tiếng đồng hồ lúc đếm ngược | Đăng thẳng không cần thêm gì: Facebook, YouTube Shorts, Instagram Reels, hoặc nhúng vào landing page. Cũng hợp nếu bạn muốn xem trước nhịp phim. |

Bản `-co-tieng` chuẩn hoá ở **-15 LUFS**, đỉnh thực **-1,8 dBFS** — đúng mức các nền tảng video dọc đang dùng, nên không bị nén âm lượng khi tải lên.
Toàn bộ tiếng đều được **tổng hợp bằng công thức toán** (numpy + ffmpeg), không dùng mẫu có sẵn, nên không vướng bản quyền và chạy lại ở đâu cũng ra đúng một kết quả.

Vẫn muốn ghép nhạc trending lên bản `-co-tieng`? Được — hạ âm lượng nhạc trong TikTok xuống khoảng 50% để không đè mất tiếng hiệu ứng.

## Ba bước đăng

1. **Tải lên** → TikTok tự lấy khung hình đầu làm bìa, khung đó đã được làm sẵn cho đẹp (không fade từ đen). Muốn đổi thì chọn mốc gợi ý bên dưới.
2. **Thêm nhạc**: mục *Âm thanh* → chọn bài đang trending. Nhịp 100–115 BPM hợp với nhịp cắt. Âm lượng 100% vì video gốc không tiếng.
3. **Caption + hashtag**: lấy mẫu bên dưới.

---

## Video 1 — Demo sản phẩm

Mốc bìa gợi ý: **3,5 giây** (thẻ tiêu đề) hoặc **22 giây** (màn hình chặn).

**Caption — bản kể chuyện**
> Mình mở laptop để làm bài, 40 phút sau đang ở tab thứ 14. Nên mình tự code một cái cổng chặn: chưa tick xong việc thì không vào được Facebook, TikTok, YouTube. Miễn phí, không tài khoản, dữ liệu nằm hết trên máy.
> Link ở phần giới thiệu 👆

**Caption — bản thẳng vào vấn đề**
> Không phải app nhắc việc. Là cái cổng chặn thật, ở tầng mạng. Tick xong việc thì cổng mở, và nó đưa bạn về đúng trang vừa định mở.

**Hashtag** (chọn 5–8, đừng nhồi hết):
```
#focusgate #hoctap #sinhvien #tậptrung #productivity #studytok #bachkhoa #lamapp
```

---

## Video 2 — Lối thoát khẩn cấp

Đây là cơ chế độc đáo nhất của app, nên video này dễ có bình luận và chia sẻ hơn.
Mốc bìa gợi ý: **2 giây** (thẻ "Muốn lướt sớm?") hoặc **34 giây** (khoảnh khắc streak về 0).

**Caption — bản chính**
> App chặn web của mình có lối thoát. Nhưng muốn dùng thì: chờ đủ 30 giây, gõ tay 121 ký tự cam kết (dán không tính), mất sạch chuỗi 12 ngày, trừ 50 điểm. Và mỗi ngày chỉ 2 lượt.
> Một cái khoá không có lối ra sẽ bị gỡ ngay lần đầu bạn thực sự cần vào. Nên mình để lối ra — chỉ là bắt trả giá.
> Link ở phần giới thiệu 👆

**Caption — bản gây tranh luận (dễ có bình luận)**
> Bạn nghĩ 30 giây chờ + gõ tay 121 ký tự là quá khắt khe, hay vẫn còn quá dễ? Mình đang cân nhắc tăng lên. Comment cho mình biết.

**Caption — bản ngắn**
> Muốn lướt sớm? Được. Nhưng có giá.

**Hashtag**:
```
#focusgate #tậptrung #hoctap #sinhvien #productivity #studytok #selfcontrol #lamapp
```

**Gợi ý trả lời bình luận** (chuẩn bị trước sẽ đẩy tương tác):
- *"Tắt extension là xong mà"* → Đúng, mình ghi rõ giới hạn đó trong hướng dẫn. Nhưng phải mở chrome://extensions rồi bấm tắt cũng đủ chậm để bạn kịp nhận ra mình đang làm gì. Muốn chặt hơn thì có cách khoá cứng bằng chính sách hệ thống của Chrome.
- *"Sao không bỏ luôn lối thoát?"* → Bỏ được, trong Cài đặt có chế độ cứng tuyệt đối. Nhưng mặc định để lối thoát vì một cái khoá không có lối ra thì bị gỡ ngay lần đầu có việc gấp.
- *"Có bản Windows không?"* → Extension chạy mọi trình duyệt Chromium kể cả Windows. App desktop hiện chỉ có macOS.

---

## Caption tiếng Anh

**Video 1**
> I kept opening my laptop to study and ending up on my 14th tab. So I built a gate: distracting sites stay blocked until the tasks are checked off. Free, no account, everything stays on your machine.

**Video 2**
> My website blocker has an escape hatch. Using it costs you: wait 30 seconds, type 121 characters by hand (pasting does not count), lose your whole streak, minus 50 points, twice a day max.
> A lock with no way out gets uninstalled the first time you genuinely need through.

```
#focus #productivity #studytok #buildinpublic #indiedev #chromeextension #deepwork
```

---

## Thêm giọng đọc

Máy chủ dựng video này bị chặn mọi dịch vụ chuyển văn bản thành giọng nói, nên phần
giọng đọc phải chạy trên máy của bạn. Đã có sẵn đường dẫn một-nút:

```
Nháy đúp  3-Long-tieng.command
```

Script sẽ tự cài `edge-tts` (giọng neural tiếng Việt của Microsoft — tự nhiên nhất
hiện có, miễn phí), đọc 44 câu trong `video/vo-script.json`, xếp từng câu vào đúng
mốc thời gian, rồi ghép đè lên nhạc nền. Nhạc tự động nhỏ lại mỗi lúc có lời.

Cần sẵn trên máy: **Node.js**, **ffmpeg** (`brew install ffmpeg`), **python3**.
Không cài được `edge-tts` thì script tự chuyển sang giọng `Linh` có sẵn trong macOS
(Cài đặt hệ thống → Trợ năng → Nội dung nói → Giọng nói hệ thống → Tiếng Việt).

**Đổi giọng, đổi tốc độ**

```bash
python3 video/tts.py --voice-vi vi-VN-HoaiMyNeural --rate +6%   # giọng nữ, nhanh hơn 6%
node video/vo.mjs && node video/mux.mjs
```

Hai giọng Việt của Microsoft: `vi-VN-NamMinhNeural` (nam, mặc định) và
`vi-VN-HoaiMyNeural` (nữ).

**Tự thu giọng mình** — cách này lên TikTok ăn hơn giọng máy, vì khán giả nhận ra
người thật. Mở `video/vo-script.json`, thu theo mốc bên dưới, xuất mỗi câu một tệp
đặt tên `<chuyện>-<ngôn ngữ>-<số thứ tự>.wav` (ví dụ `demo-vi-01.wav`) bỏ vào
`video/audio/vo-src/`, rồi chạy `node video/vo.mjs && node video/mux.mjs`.
Script tự cắt khoảng lặng thừa, tự dịch câu sang trái/phải vài phần mười giây cho
vừa chỗ, và chỉ tăng tốc tối đa 1,15 lần nếu câu vẫn dài — quá mức đó nó báo để
bạn sửa chữ.

**Hoặc dùng luôn giọng đọc của TikTok** — tải bản im lặng lên, thêm chữ, chọn
*Văn bản thành giọng nói*. Nhanh nhất nhưng giọng nghe ra ngay là giọng TikTok.

### Video 1 — demo

| Mốc | Lời đọc |
|---|---|
| 0:01.5 – 0:04.0 | Xong việc rồi hẵng lướt. |
| 0:04.6 – 0:13.9 | Đầu tiên, ghi việc cần làm. Gắn luôn hạn chót, và cụm tab bạn thật sự cần. |
| 0:14.2 – 0:15.4 | Giờ thử mở Facebook. |
| 0:15.5 – 0:19.5 | Bị chặn. Chặn ở tầng mạng, gõ thẳng đường dẫn hay bấm link đều không lọt. |
| 0:19.7 – 0:22.4 | Tab đang mở sẵn cũng bị kéo về. |
| 0:23.0 – 0:31.2 | Tick xong việc, cổng mở ngay. Và nó đưa bạn về đúng trang vừa định mở. |
| 0:31.8 – 0:36.8 | Tick nhanh ngay trên thanh công cụ, không cần mở bảng điều khiển. |
| 0:37.4 – 0:44.8 | Còn app trên máy Mac thì bật máy là hiện ngay, chặn cả ứng dụng ngoài trình duyệt. |
| 0:45.4 – 0:51.6 | Không máy chủ, không tài khoản. Dữ liệu nằm hết trên máy bạn. |
| 0:52.2 – 0:58.7 | Miễn phí, mã nguồn mở. Link ở phần giới thiệu. |

### Video 2 — lối thoát khẩn cấp

| Mốc | Lời đọc |
|---|---|
| 0:01.5 – 0:05.0 | Muốn lướt sớm? Được thôi. Nhưng có giá. |
| 0:05.6 – 0:11.4 | Mở lối thoát ra xem. |
| 0:11.9 – 0:14.1 | Mất chuỗi mười hai ngày. Trừ năm mươi điểm. |
| 0:14.3 – 0:15.3 | Dán vào? Không tính. |
| 0:15.6 – 0:18.3 | Ô nhập chặn cả dán lẫn kéo thả. Phải gõ tay. |
| 0:18.6 – 0:25.0 | Một trăm hai mươi mốt ký tự. Sai một chữ là nút vẫn khoá. |
| 0:25.5 – 0:30.6 | Rồi chờ đủ ba mươi giây. Đoạn này mình tua nhanh cho đỡ dài. |
| 0:31.2 – 0:35.5 | Xong. Cổng mở mười phút. Chuỗi về không, trừ năm mươi điểm. |
| 0:36.1 – 0:39.8 | Đổi ý được không? Được. Một nút là khoá lại ngay. |
| 0:40.4 – 0:46.0 | Hoặc tắt hẳn lối thoát. Khi đó chỉ hoàn thành việc mới mở được cổng. |
| 0:46.6 – 0:53.2 | Ba mươi giây chờ. Một trăm hai mươi mốt ký tự. Chuỗi về không. Hai lượt mỗi ngày. |
| 0:53.8 – 0:59.4 | Ma sát đúng chỗ. Link ở phần giới thiệu. |

Bản tiếng Anh nằm trong `video/vo-script.json`, mục `en`.

---

## Hai điều nên biết

- **Bản tiếng Anh vẫn quay giao diện tiếng Việt.** App chưa có bản dịch, chỉ phụ đề là tiếng Anh. Nếu nhắm Product Hunt hay khán giả quốc tế nghiêm túc, nên dịch giao diện trước rồi quay lại.
- **Chữ trong video dùng font dự phòng.** Phiên làm việc này bị chặn tải Google Fonts nên Be Vietnam Pro không tải được. Dựng lại trên máy Mac của bạn sẽ ra SF Pro, chữ sắc nét hơn.

## Dựng lại video

```bash
npm install
npm run e2e:setup          # cài Playwright (một lần)
npm run video              # quay lại + dựng lại cả 4 tệp
```

Từng bước riêng:

```bash
npm run video:capture              # quay lại footage demo
npm run video:escape               # quay lại footage lối thoát khẩn cấp
npm run video:desktop              # quay lại màn hình khoá macOS
npm run video:assets               # dựng lại nền, phụ đề, thẻ chữ
npm run video:build                # ghép cả hai video (bản im lặng)
node video/build.mjs escape        # chỉ ghép video lối thoát

npm run video:audio                # dựng lại nhạc nền + hiệu ứng
npm run video:tts                  # đọc giọng (cần edge-tts hoặc macOS)
npm run video:vo                   # xếp giọng vào đúng mốc thời gian
npm run video:mux                  # ghép âm thanh vào MP4
npm run video:tieng                # = video:audio + video:mux
```

- Sửa chữ phụ đề và thẻ: `video/scene.html` — biến `SCENES` và `CARDS`, chia theo `demo` / `escape`.
- Sửa nhịp cắt, độ dài, hệ số tăng tốc: `video/build.mjs` — object `STORIES`.
- Sửa nhạc nền, hiệu ứng, mốc đặt tiếng: `video/audio.py` — object `BOUNDS` và hai hàm `sfx_demo` / `sfx_escape`. Bộ tổng hợp nằm ở `video/synth.py`.
- Mốc thời gian của luồng thoát khẩn cấp được `capture-escape.mjs` ghi ra `video/clips/escape-marks.json`; nếu quay lại thì cập nhật các giá trị `ss` trong `build.mjs` theo tệp đó.
