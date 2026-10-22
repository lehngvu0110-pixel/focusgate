/** FocusGate Desktop — các tiện ích riêng cho macOS (an toàn trên hệ điều hành khác). */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

export const IS_MAC = process.platform === 'darwin';

async function osa(script, timeout = 4000) {
  if (!IS_MAC) return null;
  try {
    const { stdout } = await run('osascript', ['-e', script], { timeout });
    return stdout.trim();
  } catch {
    return null;   // thiếu quyền Accessibility hoặc script lỗi — coi như không làm gì
  }
}

/** Tên ứng dụng đang ở tiền cảnh. */
export function frontmostApp() {
  return osa('tell application "System Events" to get name of first application process whose frontmost is true');
}

/** Danh sách app đang chạy có giao diện. */
export async function runningApps() {
  const out = await osa('tell application "System Events" to get name of every application process whose background only is false');
  return out ? out.split(', ').map((s) => s.trim()).filter(Boolean) : [];
}

/** Ẩn một app (cần quyền Accessibility). Trả về true nếu có vẻ thành công. */
export async function hideApp(name) {
  const safe = String(name).replace(/["\\]/g, '');
  const out = await osa(`tell application "System Events" to set visible of process "${safe}" to false`);
  return out !== null;
}

/** Khớp tên app với danh sách chặn (không phân biệt hoa thường, khớp một phần). */
export function isAppBlocked(appName, blockedApps = []) {
  if (!appName) return false;
  const a = appName.toLowerCase();
  return blockedApps.some((b) => {
    const n = String(b).trim().toLowerCase();
    return n && (a === n || a.includes(n) || n.includes(a));
  });
}
