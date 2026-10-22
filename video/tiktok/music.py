"""Nhạc nền + hiệu ứng tự tổng hợp (không mẫu, không bản quyền).
100 BPM, La thứ Am–F–C–G. Beat "đổ" đúng khoảnh khắc trang chặn đập vào màn hình;
đoạn lối thoát khẩn cấp lọc tối + nhịp tim; xong việc thì mở sáng trở lại."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from paths import ROOT, WORK, SCRIPT  # noqa: E402
import json, numpy as np, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from synth import (Track, SR, sub_impact, ui_click, key_tick, lock_thud, deny_buzz, unlock_chime,
                   loss_drop, clock_tick, ping, whoosh, riser, _lp, _hp, _bp, _noise, _exp, reverb)
from scipy import signal
T = json.load(open(WORK + '/timeline.json')); M = json.load(open(WORK + '/clips/marks.json'))
cue = T['cues']; END = T['end']; BEAT = 0.6; SLAM = cue['slam']
ESC0, ESC1 = T['cut']['escape'], T['cut']['done']; ALLDONE = cue['alldone']; CTA = cue['cta']
rng = np.random.default_rng(7)

# ---------------- nhạc cụ
def kick(g=1.0):
    n = int(.42 * SR); f = 50 + 110 * np.exp(-np.arange(n) / (.035 * SR))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-np.arange(n) / (.16 * SR))
    click = _hp(_noise(n, 1), 2500) * np.exp(-np.arange(n) / (.004 * SR)) * .25
    return np.tanh((body + click) * 1.6) * g
def clap(g=.5):
    n = int(.35 * SR); nz = _bp(_noise(n, 2), 900, 7000); env = np.zeros(n)
    for d in (0, .011, .022): s = int(d * SR); env[s:] += np.exp(-np.arange(n - s) / (.012 * SR))
    env += np.exp(-np.arange(n) / (.09 * SR)) * .5
    return nz * env * g
def hat(g=.12, open_=False):
    n = int((.22 if open_ else .05) * SR)
    return _hp(_noise(n, int(rng.integers(1e6))), 7000) * np.exp(-np.arange(n) / ((.07 if open_ else .012) * SR)) * g
def pluck(f, g=.18, dur=.5):
    n = int(dur * SR); t = np.arange(n) / SR; idx = 3.2 * np.exp(-t / .05)
    return np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 2 * t)) * np.exp(-t / .16) * g
def saw_pad(freqs, dur, g=.1, cutoff=1400):
    n = int(dur * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for f in freqs:
        for d in (-.006, 0, .006): x += signal.sawtooth(2 * np.pi * f * (1 + d) * t + rng.uniform(0, 6))
    x = _lp(x / (3 * len(freqs)), cutoff)
    env = np.minimum(1, t / .06) * np.minimum(1, (dur - t) / .08).clip(0)
    return x * env * g
def bass(f, dur, g=.34):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + .25 * np.sin(2 * np.pi * 2 * f * t)
    return np.tanh(x * 1.3) * np.minimum(1, t / .01) * np.minimum(1, (dur - t) / .04).clip(0) * g

CH = [  # (bass Hz, pad Hz, arp Hz)
    (55.00, [220.0, 261.63, 329.63], [440.0, 523.25, 659.25, 523.25]),   # Am
    (43.65, [174.61, 220.0, 261.63], [349.23, 440.0, 523.25, 440.0]),    # F
    (65.41, [261.63, 329.63, 392.0], [523.25, 659.25, 783.99, 659.25]),  # C
    (49.00, [196.0, 246.94, 293.66], [392.0, 493.88, 587.33, 493.88])]   # G

def section(t):
    if t < SLAM: return 'intro'
    if ESC0 <= t < ESC1: return 'tension'
    if t >= END - 2.4: return 'outro'
    return 'full'

mus = Track(END); pads = Track(END); bas = Track(END)
t_beat0 = SLAM - int(SLAM / BEAT) * BEAT        # lưới nhịp khớp đúng cú "đập"
k = 0; t = t_beat0
while t < END:
    bar_i = int(round((t - SLAM) / BEAT)) // 4; beat_in_bar = int(round((t - SLAM) / BEAT)) % 4
    sec = section(t); bass_f, pad_f, arp = CH[bar_i % 4]
    if beat_in_bar == 0 and t + 4 * BEAT > 0:   # đầu ô nhịp: pad + bass
        cut = {'intro': 900, 'tension': 420, 'full': 1500, 'outro': 1300}[sec]
        gpad = {'intro': .24, 'tension': .07, 'full': .10, 'outro': .10}[sec]
        pads.put(max(0, t), saw_pad(pad_f, 4 * BEAT + .1, gpad, cut)[int(max(0, -t) * SR):])
    if sec in ('full', 'outro'):
        if beat_in_bar in (0, 2): mus.put(t, kick(.95))
        if beat_in_bar == 3: mus.put(t + BEAT / 2, kick(.55))
        if beat_in_bar in (1, 3): mus.put(t, clap(.42), pan=.05)
        for s16 in range(4):
            tt = t + s16 * BEAT / 4
            mus.put(tt, hat(.10 if s16 % 2 else .06, open_=(s16 == 2 and beat_in_bar == 3)), pan=.25)
            note = arp[(beat_in_bar * 4 + s16) % 4] * (2 if s16 == 3 else 1)
            mus.put(tt, pluck(note, .085 if s16 % 2 else .11), pan=-.3 + .2 * (s16 % 2))
        bas.put(t, bass(bass_f, BEAT * .92))
    elif sec == 'intro' and t >= 0:
        for s8 in range(4): mus.put(t + s8 * BEAT / 4, hat(.09 if s8 % 2 else .05), pan=.25)
        mus.put(t, pluck(arp[beat_in_bar % 4], .16, .8), pan=-.2); mus.put(t, kick(.35)) if beat_in_bar == 0 else None
    elif sec == 'tension':
        if beat_in_bar == 0: mus.put(t, kick(.55))
        mus.put(t, hat(.04), pan=.3)
        bas.put(t, bass(bass_f * .5 * 2, BEAT * .9, .18))
    t += BEAT; k += 1

# bơm sidechain: pad + bass nhún theo kick (cảm giác "thở" của nhạc điện tử)
duck = np.ones(mus.n); t = SLAM
while t < END:
    if section(t) in ('full', 'outro'):
        s = int(t * SR); n = min(int(.28 * SR), mus.n - s)
        if n > 0: duck[s:s + n] = np.minimum(duck[s:s + n], .45 + .55 * (np.arange(n) / n) ** .6)
    t += BEAT * 2
pads.buf *= duck; bas.buf *= duck
pads.space(dur=1.4, mix=.3)
mus.mix(pads, 1.0).mix(bas, 1.0)
mus.put(max(0, SLAM - 2.3), riser(2.3, .30))                        # dâng lên tới cú đập
mus.put(ESC1 - 1.5, riser(1.5, .22))                                  # dâng lên lúc thoát khỏi đoạn căng
# đoạn căng: nhịp tim nhanh dần
t, step = ESC0 + .3, .62
while t < ESC1 - .2:
    mus.put(t, sub_impact(.26, dur=.35, f0=62, f1=40)); step = max(.34, step * .93); t += step
# kết: fade 1,2 s cuối
n = int(1.2 * SR); mus.buf[:, -n:] *= np.linspace(1, 0, n) ** 1.5
mus.peak_to(-6.0).save(WORK + '/out/music.wav')

# ---------------- hiệu ứng (đặt theo mốc hình)
fx = Track(END)
def typing(t0, t1, step, g=.16):
    t = t0
    while t < t1: fx.put(t, key_tick(g, seed=int(t * 997) % 9973), pan=rng.uniform(-.2, .2)); t += step * rng.uniform(.75, 1.25)
S = {s['clip'] + str(i): s for i, s in enumerate(T['shots'])}
setup = next(s for s in T['shots'] if s['scene'] == 'setup')
a2 = lambda sh, src: sh['a'] + (src - sh['src_in']) / sh['speed']
fx.put(cue['slam'], lock_thud(1.0)); fx.put(cue['slam'], sub_impact(.9))
typing(a2(setup, M['t2-ghi-viec']['ready'] + .1), a2(setup, M['t2-ghi-viec']['typed']), .06)
fx.put(cue['add_task'], ui_click(.4)); fx.put(cue['add_task'] + .05, ping(.14, 1318))
fx.put(cue['link_click'], ui_click(.45))
fx.put(cue['block_slam'], lock_thud(.8)); fx.put(cue['pull'], lock_thud(.7))
fx.put(cue['paste'], deny_buzz(.5))
typing(cue['typing'][0], cue['typing'][1], .045, .13)
t = cue['countdown'][0]; n = 0
while t < cue['countdown'][1]: fx.put(t, clock_tick(.2, hi=n % 2 == 1)); t += .058; n += 1
fx.put(cue['confirm'] - .06, ui_click(.45)); fx.put(cue['confirm'], sub_impact(.85)); fx.put(cue['confirm'] + .05, loss_drop(.65))
for k in ('tick1', 'tick2'): fx.put(cue[k], ui_click(.42)); fx.put(cue[k] + .04, ping(.18, 1046 if k == 'tick1' else 1244))
fx.put(cue['alldone'], unlock_chime(.62)); fx.put(cue['alldone'], sub_impact(.45))
fx.put(cue['back'], whoosh(.45, .18))
popup = next(s for s in T['shots'] if s['scene'] == 'popup')
for src in (M['t6-popup']['tick1'], M['t6-popup']['tick2']):
    tt = a2(popup, src); fx.put(tt, ui_click(.4)); fx.put(tt + .04, ping(.16, 1397))
fx.put(T['cut']['mac'] + .1, sub_impact(.5))
fx.put(T['cut']['cta'] + .05, sub_impact(.7)); fx.put(T['cut']['cta'] + .35, unlock_chime(.36))
for c in cue['cuts']: fx.put(max(0, c - .18), whoosh(.5, .22))
fx.space(dur=.8, mix=.14).peak_to(-3.0).save(WORK + '/out/sfx.wav')
print('✓ music.wav · sfx.wav', f'{END:.2f}s')
