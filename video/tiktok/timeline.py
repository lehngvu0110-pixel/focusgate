"""Dựng dòng thời gian: giọng đọc quyết định nhịp hình (không kéo giãn giọng theo hình).
Xuất timeline.json: mốc từng câu, từng cụm phụ đề, danh sách cảnh quay (nguồn, điểm vào, tốc độ) và mốc SFX."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from paths import ROOT, WORK, SCRIPT  # noqa: E402
import json
L = json.load(open(WORK + '/vo/lines.json')); M = json.load(open(WORK + '/clips/marks.json'))
LEAD, GAP, SCENE_GAP, TAIL = 0.15, 0.22, 0.45, 1.5

lines = L['lines']; t = LEAD; prev = None
for i, l in enumerate(lines):
    if prev is not None: t += SCENE_GAP if l['scene'] != prev else GAP
    l['start'] = round(t, 3); t += l['dur']; l['end'] = round(t, 3); prev = l['scene']
S = lambda i: lines[i - 1]['start']; E = lambda i: lines[i - 1]['end']
C = lambda i, j: lines[i - 1]['start'] + lines[i - 1]['chunks'][j]['t0']

first = {}; last = {}
for i, l in enumerate(lines, 1): first.setdefault(l['scene'], i); last[l['scene']] = i
order = [s['id'] for s in L['scenes']]
cut = {sc: (0.0 if k == 0 else round(S(first[sc]) - 0.2, 3)) for k, sc in enumerate(order)}
END = round(E(len(lines)) + TAIL, 3)
nxt = lambda sc: cut[order[order.index(sc) + 1]] if order.index(sc) + 1 < len(order) else END

shots = []
def shot(scene, clip, a, b, src_in=None, speed=1.0, align=None, fit=None, **kw):
    """align=(src_t, abs_t): khớp một khoảnh khắc nguồn vào đúng mốc giọng. fit=(src_a, src_b): nén đoạn nguồn vừa [a,b]."""
    if align: src_in = align[0] - (align[1] - a) * speed
    if fit: src_in = fit[0]; speed = (fit[1] - fit[0]) / (b - a)
    assert src_in >= -1e-6, (scene, clip, src_in)
    shots.append(dict(scene=scene, clip=clip, a=round(a, 3), b=round(b, 3), src_in=round(max(0, src_in), 3), speed=round(speed, 4), **kw))

import subprocess, numpy as np
def flip(clip, near, crop='crop=960:300:0:250'):
    """Khung hình đầu tiên trang đổi hẳn (sáng→tối hoặc ngược lại) quanh một mốc — chính xác tới từng khung."""
    t0 = near - 0.3
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(t0), '-i', f'{WORK}/clips/{clip}.mp4',
                          '-t', '1.6', '-vf', crop + ',scale=96:30,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, 30, 96).astype(int); d = np.abs(np.diff(a, axis=0)).mean((1, 2))
    return round(t0 + (int(np.argmax(d)) + 1) / 30, 3)
m1, m2, m3, m4, m5, m6 = (M[k] for k in ('t1-keo-ve', 't2-ghi-viec', 't3-bam-link', 't4-loi-thoat', 't5-xong-viec', 't6-popup'))
F1, F3, F5 = flip('t1-keo-ve', m1['blocked']), flip('t3-bam-link', m3['blocked']), flip('t5-xong-viec', m5['back'])
SLAM = E(1) + 0.04
shot('hook', 't1-keo-ve', 0, nxt('hook'), align=(F1, SLAM), pulse=SLAM, zoom=(1.0, 1.05))
shot('setup', 't2-ghi-viec', cut['setup'], nxt('setup'), fit=(1.55, 7.9), zoom=(1.0, 1.04))
b1_end = S(7) - 0.1
shot('block', 't3-bam-link', cut['block'], b1_end, align=(F3, C(6, 1)), pulse=C(6, 1), zoom=(1.0, 1.04))
FLIP2 = S(7) + 1.2
shot('block', 't1-keo-ve', b1_end, nxt('block'), align=(F1, FLIP2), pulse=FLIP2, zoom=(1.0, 1.04))
e1 = C(9, 0) - 0.05
shot('escape', 't4-loi-thoat', cut['escape'], e1, src_in=m4['cost'] - 0.4, zoom=(1.0, 1.05))
PASTE = C(9, 0) + 0.3
e2 = C(9, 1) - 0.05
shot('escape', 't4-loi-thoat', e1, e2, align=(m4['paste'], PASTE), zoom=(1.03, 1.06), sub_y=1300)
e3 = S(10) - 0.05
shot('escape', 't4-loi-thoat', e2, e3, fit=(m4['typeStart'], m4['typed'] + 0.1), zoom=(1.05, 1.05), fast=True)
e4 = C(10, 1) - 0.02
shot('escape', 't4-loi-thoat', e3, e4, fit=(m4['typed'] + 0.1, m4['ready'] + 0.35), zoom=(1.0, 1.0), tag=True)
CONFIRM = e4 + 0.12
shot('escape', 't4-loi-thoat', e4, nxt('escape'), align=(m4['confirm'], CONFIRM), zoom=(1.0, 1.05))
d1 = S(13) - 0.05; TICK2 = E(12) - 0.15
shot('done', 't5-xong-viec', cut['done'], d1, fit=(0.9, m5['tick2'] + (d1 - TICK2)), zoom=(1.0, 1.03), sub_y=1300)
ALLDONE = S(13) + 0.15
shot('done', 't5-xong-viec', d1, nxt('done'), align=(m5['allDone'], ALLDONE), zoom=(1.0, 1.04))
P1 = C(first['popup'], 0) + 1.1
shot('popup', 't6-popup', cut['popup'], nxt('popup'), align=(m6['tick1'], P1), zoom=(1.18, 1.22), focus=(0.5, 0.0), sub_y=1300)
shot('mac', 'e-desktop', cut['mac'], nxt('mac'), fit=(0.3, 6.6), zoom=(1.32, 1.4), focus=(0.5, 0.18))
shot('cta', 'endcard', cut['cta'], END, src_in=0, zoom=(1.0, 1.035))

# Tính lại mốc nguồn cho các sự kiện để đặt SFX đúng khung hình
def src2abs(sh, st): return sh['a'] + (st - sh['src_in']) / sh['speed']
sp = {s['clip'] + '@' + str(i): s for i, s in enumerate(shots)}
sh_escape = [s for s in shots if s['scene'] == 'escape']; sh_done = [s for s in shots if s['scene'] == 'done']
fast = next(s for s in shots if s.get('tag')); typing = next(s for s in shots if s.get('fast'))
cues = dict(
    slam=SLAM, block_slam=C(6, 1), pull=FLIP2, paste=PASTE,
    typing=[typing['a'] + 0.05, typing['b'] - 0.05], countdown=[fast['a'], fast['b']], confirm=CONFIRM,
    tick1=src2abs(sh_done[0], m5['tick1']), tick2=src2abs(sh_done[0], m5['tick2']), alldone=ALLDONE,
    link_click=C(6, 1) - (m3['blocked'] - m3['clicked']),
    add_task=src2abs(shots[1], m2['added']), popup_tick=P1,
    cuts=[cut[s] for s in order[1:]], end=END, cta=cut['cta'], back=src2abs(sh_done[1], F5))
json.dump(dict(end=END, lines=lines, shots=shots, cues=cues, cut=cut, fast_factor=round(fast['speed'], 1),
               titles={s['id']: s['title'] for s in L['scenes']}), open(WORK + '/timeline.json', 'w'), ensure_ascii=False, indent=1)
for s in shots: print(f"{s['scene']:7} {s['clip']:14} {s['a']:6.2f}→{s['b']:6.2f} ({s['b']-s['a']:4.2f}s) src {s['src_in']:6.2f} ×{s['speed']}")
print(f"TỔNG {END:.2f}s · tua nhanh ×{fast['speed']:.1f}")
