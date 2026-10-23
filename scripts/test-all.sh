#!/usr/bin/env bash
# Chạy toàn bộ bộ kiểm thử FocusGate
set -u
# Không có pipefail thì "lệnh | tail" luôn trả mã của tail, bài hỏng vẫn bị báo là đạt.
set -o pipefail
cd "$(dirname "$0")/.."
FAIL=0
NOISE="dbus|Fontconfig|libva|GPU|MESA"

echo "════ 1/4  Kiểm thử đơn vị (lõi + desktop) ════"
node --test packages/core/test/*.test.js packages/desktop/test/*.test.js 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" || FAIL=1

echo ""
echo "════ 2/4  Extension trên Chromium thật ════"
node tests/e2e/run.mjs 2>&1 | tail -n +2 || FAIL=1

echo ""
echo "════ 3/4  App desktop trên Electron thật ════"
xvfb-run -a node tests/e2e/desktop.mjs 2>&1 | grep -vE "$NOISE" | tail -n +2 || FAIL=1

echo ""
echo "════ 4/4  Extension ⇄ desktop ════"
xvfb-run -a node tests/e2e/integration.mjs 2>&1 | grep -vE "$NOISE" | tail -n +2 || FAIL=1

echo ""
[ $FAIL -eq 0 ] && echo "TẤT CẢ ĐỀU ĐẠT ✓" || echo "CÓ BÀI KHÔNG ĐẠT ✗"
exit $FAIL
