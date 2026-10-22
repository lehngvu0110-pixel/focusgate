#!/usr/bin/env bash
# Dựng lại clip TikTok từ đầu: quay footage → đọc giọng → dòng thời gian → hình → nhạc → trộn.
set -euo pipefail
cd "$(dirname "$0")"
node ../capture-tiktok.mjs                 # cần: npm run e2e:setup (Playwright)
python3 gen_vo.py --improve                # giọng đọc + kiểm chứng ASR
python3 assets.py                          # nền, khung, tiêu đề, thẻ kết
python3 timeline.py                        # giọng quyết định nhịp hình
python3 render.py                          # dựng từng cảnh + phụ đề
python3 music.py                           # nhạc nền + hiệu ứng
python3 mix.py                             # trộn -14 LUFS, burn phụ đề
echo "→ ${FG_TT_DIR:-$PWD/work}/out/FocusGate-TikTok.mp4"
