/** FocusGate — bộ máy quyết định chặn */

import { blockingTasks, todayKey, isOverdue, COMMIT_PHRASES } from './state.js';
import { activeSchedule, scheduleEndsAt } from './schedule.js';
import { classifyUrl, workPatternsFromTasks } from './matcher.js';

/**
 * Cổng có đang khoá không, và vì lý do gì.
 * @returns {{
 *   active: boolean,
 *   unlockedUntil: number|null,
 *   reasons: Array<{type:string,label:string,endsAt?:number,count?:number}>,
 *   tasks: Array<object>,
 *   primary: string|null
 * }}
 */
export function evaluateGate(state, now = Date.now()) {
  const empty = { active: false, unlockedUntil: null, reasons: [], tasks: [], primary: null };
  if (!state) return empty;

  // 1) Đang trong cửa sổ thoát khẩn cấp -> mở
  if (state.unlock && state.unlock.until > now) {
    return { ...empty, unlockedUntil: state.unlock.until };
  }

  const reasons = [];

  // 2) Task bắt buộc chưa xong
  const tasks = blockingTasks(state, now);
  if (tasks.length > 0) {
    reasons.push({ type: 'task', label: `${tasks.length} việc bắt buộc chưa xong`, count: tasks.length });
  }

  // 3) Khung giờ chặn theo lịch
  const sched = activeSchedule(state.settings?.schedules || [], new Date(now));
  if (sched) {
    reasons.push({
      type: 'schedule',
      label: `Khung giờ tập trung ${sched.start}–${sched.end}`,
      endsAt: scheduleEndsAt(sched, new Date(now)),
      scheduleId: sched.id
    });
  }

  // 4) Phiên Pomodoro đang chạy pha tập trung
  const s = state.session;
  if (s && s.phase === 'focus' && !s.paused && s.endsAt > now) {
    reasons.push({ type: 'pomodoro', label: 'Đang trong phiên Pomodoro', endsAt: s.endsAt });
  }

  return {
    active: reasons.length > 0,
    unlockedUntil: null,
    reasons,
    tasks,
    primary: reasons.length ? reasons[0].type : null
  };
}

/** Kiểm tra một URL với trạng thái hiện tại. Trả thêm gate để UI hiển thị. */
export function checkUrl(state, url, now = Date.now()) {
  const gate = evaluateGate(state, now);
  if (!gate.active) return { allowed: true, reason: 'cổng-đang-mở', gate, matched: null };
  const settings = state.settings || {};
  const res = classifyUrl(url, {
    mode: settings.mode,
    allowlist: settings.allowlist,
    blocklist: settings.blocklist,
    workPatterns: workPatternsFromTasks(state.tasks),
    allowLocalFiles: settings.allowLocalFiles !== false
  });
  return { ...res, gate };
}

/* ------------------------------------------------------------------ */
/* Thoát khẩn cấp                                                      */
/* ------------------------------------------------------------------ */

export function emergencyUsedToday(state, now = Date.now()) {
  const key = todayKey(new Date(now));
  return state?.stats?.days?.[key]?.emergencies || 0;
}

export function canUseEmergency(state, now = Date.now()) {
  const cfg = state?.settings?.emergency || {};
  if (cfg.enabled === false || state?.settings?.strictness === 'hard') {
    return { ok: false, reason: 'Chế độ cứng tuyệt đối — không có lối thoát khẩn cấp.', remaining: 0 };
  }
  const used = emergencyUsedToday(state, now);
  const max = cfg.maxPerDay ?? 2;
  if (used >= max) {
    return { ok: false, reason: `Hôm nay bạn đã dùng hết ${max} lượt thoát khẩn cấp.`, remaining: 0 };
  }
  return { ok: true, reason: '', remaining: max - used, max };
}

/**
 * Đếm ngược của lối thoát phải được kiểm ở phía xử lý, không chỉ ở giao diện.
 * @param {number|null} armedAt  lúc người dùng mở hộp thoại thoát khẩn cấp (ms)
 */
export function emergencyCooldownLeft(state, armedAt, now = Date.now()) {
  const sec = state?.settings?.emergency?.cooldownSec ?? 30;
  if (!Number.isFinite(armedAt)) return sec;
  return Math.max(0, Math.ceil((armedAt + sec * 1000 - now) / 1000));
}

/** Chọn câu cam kết theo ngày + số lượt đã dùng (ổn định trong cùng một lượt). */
export function pickPhrase(state, now = Date.now()) {
  const used = emergencyUsedToday(state, now);
  const key = todayKey(new Date(now));
  let h = used * 31;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) >>> 0;
  return COMMIT_PHRASES[h % COMMIT_PHRASES.length];
}

/** So khớp câu người dùng gõ với câu yêu cầu (bỏ qua khoảng trắng thừa). */
export function phraseMatches(typed, expected) {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return norm(typed) === norm(expected) && norm(typed).length > 0;
}

/**
 * Áp dụng thoát khẩn cấp: mở cổng tạm thời, xoá streak, trừ điểm.
 * Trả về state MỚI.
 */
export function applyEmergency(state, now = Date.now()) {
  const cfg = state.settings?.emergency || {};
  const minutes = cfg.unlockMinutes ?? 10;
  const key = todayKey(new Date(now));
  const days = { ...(state.stats?.days || {}) };
  const day = { ...(days[key] || { focusSec: 0, completed: 0, created: 0, emergencies: 0 }) };
  day.emergencies = (day.emergencies || 0) + 1;
  days[key] = day;
  return {
    ...state,
    unlock: { until: now + minutes * 60000, usedAt: now },
    stats: {
      ...state.stats,
      days,
      streak: 0,
      points: Math.max(0, (state.stats?.points || 0) - 50)
    }
  };
}

/** Huỷ cửa sổ mở tạm (nút "Tôi quay lại làm việc"). */
export function cancelUnlock(state) {
  return { ...state, unlock: null };
}

/* ------------------------------------------------------------------ */
/* Điểm & chuỗi ngày                                                   */
/* ------------------------------------------------------------------ */

const POINTS_PER_TASK = 10;
const POINTS_PER_FOCUS_5MIN = 1;
const POINTS_CLEAR_ALL = 20;

function ensureDay(stats, key) {
  const days = { ...(stats.days || {}) };
  days[key] = { focusSec: 0, completed: 0, created: 0, emergencies: 0, ...(days[key] || {}) };
  return days;
}

/** Ghi nhận hoàn thành một task -> state mới. */
export function completeTask(state, taskId, now = Date.now()) {
  const idx = (state.tasks || []).findIndex((t) => t.id === taskId);
  if (idx === -1) return state;
  const task = state.tasks[idx];
  if (task.status === 'done') return state;

  const tasks = [...state.tasks];
  tasks[idx] = { ...task, status: 'done', completedAt: now };

  const key = todayKey(new Date(now));
  const days = ensureDay(state.stats, key);
  days[key] = { ...days[key], completed: days[key].completed + 1 };

  let points = (state.stats.points || 0) + POINTS_PER_TASK;
  tasks[idx].pointsAwarded = POINTS_PER_TASK;
  const stillBlocking = blockingTasks({ ...state, tasks }, now);
  let streak = state.stats.streak || 0;
  let bestStreak = state.stats.bestStreak || 0;
  let lastSuccessDay = state.stats.lastSuccessDay || null;

  // Thưởng "dọn sạch" và streak chỉ tính một lần mỗi ngày (tick/bỏ tick không cày điểm được)
  if (stillBlocking.length === 0 && days[key].emergencies === 0 && lastSuccessDay !== key) {
    points += POINTS_CLEAR_ALL;
    const y = todayKey(new Date(now - 86400000));
    streak = lastSuccessDay === y ? streak + 1 : 1;
    lastSuccessDay = key;
    bestStreak = Math.max(bestStreak, streak);
  }

  return { ...state, tasks, stats: { ...state.stats, days, points, streak, bestStreak, lastSuccessDay } };
}

/** Bỏ tick: trả lại điểm và số việc xong của ngày đã tick. */
export function uncompleteTask(state, taskId) {
  const idx = (state.tasks || []).findIndex((t) => t.id === taskId);
  if (idx === -1 || state.tasks[idx].status !== 'done') return state;
  const task = state.tasks[idx];
  const tasks = [...state.tasks];
  tasks[idx] = { ...task, status: 'pending', completedAt: null, pointsAwarded: 0 };

  const stats = { ...(state.stats || {}) };
  stats.points = Math.max(0, (stats.points || 0) - (task.pointsAwarded || 0));
  const key = task.completedAt ? todayKey(new Date(task.completedAt)) : null;
  if (key && stats.days?.[key]) {
    stats.days = { ...stats.days, [key]: { ...stats.days[key], completed: Math.max(0, (stats.days[key].completed || 0) - 1) } };
  }
  return { ...state, tasks, stats };
}

/** Chuỗi ngày còn hiệu lực: đứt nếu hôm qua và hôm nay đều chưa "dọn sạch". */
export function currentStreak(stats, now = Date.now()) {
  const last = stats?.lastSuccessDay;
  if (!last) return 0;
  const today = todayKey(new Date(now));
  const yesterday = todayKey(new Date(now - 86400000));
  return last === today || last === yesterday ? (stats.streak || 0) : 0;
}

/** Cộng thời gian tập trung (giây) vào thống kê + task. */
export function addFocusTime(state, seconds, taskId = null, now = Date.now()) {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const key = todayKey(new Date(now));
  const days = ensureDay(state.stats, key);
  const before = days[key].focusSec;
  days[key] = { ...days[key], focusSec: before + seconds };
  const earned = Math.floor((before + seconds) / 300) - Math.floor(before / 300);
  const tasks = taskId
    ? state.tasks.map((t) => (t.id === taskId ? { ...t, focusSec: (t.focusSec || 0) + seconds } : t))
    : state.tasks;
  return {
    ...state,
    tasks,
    stats: { ...state.stats, days, points: (state.stats.points || 0) + earned * POINTS_PER_FOCUS_5MIN }
  };
}

/** Tóm tắt để hiển thị. */
export function summary(state, now = Date.now()) {
  const key = todayKey(new Date(now));
  const day = state.stats?.days?.[key] || { focusSec: 0, completed: 0, emergencies: 0 };
  const pending = (state.tasks || []).filter((t) => t.status !== 'done');
  return {
    today: key,
    focusMin: Math.round((day.focusSec || 0) / 60),
    completedToday: day.completed || 0,
    emergenciesToday: day.emergencies || 0,
    pending: pending.length,
    overdue: pending.filter((t) => isOverdue(t, now)).length,
    blocking: blockingTasks(state, now).length,
    streak: currentStreak(state.stats, now),
    bestStreak: state.stats?.bestStreak || 0,
    points: state.stats?.points || 0
  };
}
