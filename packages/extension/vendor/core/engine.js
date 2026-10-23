/**
 * FocusGate — phần "đồng hồ" và "người gác" dùng chung cho extension lẫn app desktop.
 * Trước đây mỗi bên tự viết vòng tick riêng nên hành vi lệch nhau; giờ cả hai gọi chung một chỗ.
 */
import { rolloverRepeats, blockingTasks } from './state.js';
import { parseHHMM } from './schedule.js';
import { evaluateGate, addFocusTime } from './gate.js';
import { isSessionOver, startSession, stopSession, nextPhase } from './pomodoro.js';
import { normalizePattern, parseUrl, matchesPattern, workPatternsFromTasks } from './matcher.js';

/**
 * Một nhịp đồng hồ: sang ngày mới, hết cửa sổ mở tạm, hết phiên Pomodoro, tới giờ nhắc việc.
 * @param {object} state
 * @param {number} now
 * @param {number|null} since  lần tick trước (ms) — để mỗi lời nhắc chỉ báo đúng một lần
 * @returns {{ state: object, events: Array<{type:string, [k:string]:any}> }}
 *   state giữ NGUYÊN tham chiếu nếu không có gì đổi (để bên gọi khỏi ghi đĩa vô ích).
 */
export function tickState(state, now = Date.now(), since = null) {
  const events = [];
  let s = rolloverRepeats(state, now).state;

  if (s.unlock && s.unlock.until <= now) {
    s = { ...s, unlock: null };
    events.push({ type: 'unlock-expired' });
  }

  if (s.session && isSessionOver(s.session, now)) {
    const finished = s.session;
    const auto = !!s.settings?.pomodoro?.autoStartNext;
    if (finished.phase === 'focus') {
      s = addFocusTime(s, Math.round(finished.durationMs / 1000), finished.taskId, now);
      const next = nextPhase(s);
      const p = s.settings?.pomodoro || {};
      events.push({ type: 'focus-ended', next, minutes: next === 'longBreak' ? p.longBreakMin : p.breakMin });
      s = auto ? startSession(s, { phase: next, taskId: finished.taskId }, now) : stopSession(s, now);
    } else {
      events.push({ type: 'break-ended' });
      s = auto ? startSession(s, { phase: 'focus', taskId: finished.taskId }, now) : stopSession(s, now);
    }
  }

  const from = Number.isFinite(since) ? since : now - 60000;
  for (const t of s.tasks || []) {
    if (t.status === 'done' || !t.remindAt) continue;
    if (t.remindAt > from && t.remindAt <= now) events.push({ type: 'reminder', task: t });
  }

  return { state: s, events };
}

/**
 * Mốc gần nhất trong tương lai mà trạng thái cổng có thể đổi.
 * Dùng để hẹn báo thức đúng lúc thay vì chờ vòng tick mỗi phút.
 */
export function nextWakeAt(state, now = Date.now()) {
  const candidates = [];
  const push = (t) => { if (Number.isFinite(t) && t > now) candidates.push(t); };

  push(state.unlock?.until);
  if (state.session && !state.session.paused) push(state.session.endsAt);
  for (const t of state.tasks || []) {
    if (t.status === 'done') continue;
    push(t.remindAt);
    push(t.dueAt);
  }
  for (const sc of state.settings?.schedules || []) {
    if (sc.enabled === false) continue;
    for (const hhmm of [sc.start, sc.end]) push(nextClockTime(hhmm, now));
  }
  // nửa đêm: task lặp lại sống lại
  const midnight = new Date(now); midnight.setHours(24, 0, 5, 0);
  push(midnight.getTime());

  return candidates.length ? Math.min(...candidates) : null;
}

function nextClockTime(hhmm, now) {
  const m = parseHHMM(hhmm);
  if (m === null) return null;
  const d = new Date(now);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/* ------------------------------------------------------------------ */
/* Người gác: không cho "lách" khi cổng đang khoá                        */
/* ------------------------------------------------------------------ */

/**
 * So sánh state trước/sau một thao tác của NGƯỜI DÙNG. Nếu thao tác đó nới lỏng
 * cổng đang khoá (xoá việc bắt buộc, đổi sang danh sách đen, tắt khung giờ đang chạy,
 * nới lối thoát khẩn cấp...) thì trả về lý do từ chối. Ngược lại trả về null.
 *
 * Mục đích: lối thoát duy nhất là làm xong việc hoặc trả giá qua thoát khẩn cấp.
 * Chế độ strictness = 'soft' tắt người gác này.
 */
export function guardChange(prev, next, now = Date.now()) {
  if (!prev || !next) return null;
  if (prev.settings?.strictness === 'soft') return null;
  const gate = evaluateGate(prev, now);
  if (!gate.active) return null;                       // cổng đang mở (hoặc mở tạm) thì tự do

  const LOCKED = 'Cổng đang khoá: ';

  // 1) Việc bắt buộc chỉ được "biến mất" bằng cách tick xong
  const nextBlocking = new Set(blockingTasks(next, now).map((t) => t.id));
  for (const t of gate.tasks) {
    const after = (next.tasks || []).find((x) => x.id === t.id);
    if (after && after.status === 'done') continue;
    if (!nextBlocking.has(t.id)) {
      return LOCKED + `việc "${t.title}" chỉ được gỡ khi bạn làm xong nó (hoặc dùng lối thoát khẩn cấp).`;
    }
  }

  // 2) Khung giờ đang chạy không được tắt / xoá / sửa cho hết hiệu lực
  const prevSched = gate.reasons.some((r) => r.type === 'schedule');
  const nextSched = evaluateGate(next, now).reasons.some((r) => r.type === 'schedule');
  if (prevSched && !nextSched) return LOCKED + 'không tắt được khung giờ tập trung đang chạy.';

  const ps = prev.settings || {};
  const ns = next.settings || {};

  // 3) Không chuyển từ danh sách trắng (nghiêm) sang danh sách đen (nhẹ)
  if (ps.mode !== 'blocklist' && ns.mode === 'blocklist') {
    return LOCKED + 'chưa đổi được sang chế độ danh sách đen. Đổi khi cổng đã mở nhé.';
  }

  // 4) Danh sách đen chỉ được thêm, không được bớt
  if (ns.mode === 'blocklist') {
    const kept = new Set((ns.blocklist || []).map(normalizePattern));
    const removed = (ps.blocklist || []).map(normalizePattern).filter((p) => p && !kept.has(p));
    if (removed.length) return LOCKED + `chưa gỡ được "${removed[0]}" khỏi danh sách đen.`;
  }

  // 5) Không mở cửa cho trang giải trí qua danh sách trắng hoặc tab công việc
  const before = new Set([...(ps.allowlist || []), ...workPatternsFromTasks(prev.tasks)].map(normalizePattern));
  const added = [...(ns.allowlist || []), ...workPatternsFromTasks(next.tasks)]
    .map(normalizePattern).filter((p) => p && !before.has(p));
  for (const p of added) {
    // trùng theo cả hai chiều: "com" phủ facebook.com, "m.facebook.com" nằm trong facebook.com
    const overlaps = (a, b) => {
      const u = parseUrl('https://' + normalizePattern(a));
      return !!u && matchesPattern(u, b);
    };
    const hit = (ps.blocklist || []).find((b) => overlaps(b, p) || overlaps(p, b));
    if (hit) return LOCKED + `"${p}" nằm trong danh sách đen nên chưa cho vào được.`;
  }

  // 6) Không nới lối thoát khẩn cấp / độ nghiêm
  const pe = ps.emergency || {};
  const ne = ns.emergency || {};
  const RANK = { soft: 0, strict: 1, hard: 2 };
  if ((RANK[ns.strictness] ?? 1) < (RANK[ps.strictness] ?? 1)) return LOCKED + 'chưa hạ được độ nghiêm.';
  if (pe.enabled === false && ne.enabled !== false) return LOCKED + 'chưa bật lại được lối thoát khẩn cấp.';
  if ((ne.maxPerDay ?? 2) > (pe.maxPerDay ?? 2)) return LOCKED + 'chưa tăng được số lượt thoát mỗi ngày.';
  if ((ne.cooldownSec ?? 30) < (pe.cooldownSec ?? 30)) return LOCKED + 'chưa rút ngắn được thời gian chờ.';
  if ((ne.unlockMinutes ?? 10) > (pe.unlockMinutes ?? 10)) return LOCKED + 'chưa kéo dài được thời gian mở tạm.';
  if (ps.allowLocalFiles === false && ns.allowLocalFiles !== false) return LOCKED + 'chưa mở lại được tệp trên máy.';

  // 7) App desktop: không gỡ app khỏi danh sách chặn, không tắt tự khởi động
  const keptApps = new Set((ns.blockedApps || []).map((a) => String(a).trim().toLowerCase()));
  const goneApp = (ps.blockedApps || []).find((a) => !keptApps.has(String(a).trim().toLowerCase()));
  if (goneApp) return LOCKED + `chưa gỡ được "${goneApp}" khỏi danh sách app bị chặn.`;
  if (ps.launchAtLogin !== false && ns.launchAtLogin === false) return LOCKED + 'chưa tắt được tự khởi động cùng máy.';

  return null;
}
