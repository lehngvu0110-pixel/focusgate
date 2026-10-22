#!/bin/bash
# FocusGate — dựng app desktop ngay trên máy bạn (khuyến nghị)
set -u
cd "$(dirname "$0")"
echo ""
echo "  ┌────────────────────────────────────────────┐"
echo "  │   FocusGate — dựng app desktop cho macOS   │"
echo "  └────────────────────────────────────────────┘"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  ✗ Máy chưa có Node.js."
  echo "    Tải bản LTS tại https://nodejs.org rồi chạy lại tệp này."
  echo "    (Hoặc dùng Homebrew: brew install node)"
  read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng..."
  exit 1
fi
echo "  Node.js: $(node -v)"
echo ""
echo "  [1/4] Cài thư viện (lần đầu sẽ tải Electron ~130 MB, chờ vài phút)…"
npm install --no-audit --no-fund || { echo "  ✗ npm install thất bại."; read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng..."; exit 1; }

echo ""
echo "  [2/4] Dựng mã nguồn…"
npm run build || { echo "  ✗ build thất bại."; read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng..."; exit 1; }

echo ""
echo "  [3/4] Đóng gói FocusGate.app…"
npm run package:mac || { echo "  ✗ đóng gói thất bại."; read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng..."; exit 1; }

APP=$(find dist/mac -maxdepth 2 -name "FocusGate.app" -type d | head -1)
if [ -z "$APP" ]; then
  echo "  ✗ Không tìm thấy FocusGate.app sau khi đóng gói."
  read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng..."
  exit 1
fi

echo ""
echo "  [4/4] Chép vào /Applications và khởi chạy…"
xattr -cr "$APP" 2>/dev/null
codesign --force --deep --sign - "$APP" 2>/dev/null
rm -rf "/Applications/FocusGate.app" 2>/dev/null
cp -R "$APP" /Applications/ && open "/Applications/FocusGate.app"

echo ""
echo "  ✓ Xong! Biểu tượng ổ khoá đã nằm ở thanh menu trên cùng bên phải."
echo ""
echo "    Việc nên làm tiếp:"
echo "    • Bấm biểu tượng → Cài đặt… để chọn app cần chặn."
echo "    • Cài extension cho Chrome (mục 1 trong HUONG-DAN.md)."
echo "    • Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Trợ năng → bật FocusGate."
echo ""
read -n 1 -s -r -p "  Nhấn phím bất kỳ để đóng cửa sổ này..."
