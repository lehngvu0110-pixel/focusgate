"""Dựng hình: mỗi cảnh quay một lệnh ffmpeg (nền + footage trong cửa sổ bo góc + tiêu đề), nối lại,
rồi xuất phụ đề ASS/SRT khớp giọng. Phụ đề được burn ở bước cuối cùng (sau khi trộn tiếng)."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from paths import ROOT, WORK, SCRIPT  # noqa: E402
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
R = WORK; A = f'{R}/assets'; CL = f'{R}/clips'; OUT = f'{R}/cut'
T = json.load(open(f'{R}/timeline.json')); os.makedirs(OUT, exist_ok=True)
FPS = 30; WX, WY, WW, WH = 60, 400, 960, 1180

def ff(args): subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)

# nhãn tua nhanh theo đúng hệ số thật
from assets import pill
pill(f"TUA NHANH ×{T['fast_factor']:.0f}", f'{A}/tag-fast.png')

first_of_scene = set(); seen = set()
for i, s in enumerate(T['shots']):
    if s['scene'] not in seen: first_of_scene.add(i); seen.add(s['scene'])

segs = []
for i, s in enumerate(T['shots']):
    D = s['b'] - s['a']; z0, z1 = s.get('zoom', (1, 1)); fx, fy = s.get('focus', (0.5, 0.5))
    Z = f"({z0}+({z1}-{z0})*t/{D:.3f}"
    if 'pulse' in s:                      # cú "đập" khi trang chặn hiện ra: phóng 9% rồi thu về trong 0,28 s
        tp = s['pulse'] - s['a']; Z += f"+if(gte(t,{tp:.3f}),0.09*max(0,1-(t-{tp:.3f})/0.28),0)"
    Z += ")"
    if s['clip'] == 'endcard':
        src = ['-loop', '1', '-framerate', str(FPS), '-t', f'{D + .1:.3f}', '-i', f'{A}/endcard.png']; pre = ''
    else:
        path = f'{CL}/{s["clip"]}.mp4' if os.path.exists(f'{CL}/{s["clip"]}.mp4') else f'{ROOT}/video/clips/{s["clip"]}.webm'
        src = ['-ss', f"{s['src_in']:.3f}", '-t', f"{D * s['speed'] + .4:.3f}", '-i', path]
        pre = f"setpts=(PTS-STARTPTS)/{s['speed']},fps={FPS},"
        if s['clip'] == 'e-desktop': pre += f'scale={WW}:-2:flags=lanczos,crop={WW}:{WH},'
    title = f"{A}/title-{s['scene']}.png"
    tfade = ',fade=in:st=0:d=0.18:alpha=1' if (i in first_of_scene and i > 0) else ''
    ins = ['-loop', '1', '-framerate', str(FPS), '-t', f'{D:.3f}', '-i', f'{A}/bg.png', *src,
           '-loop', '1', '-framerate', str(FPS), '-t', f'{D:.3f}', '-i', f'{A}/frame.png',
           '-loop', '1', '-framerate', str(FPS), '-t', f'{D:.3f}', '-i', title]
    fc = (f"[1:v]{pre}scale=w='2*trunc({WW}*{Z}/2)':h='2*trunc({WH}*{Z}/2)':eval=frame:flags=lanczos,"
          f"crop={WW}:{WH}:x='(iw-{WW})*{fx}':y='(ih-{WH})*{fy}',setsar=1[v];"
          f"[0:v][v]overlay={WX}:{WY}:shortest=0[a];[a][2:v]overlay=0:0[b];[3:v]format=rgba{tfade}[t];[b][t]overlay=0:0[c]")
    last = 'c'
    if s.get('tag'):
        ins += ['-loop', '1', '-framerate', str(FPS), '-t', f'{D:.3f}', '-i', f'{A}/tag-fast.png']
        fc += f";[c][4:v]overlay=W-60-w-18:{WY + 20}[d]"; last = 'd'
    fc += f";[{last}]trim=duration={D:.3f},setpts=PTS-STARTPTS,format=yuv420p[o]"
    seg = f'{OUT}/{i:02d}-{s["scene"]}.mp4'; segs.append(seg)
    import hashlib; key = hashlib.sha1((json.dumps(ins) + fc + str(os.path.getmtime(title))).encode()).hexdigest()
    if os.path.exists(seg) and os.path.exists(seg + '.key') and open(seg + '.key').read() == key:
        print(f'  · {os.path.basename(seg)} (không đổi)'); continue
    ff([*ins, '-filter_complex', fc, '-map', '[o]', '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium',
        '-crf', '15', '-pix_fmt', 'yuv420p', '-g', '60', seg])
    open(seg + '.key', 'w').write(key); print(f'  ✓ {os.path.basename(seg)}  {D:.2f}s')

with open(f'{OUT}/list.txt', 'w') as f: f.write(''.join(f"file '{p}'\n" for p in segs))
ff(['-f', 'concat', '-safe', '0', '-i', f'{OUT}/list.txt', '-c', 'copy', f'{R}/out/video_nosub.mp4'])

# ---------------- phụ đề
def ts_ass(t): h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60; return f'{h}:{m:02d}:{s:05.2f}'
def ts_srt(t): ms = int(round(t * 1000)); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
events = []
lines = T['lines']
for k, l in enumerate(lines):
    nxt = lines[k + 1]['start'] if k + 1 < len(lines) else T['end']
    for j, c in enumerate(l['chunks']):
        a = l['start'] + c['t0'] - 0.04
        b = l['start'] + c['t1'] - 0.06 if j + 1 < len(l['chunks']) else min(l['end'] + 0.3, nxt - 0.06)  # không chồng hai cụm
        mid = (a + b) / 2
        sh = next((x for x in T['shots'] if x['a'] <= mid < x['b']), {})
        events.append((round(a, 3), round(b, 3), c['show'], sh.get('sub_y', 1530)))
def styl(text):  # số liệu tô vàng cảnh báo (#FFB020) — ASS dùng thứ tự BGR
    return re.sub(r'(\d+)', r'{\\c&H20B0FF&}\1{\\c&HF6F2F2&}', text)
hdr = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Be Vietnam Pro ExtraBold,58,&H00F6F2F2,&H000000FF,&H300C0808,&H00000000,0,0,0,0,100,100,0,0,3,15,0,2,110,150,400,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
with open(f'{R}/out/sub.ass', 'w') as f:
    f.write(hdr)
    for a, b, t, y in events:
        f.write(f"Dialogue: 0,{ts_ass(a)},{ts_ass(b)},Sub,,0,0,{1920 - y},,{{\\fscx86\\fscy86\\t(0,110,\\fscx100\\fscy100)}}{styl(t)}\n")
with open(f'{R}/out/FocusGate-TikTok.srt', 'w') as f:
    for n, (a, b, t, _) in enumerate(events, 1): f.write(f'{n}\n{ts_srt(a)} --> {ts_srt(b)}\n{t}\n\n')
print(f'phụ đề: {len(events)} cụm')
