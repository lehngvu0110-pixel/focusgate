#!/usr/bin/env python3
"""
Tạo giọng đọc cho video FocusGate từ video/vo-script.json.

    python3 video/tts.py                       # cả 4 dải (Việt + Anh, 2 video)
    python3 video/tts.py vi                    # chỉ tiếng Việt
    python3 video/tts.py --engine say          # dùng giọng có sẵn của macOS
    python3 video/tts.py --voice-vi vi-VN-HoaiMyNeural --rate +6%

Hai bộ máy đọc:
  edge  (mặc định)  giọng neural của Microsoft — tự nhiên nhất cho tiếng Việt.
                    Cần mạng và gói edge-tts:  pip3 install --user edge-tts
  say               lệnh say có sẵn trong macOS, chạy ngoại tuyến.
                    Giọng Việt tên "Linh" — nếu chưa có thì tải ở
                    Cài đặt hệ thống → Trợ năng → Nội dung nói → Giọng nói hệ thống.

Mỗi câu ra một tệp riêng trong video/audio/vo-src/ theo đúng thứ tự trong
vo-script.json; video/vo.mjs sẽ xếp chúng vào đúng mốc thời gian sau.
"""
import argparse, json, os, subprocess, sys, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'audio', 'vo-src')

DEFAULT = {
    'edge': {'vi': 'vi-VN-NamMinhNeural', 'en': 'en-US-AndrewNeural'},
    'say':  {'vi': 'Linh',                'en': 'Samantha'},
}

ap = argparse.ArgumentParser(add_help=True)
ap.add_argument('picks', nargs='*', help='demo · escape · vi · en (bỏ trống = tất cả)')
ap.add_argument('--engine', choices=['edge', 'say'], default='edge')
ap.add_argument('--voice-vi'); ap.add_argument('--voice-en')
ap.add_argument('--rate', default='+0%', help='tốc độ đọc cho edge-tts, ví dụ +8%%')
ap.add_argument('--pitch', default='+0Hz')
a = ap.parse_args()

script = json.load(open(os.path.join(HERE, 'vo-script.json'), encoding='utf-8'))
stories = [s for s in ('demo', 'escape') if s in a.picks] or ['demo', 'escape']
langs = [l for l in ('vi', 'en') if l in a.picks] or ['vi', 'en']
voice = {'vi': a.voice_vi or DEFAULT[a.engine]['vi'], 'en': a.voice_en or DEFAULT[a.engine]['en']}

if a.engine == 'edge':
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        print('  ✗ Chưa có gói edge-tts. Cài bằng:  pip3 install --user edge-tts')
        print('    Hoặc dùng giọng sẵn của macOS:  python3 video/tts.py --engine say')
        sys.exit(1)
elif not shutil.which('say'):
    print('  ✗ Không tìm thấy lệnh say — chỉ macOS mới có.')
    sys.exit(1)

os.makedirs(OUT, exist_ok=True)


def with_edge(text, v, path):
    import asyncio, edge_tts
    async def go():
        await edge_tts.Communicate(text, v, rate=a.rate, pitch=a.pitch).save(path)
    asyncio.run(go())


def with_say(text, v, path):
    r = subprocess.run(['say', '-v', v, '-o', path, '--data-format=LEF32@48000', text],
                       capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip() or 'lệnh say thất bại')


total = ok = 0
for story in stories:
    for lang in langs:
        v = voice[lang]
        lines = script[story][lang]
        print(f'\n▸ {story} · {lang} · giọng {v} — {len(lines)} câu')
        for i, l in enumerate(lines, 1):
            ext = 'mp3' if a.engine == 'edge' else 'aiff'
            path = os.path.join(OUT, f'{story}-{lang}-{i:02d}.{ext}')
            total += 1
            try:
                (with_edge if a.engine == 'edge' else with_say)(l['text'], v, path)
                ok += 1
                print(f'   {i:02d} ✓ {l["text"][:58]}')
            except Exception as e:
                print(f'   {i:02d} ✗ {type(e).__name__}: {e}')
                if a.engine == 'edge' and ok == 0:
                    print('\n  Không kết nối được dịch vụ giọng của Microsoft.')
                    print('  Thử lại với giọng sẵn của máy:  python3 video/tts.py --engine say')
                    sys.exit(1)

print(f'\n{ok}/{total} câu đã tạo trong video/audio/vo-src/')
print('Bước tiếp theo:  node video/vo.mjs   rồi   node video/mux.mjs')
