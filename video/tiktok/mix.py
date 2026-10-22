"""Trộn tiếng: giọng đọc (rõ nhất) + nhạc tự hạ khi có lời (sidechain) + hiệu ứng;
chuẩn hoá -14 LUFS (mức TikTok), đỉnh thực ≤ -1,5 dBTP. Burn phụ đề ở lần mã hoá cuối."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from paths import ROOT, WORK, SCRIPT  # noqa: E402
import json, subprocess, re
R = WORK; T = json.load(open(f'{R}/timeline.json'))
def ff(a, cap=False):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-y', *a], capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr[-2500:])
    return r.stderr
# 1) dải giọng: mỗi câu đặt đúng mốc
ins, parts = [], []
for i, l in enumerate(T['lines']):
    ins += ['-i', f"{R}/{l['file']}"]; ms = int(round(l['start'] * 1000))
    parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=mono,adelay={ms}:all=1[v{i}]")
fc = ';'.join(parts) + ';' + ''.join(f'[v{i}]' for i in range(len(T['lines']))) + \
     f"amix=inputs={len(T['lines'])}:normalize=0:dropout_transition=0,apad,atrim=0:{T['end']},aformat=channel_layouts=stereo[o]"
ff([*ins, '-filter_complex', fc, '-map', '[o]', '-ar', '48000', f'{R}/out/vo.wav'])
# 2) trộn
chain = ("[0:a]highpass=f=75,equalizer=f=260:t=q:w=1.2:g=-2.5,equalizer=f=3600:t=q:w=1.0:g=2.5,"
         "acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2,asplit=2[voA][voB];"
         "[1:a]volume=0.62[mus];[mus][voB]sidechaincompress=threshold=0.025:ratio=8:attack=15:release=380:makeup=1[md];"
         "[2:a]volume=0.72[fx];[voA][md][fx]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.9:level=0[pre]")
inputs = ['-i', f'{R}/out/vo.wav', '-i', f'{R}/out/music.wav', '-i', f'{R}/out/sfx.wav']
log = ff([*inputs, '-filter_complex', chain + ';[pre]loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json[m]', '-map', '[m]', '-f', 'null', '-'])
j = json.loads(re.search(r'\{[^{}]*"target_offset"[^{}]*\}', log).group(0))
ln = (f"loudnorm=I=-14:TP=-1.5:LRA=9:measured_I={j['input_i']}:measured_TP={j['input_tp']}:"
      f"measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
ff([*inputs, '-filter_complex', chain + f';[pre]{ln},alimiter=limit=0.8:level=0,aresample=48000[a]', '-map', '[a]',
    '-ac', '2', '-ar', '48000', f'{R}/out/mix.wav'])
# 3) xuất bản cuối: hình + phụ đề burn + tiếng AAC
ff(['-i', f'{R}/out/video_nosub.mp4', '-i', f'{R}/out/mix.wav',
    '-vf', f"subtitles={R}/out/sub.ass:fontsdir={R}/fonts", '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60',
    '-profile:v', 'high', '-level', '4.1', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart', f'{R}/out/FocusGate-TikTok.mp4'])
ff(['-i', f'{R}/out/FocusGate-TikTok.mp4', '-frames:v', '1', f'{R}/out/FocusGate-TikTok-cover.png'])
print('✓ out/FocusGate-TikTok.mp4')
