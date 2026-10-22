#!/usr/bin/env bash
# Tải những thứ pipeline clip TikTok cần (một lần): giọng đọc, mô hình nhận dạng để kiểm chứng, font.
set -euo pipefail
cd "$(dirname "$0")"; W="${FG_TT_DIR:-$PWD/work}"; mkdir -p "$W/models" "$W/fonts"
pip install --quiet sherpa-onnx soundfile numpy scipy pillow
REL=https://github.com/k2-fsa/sherpa-onnx/releases/download
get() { [ -d "$W/models/$1" ] || curl -fL --progress-bar "$REL/$2/$1.tar.bz2" | tar xj -C "$W/models"; }
get vits-piper-vi_VN-vais1000-medium tts-models          # giọng Việt, CC BY 4.0
get sherpa-onnx-zipformer-vi-2025-04-20 asr-models       # nhận dạng ngược để đo độ rõ (WER)
for w in SemiBold Bold ExtraBold; do
  f="$W/fonts/BeVietnamPro-$w.ttf"
  [ -f "$f" ] || curl -fsSL -o "$f" "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-$w.ttf"
done
echo "Xong. Thư mục làm việc: $W"
