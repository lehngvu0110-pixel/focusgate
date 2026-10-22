"""Đường dẫn dùng chung cho pipeline clip TikTok.
Mọi thứ sinh ra (mô hình giọng, font, footage, âm thanh, video) nằm trong WORK — đã gitignore."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))          # gốc repo
WORK = os.environ.get('FG_TT_DIR', os.path.join(HERE, 'work'))
SCRIPT = os.path.join(HERE, 'script.json')
for d in ('models', 'fonts', 'clips', 'vo/lines', 'assets', 'cut', 'out'):
    os.makedirs(os.path.join(WORK, d), exist_ok=True)
os.chdir(WORK)                                                    # các đường dẫn tương đối tính từ WORK
