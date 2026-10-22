#!/bin/bash
# FocusGate — chuyển extension sang định dạng Safari (cần Xcode đầy đủ)
set -u
cd "$(dirname "$0")"
echo ""
echo "  FocusGate — tạo bản Safari"
echo ""
if ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "  ✗ Máy chưa cài Xcode đầy đủ (bản trên App Store, ~7 GB)."
  echo "    Safari bắt buộc phải có Xcode mới cài được extension."
  echo "    Nếu chỉ dùng Chrome thì bỏ qua bước này."
  read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng..."
  exit 1
fi
EXT="./extension"; [ -d "$EXT" ] || EXT="./packages/extension"
if [ ! -f "$EXT/manifest.json" ]; then
  echo "  ✗ Không thấy thư mục extension (cần extension/ hoặc packages/extension/ cạnh tệp này)."
  read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng..."
  exit 1
fi
OUT="$HOME/Desktop/FocusGate-Safari"
rm -rf "$OUT"
xcrun safari-web-extension-converter "$EXT" \
  --macos-only --no-prompt --copy-resources \
  --project-location "$OUT" --app-name "FocusGate" --bundle-identifier com.focusgate.safari
echo ""
echo "  ✓ Đã tạo project Xcode ở: $OUT"
echo ""
echo "    Bước tiếp theo:"
echo "    1. Mở FocusGate.xcodeproj trong thư mục đó."
echo "    2. Bấm nút ▶ (Run) để build và cài."
echo "    3. Safari → Cài đặt → Nâng cao → bật \"Hiện menu Phát triển\"."
echo "    4. Menu Phát triển → \"Cho phép tiện ích chưa ký\"."
echo "    5. Safari → Cài đặt → Tiện ích → bật FocusGate,"
echo "       rồi chọn \"Luôn cho phép trên mọi trang web\"."
echo ""
read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng..."
