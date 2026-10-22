"""
Dựng nhạc nền + hiệu ứng âm thanh cho hai video FocusGate.

    python3 video/audio.py              → dựng cả hai chuyện
    python3 video/audio.py escape       → chỉ dựng chuyện "lối thoát khẩn cấp"

Mốc thời gian lấy từ ranh giới đoạn đã đo trên chính tệp MP4 thành phẩm
(xem BOUNDS bên dưới), nên tiếng luôn rơi đúng nhịp cắt hình.
Xuất ra video/audio/: sfx-<chuyện>.wav · bed-<chuyện>.wav · mix-<chuyện>.wav
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import (Track, SR, riser, sub_impact, ui_click, key_tick, lock_thud,
                   deny_buzz, unlock_chime, loss_drop, clock_tick, ping, whoosh,
                   chord_pad, _sine, _exp)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio')
os.makedirs(OUT, exist_ok=True)

# Ranh giới các đoạn, đo bằng cách so sánh dải phụ đề giữa các khung hình
# của chính tệp MP4 đã dựng — không phải giá trị danh nghĩa trong build.mjs.
BOUNDS = {
    'demo':   [0, 4.0, 13.9, 22.4, 31.2, 36.8, 44.8, 51.6, 58.7],
    'escape': [0, 5.0, 11.4, 15.0, 25.0, 30.633, 35.533, 39.833, 46.033, 53.233, 59.433],
}

rng = np.random.default_rng(2024)


def typing(tr, t0, t1, step=0.075, gain=0.2, jitter=0.35):
    """Rải tiếng gõ phím trong khoảng thời gian cho trước, có xê dịch ngẫu nhiên."""
    t, i = t0, 0
    while t < t1:
        tr.put(t, key_tick(gain, seed=int(t * 1000) % 9973), pan=rng.uniform(-0.25, 0.25))
        t += step * (1 + rng.uniform(-jitter, jitter))
        i += 1
    return i


def ticking(tr, t0, t1, step, gain=0.26):
    n = 0
    t = t0
    while t < t1:
        tr.put(t, clock_tick(gain, hi=(n % 2 == 1)), pan=0.12 if n % 2 else -0.12)
        t += step
        n += 1
    return n


# ---------------------------------------------------------------- hiệu ứng

def sfx_demo(b):
    tr = Track(b[-1])
    # 0 · thẻ tiêu đề
    tr.put(0.00, riser(1.15, 0.42))
    tr.put(1.13, sub_impact(0.95))
    tr.put(1.16, whoosh(0.6, 0.22))
    tr.put(2.45, ping(0.16, 1568))
    # 1 · ghi việc
    tr.put(b[1], whoosh(0.55, 0.26))
    typing(tr, b[1] + 0.6, b[1] + 2.5)
    tr.put(b[1] + 2.7, ui_click(0.34))
    typing(tr, b[1] + 3.5, b[1] + 5.1)
    tr.put(b[1] + 5.3, ui_click(0.34))
    tr.put(b[1] + 6.5, ui_click(0.26))
    tr.put(b[1] + 7.4, ui_click(0.26))
    tr.put(b[1] + 8.6, ping(0.14, 1318))
    # 2 · bị chặn  ← nhịp mạnh nhất của video
    tr.put(b[2], whoosh(0.5, 0.3))
    typing(tr, b[2] + 0.25, b[2] + 0.95, step=0.09, gain=0.17)
    tr.put(b[2] + 1.10, lock_thud(1.0))
    tr.put(b[2] + 1.16, deny_buzz(0.34))
    tr.put(b[2] + 3.70, ui_click(0.24))
    tr.put(b[2] + 5.95, lock_thud(0.62))
    # 3 · tick xong việc → cổng mở
    tr.put(b[3], whoosh(0.5, 0.26))
    tr.put(b[3] + 0.80, ui_click(0.36)); tr.put(b[3] + 0.86, ping(0.17, 1046))
    tr.put(b[3] + 2.85, ui_click(0.36)); tr.put(b[3] + 2.91, ping(0.19, 1244))
    tr.put(b[3] + 3.95, sub_impact(0.5))
    tr.put(b[3] + 4.00, unlock_chime(0.58))
    tr.put(b[3] + 6.20, ping(0.15, 1760))
    # 4 · tick nhanh trên thanh công cụ
    tr.put(b[4], whoosh(0.45, 0.24))
    tr.put(b[4] + 0.75, ui_click(0.32))
    tr.put(b[4] + 2.35, ui_click(0.32)); tr.put(b[4] + 2.42, ping(0.18, 1397))
    tr.put(b[4] + 3.90, ping(0.13, 1760))
    # 5 · app trên máy Mac
    tr.put(b[5], whoosh(0.6, 0.27))
    tr.put(b[5] + 0.35, sub_impact(0.6))
    tr.put(b[5] + 1.20, lock_thud(0.72))
    tr.put(b[5] + 4.90, ui_click(0.26))
    tr.put(b[5] + 6.30, ping(0.14, 1568))
    # 6 · thẻ số liệu
    tr.put(b[6], whoosh(0.6, 0.28)); tr.put(b[6] + 0.05, sub_impact(0.72))
    ticking(tr, b[6] + 0.85, b[6] + 1.95, 0.105, 0.18)
    tr.put(b[6] + 2.05, ping(0.22, 1318))
    tr.put(b[6] + 3.70, ping(0.14, 1568))
    # 7 · lời kêu gọi
    tr.put(b[7], whoosh(0.7, 0.3)); tr.put(b[7] + 0.05, sub_impact(0.8))
    tr.put(b[7] + 1.30, unlock_chime(0.4))
    tr.put(b[7] + 5.90, ping(0.2, 1760))
    return tr


def sfx_escape(b):
    tr = Track(b[-1])
    # 0 · thẻ tiêu đề — tối và căng hơn video demo
    tr.put(0.00, riser(1.15, 0.36))
    tr.put(1.13, sub_impact(1.0))
    tr.put(2.25, lock_thud(0.4))
    tr.put(3.55, clock_tick(0.2, hi=True))
    tr.put(4.15, clock_tick(0.2))
    # 1 · màn hình chặn, mở bảng lối thoát
    tr.put(b[1], whoosh(0.5, 0.3))
    tr.put(b[1] + 0.15, lock_thud(0.92))
    tr.put(b[1] + 3.00, ui_click(0.24))
    tr.put(b[1] + 4.20, ui_click(0.36))
    tr.put(b[1] + 4.26, whoosh(0.45, 0.2))
    # 2 · bảng "cái giá" + dán bị chặn
    tr.put(b[2], whoosh(0.45, 0.24))
    for k, f in enumerate((880, 740, 622)):                  # ba dòng chi phí, đi xuống
        tr.put(b[2] + 0.50 + k * 0.58, ping(0.2, f, 0.42), pan=-0.2 + k * 0.2)
    tr.put(b[2] + 2.27, deny_buzz(0.55))                     # dán không tính
    tr.put(b[2] + 2.34, sub_impact(0.34))
    # 3 · gõ tay 121 ký tự
    tr.put(b[3], whoosh(0.5, 0.26))
    typing(tr, b[3] + 0.70, b[3] + 8.20, step=0.062, gain=0.19, jitter=0.22)
    tr.put(b[3] + 8.45, ping(0.2, 1046))
    # 4 · đếm ngược 30 giây (đã tua nhanh 2,25×)
    tr.put(b[4], whoosh(0.5, 0.26))
    ticking(tr, b[4] + 0.12, b[4] - 0.2 + (b[5] - b[4]), 0.2222, 0.24)
    n = int((b[5] - b[4]) * SR)
    tr.put(b[4], _sine(np.linspace(44, 58, n), n) * np.linspace(0.02, 0.16, n))  # nền dâng
    # 5 · nút mở khoá + cái giá phải trả
    tr.put(b[5], whoosh(0.55, 0.28))
    tr.put(b[5] + 0.38, ping(0.34, 1976, 0.7))               # hết đếm ngược
    tr.put(b[5] + 1.45, ui_click(0.42))
    tr.put(b[5] + 1.58, sub_impact(0.95))
    tr.put(b[5] + 1.66, loss_drop(0.72))                     # chuỗi 12 ngày về 0
    tr.put(b[5] + 3.40, clock_tick(0.16))
    # 6 · đang mở tạm → bấm khoá lại
    tr.put(b[6], whoosh(0.5, 0.26))
    tr.put(b[6] + 0.32, ping(0.18, 784, 0.6))
    tr.put(b[6] + 2.70, ui_click(0.38))
    tr.put(b[6] + 2.90, lock_thud(0.85))
    # 7 · chế độ cứng tuyệt đối
    tr.put(b[7], whoosh(0.55, 0.28))
    tr.put(b[7] + 0.80, ui_click(0.34))
    tr.put(b[7] + 1.05, lock_thud(1.0))
    tr.put(b[7] + 1.12, sub_impact(0.55))
    tr.put(b[7] + 4.10, ping(0.13, 587))
    # 8 · thẻ số liệu
    tr.put(b[8], whoosh(0.6, 0.28)); tr.put(b[8] + 0.05, sub_impact(0.72))
    ticking(tr, b[8] + 0.85, b[8] + 1.95, 0.105, 0.18)
    tr.put(b[8] + 2.05, ping(0.22, 1318))
    tr.put(b[8] + 3.70, ping(0.14, 1568))
    # 9 · lời kêu gọi
    tr.put(b[9], whoosh(0.7, 0.3)); tr.put(b[9] + 0.05, sub_impact(0.8))
    tr.put(b[9] + 1.20, unlock_chime(0.4))
    tr.put(b[9] + 5.10, ping(0.2, 1760))
    return tr


# ---------------------------------------------------------------- nền

# Hợp âm Rê thứ: tối, không uỷ mị. Đổi thế bấm ở các mốc cấu trúc để có chuyển động
# mà không cần giai điệu — giai điệu tổng hợp rất dễ nghe ra "nhạc máy".
VOICINGS = {
    'a': [73.42, 110.00, 174.61, 261.63],      # Dm  — mặc định
    'b': [65.41, 98.00, 155.56, 233.08],       # C   — đoạn căng
    'c': [73.42, 110.00, 220.00, 293.66],      # Dm5 — đoạn kết, mở hơn
}

BED_PLAN = {
    'demo':   [(0, 'a'), (13.9, 'b'), (22.4, 'a'), (44.8, 'c')],
    'escape': [(0, 'a'), (11.4, 'b'), (30.633, 'b'), (46.033, 'c')],
}


def bed(story, b):
    tr = Track(b[-1])
    plan = BED_PLAN[story] + [(b[-1], None)]
    for (t0, key), (t1, _) in zip(plan, plan[1:]):
        if key is None:
            break
        tr.put(t0, chord_pad(t1 - t0 + 1.4, VOICINGS[key], gain=0.115))
    if story == 'escape':                       # nhịp tim tăng dần trong lúc đếm ngược
        t, step = b[4] + 0.1, 0.60
        while t < b[5] - 0.1:
            tr.put(t, sub_impact(0.30, dur=0.4, f0=64, f1=40))
            step = max(0.30, step * 0.90)
            t += step
    return tr


# ---------------------------------------------------------------- chạy

BUILDERS = {'demo': sfx_demo, 'escape': sfx_escape}
want = [a for a in sys.argv[1:] if a in BOUNDS] or list(BOUNDS)

for story in want:
    b = BOUNDS[story]
    s = BUILDERS[story](b).space(dur=0.9, mix=0.18).peak_to(-3.0)
    g = bed(story, b).peak_to(-16.0)
    m = Track(b[-1]); m.mix(s, 1.0); m.mix(g, 1.0); m.peak_to(-1.5)
    s.save(f'{OUT}/sfx-{story}.wav')
    g.save(f'{OUT}/bed-{story}.wav')
    m.save(f'{OUT}/mix-{story}.wav')
    # bản nén để kèm vào gói phát hành (WAV 11 MB → m4a ~1,4 MB)
    import subprocess
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', f'{OUT}/mix-{story}.wav', '-c:a', 'aac', '-b:a', '192k',
                    f'{OUT}/mix-{story}.m4a'], check=False)
    print(f'✓ {story}: sfx · bed · mix ({b[-1]:.2f} giây)')
