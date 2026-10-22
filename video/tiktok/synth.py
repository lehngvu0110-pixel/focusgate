"""
Bộ tổng hợp âm thanh offline cho video FocusGate.

Không dùng mẫu âm thanh có sẵn — mọi tiếng đều được tính ra từ numpy/scipy,
nên chạy ở đâu cũng ra kết quả giống hệt nhau và không vướng bản quyền.

Bảng màu âm thanh bám theo nhận diện thương hiệu: nền tối, trầm, ít nốt;
điểm nhấn sáng màu (tím → lam) dành cho khoảnh khắc "mở cổng".
"""
import numpy as np
from scipy import signal

SR = 48_000

# ---------------------------------------------------------------- tiện ích

def _t(dur):
    return np.arange(int(dur * SR)) / SR

def _env(n, a=0.002, d=0.08, s=0.0, r=0.05, sus=0.0):
    """Bao biên độ ADSR đơn giản, trả về mảng dài n mẫu."""
    out = np.zeros(n)
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    si = max(0, n - ai - di - ri)
    i = 0
    if ai: out[i:i + ai] = np.linspace(0, 1, ai); i += ai
    if di: out[i:i + di] = np.linspace(1, s if s else sus, di); i += di
    if si: out[i:i + si] = s if s else sus; i += si
    if ri: out[i:i + ri] = np.linspace(out[i - 1] if i else 1, 0, min(ri, n - i))
    return out[:n]

def _exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))

def _lp(x, f, order=4):
    b, a = signal.butter(order, min(f / (SR / 2), 0.999), 'low')
    return signal.lfilter(b, a, x)

def _hp(x, f, order=4):
    b, a = signal.butter(order, max(f / (SR / 2), 1e-4), 'high')
    return signal.lfilter(b, a, x)

def _bp(x, lo, hi, order=4):
    ny = SR / 2
    hi = min(hi, ny * 0.96)
    lo = min(max(lo, 20.0), hi * 0.9)                 # luôn giữ lo < hi < Nyquist
    b, a = signal.butter(order, [lo / ny, hi / ny], 'band')
    return signal.lfilter(b, a, x)

def _noise(n, seed=None):
    return np.random.default_rng(seed).standard_normal(n)

def _sine(freq, n, phase=0.0):
    if np.isscalar(freq):
        return np.sin(2 * np.pi * freq * np.arange(n) / SR + phase)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR + phase)      # freq biến thiên

def _glide(f0, f1, n, curve='exp'):
    x = np.linspace(0, 1, n)
    return f0 * (f1 / f0) ** x if curve == 'exp' else f0 + (f1 - f0) * x


# ---------------------------------------------------------------- nguồn tiếng
# Mỗi hàm trả về mảng mono; hàm gọi sẽ đặt vào đúng mốc thời gian.

def sub_impact(gain=1.0, dur=0.55, f0=95, f1=38):
    n = int(dur * SR)
    body = _sine(_glide(f0, f1, n), n) * _exp(n, 0.13)
    click = _hp(_noise(n, 7), 1800) * _exp(n, 0.006) * 0.35
    return (body * 0.95 + click) * gain

def riser(dur=1.4, gain=0.5):
    """Tiếng dâng dần trước một cú va — dùng mở thẻ tiêu đề."""
    n = int(dur * SR)
    nz = _noise(n, 11)
    out = np.zeros(n)
    step = n // 24
    for i in range(24):                                   # quét dải thông lên cao
        lo = min(220 * (1.22 ** i), 9000)
        seg = slice(i * step, (i + 1) * step)
        out[seg] = _bp(nz, lo, lo * 1.9)[seg]
    shape = (np.linspace(0, 1, n) ** 2.2)
    tone = _sine(_glide(140, 620, n), n) * 0.25
    return (out * 1.6 + tone) * shape * gain

def ui_click(gain=0.35):
    n = int(0.05 * SR)
    nz = _bp(_noise(n, 23), 1200, 5200) * _exp(n, 0.008)
    ping = _sine(2100, n) * _exp(n, 0.012) * 0.4
    return (nz + ping) * gain

def key_tick(gain=0.20, seed=0):
    n = int(0.035 * SR)
    rng = np.random.default_rng(seed)
    f = rng.uniform(2400, 4200)
    nz = _bp(_noise(n, seed + 1), f * 0.6, f * 2.2) * _exp(n, 0.004)
    return nz * gain * rng.uniform(0.7, 1.15)

def lock_thud(gain=1.0):
    """Cổng đóng: cú trầm + tiếng chốt kim loại + quãng hai thứ nghịch tai."""
    n = int(1.1 * SR)
    low = _sine(_glide(120, 44, n), n) * _exp(n, 0.16)
    clack = _bp(_noise(n, 31), 900, 4800) * _exp(n, 0.02) * 0.5
    dis = (_sine(110, n) + _sine(116.5, n)) * _exp(n, 0.35) * 0.13
    return (low + clack + dis) * gain

def deny_buzz(gain=0.5):
    """Thao tác bị từ chối — dán vào ô cam kết chẳng hạn."""
    n = int(0.26 * SR)
    sq = signal.square(2 * np.pi * 146 * np.arange(n) / SR, 0.5)
    gate = (signal.square(2 * np.pi * 34 * np.arange(n) / SR) > 0).astype(float)
    return _lp(sq * gate, 2600) * _env(n, 0.003, 0.05, 0.6, 0.12) * gain

def unlock_chime(gain=0.6, root=587.33):
    """Cổng mở: chuông FM sáng, ba nốt dâng lên (D5 · A5 · D6)."""
    out = np.zeros(int(1.9 * SR))
    for k, (mult, delay, amp) in enumerate([(1.0, 0.0, 1.0), (1.5, 0.075, 0.8), (2.0, 0.15, 0.62)]):
        n = int(1.5 * SR)
        car, mod = root * mult, root * mult * 2.01
        idx = 2.6 * _exp(n, 0.16)
        x = np.sin(2 * np.pi * car * np.arange(n) / SR + idx * np.sin(2 * np.pi * mod * np.arange(n) / SR))
        x *= _exp(n, 0.42) * amp
        s = int(delay * SR)
        out[s:s + n] += x
    return out * gain

def loss_drop(gain=0.7):
    """Chuỗi ngày về 0 — trượt xuống, mất mát."""
    n = int(1.3 * SR)
    g = _sine(_glide(520, 82, n), n) * _exp(n, 0.3)
    shimmer = _bp(_noise(n, 41), 400, 3000) * _exp(n, 0.1) * 0.25
    return (g * 0.8 + shimmer) * gain

def clock_tick(gain=0.28, hi=False):
    n = int(0.04 * SR)
    f = 1650 if hi else 1150
    x = _sine(f, n) * _exp(n, 0.007) + _bp(_noise(n, 53), 2000, 7000) * _exp(n, 0.004) * 0.5
    return x * gain

def ping(gain=0.4, f=1760, dur=0.5):
    n = int(dur * SR)
    return (_sine(f, n) + _sine(f * 2, n) * 0.3) * _exp(n, 0.1) * gain

def whoosh(dur=0.7, gain=0.32, rev=False):
    n = int(dur * SR)
    nz = _noise(n, 67)
    out = np.zeros(n)
    step = max(1, n // 20)
    for i in range(20):
        lo = min(260 * (1.3 ** (19 - i if rev else i)), 8500)
        seg = slice(i * step, min((i + 1) * step, n))
        out[seg] = _bp(nz, lo, lo * 2.4)[seg]
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return out * shape * gain

def chord_pad(dur, freqs, gain=0.16, detune=0.004):
    """Nền hợp âm mềm — ba lớp răng cưa lệch nhau, lọc thông thấp động."""
    n = int(dur * SR)
    out = np.zeros(n)
    for i, f in enumerate(freqs):
        for d in (-detune, 0.0, detune):
            ph = np.cumsum(np.full(n, f * (1 + d))) / SR
            out += signal.sawtooth(2 * np.pi * ph) / (len(freqs) * 3)
    lfo = 620 + 380 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * np.arange(n) / SR))
    # lọc theo từng khối để mô phỏng cutoff động mà vẫn nhanh
    blk = SR // 4
    y = np.zeros(n)
    for s in range(0, n, blk):
        e = min(s + blk, n)
        y[s:e] = _lp(out[s:e], float(lfo[s]))
    return y * _env(n, 0.9, 0.5, 1.0, 1.2) * gain


# ---------------------------------------------------------------- không gian

def reverb(x, dur=1.1, mix=0.22, pre=0.02):
    """Vang ngắn bằng cách nhân chập với nhiễu tắt dần — đủ để tiếng có chiều sâu."""
    n = int(dur * SR)
    ir = _noise(n, 97) * np.exp(-np.arange(n) / (0.26 * SR))
    ir = _bp(ir, 260, 7000)
    ir /= np.abs(ir).sum() / 8
    wet = signal.fftconvolve(x, ir)[:len(x) + int(pre * SR)]
    out = np.zeros(len(x) + int(pre * SR))
    out[:len(x)] += x * (1 - mix)
    out[int(pre * SR):int(pre * SR) + len(wet) - int(pre * SR)] += wet[:len(wet) - int(pre * SR)] * mix
    return out[:len(x)]


# ---------------------------------------------------------------- bản phối

class Track:
    """Khung thời gian stereo: đặt từng tiếng vào đúng giây, rồi xuất WAV."""

    def __init__(self, dur):
        self.n = int(dur * SR)
        self.buf = np.zeros((2, self.n))

    def put(self, t, x, gain=1.0, pan=0.0):
        s = int(t * SR)
        if s >= self.n:
            return self
        x = np.asarray(x)[: self.n - s]
        l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
        self.buf[0, s:s + len(x)] += x * gain * l * 1.414
        self.buf[1, s:s + len(x)] += x * gain * r * 1.414
        return self

    def mix(self, other, gain=1.0):
        n = min(self.n, other.n)
        self.buf[:, :n] += other.buf[:, :n] * gain
        return self

    def space(self, **kw):
        for c in (0, 1):
            self.buf[c] = reverb(self.buf[c], **kw)
        return self

    def peak_to(self, db=-1.0):
        p = np.abs(self.buf).max()
        if p > 0:
            self.buf *= (10 ** (db / 20)) / p
        return self

    def save(self, path):
        from scipy.io import wavfile
        x = np.clip(self.buf.T, -1, 1)
        wavfile.write(path, SR, (x * 32767).astype(np.int16))
        return path
