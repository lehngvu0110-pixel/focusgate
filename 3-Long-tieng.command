#!/bin/bash
# FocusGate — thêm giọng đọc tiếng Việt vào 4 video TikTok
set -u
cd "$(dirname "$0")"
echo ""
echo "  ┌──────────────────────────────────────────────┐"
echo "  │   FocusGate — lồng tiếng cho video TikTok    │"
echo "  └──────────────────────────────────────────────┘"
echo ""

stop() { echo ""; read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng..."; echo ""; exit "${1:-1}"; }

for c in node ffmpeg python3; do
  command -v "$c" >/dev/null 2>&1 || MISSING="${MISSING:-} $c"
done
if [ -n "${MISSING:-}" ]; then
  echo "  ✗ Máy còn thiếu:${MISSING}"
  echo ""
  case "$MISSING" in *node*)   echo "    Node.js  → https://nodejs.org (bản LTS)";; esac
  case "$MISSING" in *ffmpeg*) echo "    ffmpeg   → brew install ffmpeg";;
  esac
  case "$MISSING" in *python3*) echo "    python3  → xcode-select --install";; esac
  echo ""
  echo "    Chưa có Homebrew? Dán dòng này vào Terminal trước:"
  echo '    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  stop 1
fi

ENGINE="edge"
echo "  [1/4] Chuẩn bị bộ máy đọc…"
if python3 -c "import edge_tts" >/dev/null 2>&1; then
  echo "        edge-tts: đã có"
else
  echo "        Đang cài edge-tts (giọng neural của Microsoft, ~2 MB)…"
  python3 -m pip install --user --quiet edge-tts 2>/dev/null \
    || python3 -m pip install --user --quiet --break-system-packages edge-tts 2>/dev/null
  if python3 -c "import edge_tts" >/dev/null 2>&1; then
    echo "        edge-tts: xong"
  else
    echo "        Không cài được edge-tts → chuyển sang giọng có sẵn của macOS."
    ENGINE="say"
  fi
fi

echo ""
echo "  [2/4] Đọc 44 câu thành tệp âm thanh…"
rm -rf video/audio/vo-src
if ! python3 video/tts.py --engine "$ENGINE"; then
  if [ "$ENGINE" = "edge" ]; then
    echo ""
    echo "        Thử lại bằng giọng có sẵn của macOS…"
    ENGINE="say"
    python3 video/tts.py --engine say || stop 1
  else
    stop 1
  fi
fi

echo ""
echo "  [3/4] Xếp từng câu vào đúng mốc thời gian…"
node video/vo.mjs || stop 1

echo ""
echo "  [4/4] Ghép tiếng vào video…"
node video/mux.mjs || stop 1

echo ""
echo "  ✓ Xong. Bốn tệp có giọng đọc nằm ở dist/video/:"
echo "      focusgate-tiktok-vi-co-tieng.mp4"
echo "      focusgate-tiktok-en-co-tieng.mp4"
echo "      focusgate-tiktok-loi-thoat-vi-co-tieng.mp4"
echo "      focusgate-tiktok-loi-thoat-en-co-tieng.mp4"
echo ""
if [ "$ENGINE" = "say" ]; then
  echo "    Lần này dùng giọng có sẵn của macOS. Giọng Việt tên \"Linh\" — nếu máy"
  echo "    chưa tải thì vào Cài đặt hệ thống → Trợ năng → Nội dung nói → Giọng nói"
  echo "    hệ thống → Tiếng Việt, tải về rồi chạy lại tệp này."
fi
echo "    Muốn đổi giọng hoặc tốc độ đọc:"
echo "      python3 video/tts.py --voice-vi vi-VN-HoaiMyNeural --rate +6%"
echo "      node video/vo.mjs && node video/mux.mjs"
echo ""
echo "    Muốn sửa lời: mở video/vo-script.json rồi chạy lại tệp này."
stop 0
