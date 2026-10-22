/** FocusGate — khung giờ chặn theo lịch */

/** "19:30" -> 1170 (số phút từ 00:00). Trả về null nếu sai định dạng. */
export function parseHHMM(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Một khung giờ có đang hiệu lực không.
 * Hỗ trợ khung qua nửa đêm (22:00 -> 01:00): khi đó "thứ" tính theo ngày BẮT ĐẦU.
 */
export function isScheduleActive(schedule, now = new Date()) {
  if (!schedule || schedule.enabled === false) return false;
  const start = parseHHMM(schedule.start);
  const end = parseHHMM(schedule.end);
  if (start === null || end === null || start === end) return false;

  const days = Array.isArray(schedule.days) && schedule.days.length
    ? schedule.days
    : [0, 1, 2, 3, 4, 5, 6];
  const today = now.getDay();
  const yesterday = (today + 6) % 7;
  const cur = minutesOfDay(now);

  if (start < end) {
    return days.includes(today) && cur >= start && cur < end;
  }
  // qua nửa đêm
  if (days.includes(today) && cur >= start) return true;          // tối nay
  if (days.includes(yesterday) && cur < end) return true;          // rạng sáng của ca hôm qua
  return false;
}

/** Trả về khung giờ đầu tiên đang hiệu lực, hoặc null. */
export function activeSchedule(schedules = [], now = new Date()) {
  for (const s of schedules) if (isScheduleActive(s, now)) return s;
  return null;
}

/** Thời điểm (ms) khung giờ hiện tại kết thúc — để hiển thị đếm ngược. */
export function scheduleEndsAt(schedule, now = new Date()) {
  const start = parseHHMM(schedule.start);
  const end = parseHHMM(schedule.end);
  if (start === null || end === null) return null;
  const d = new Date(now.getTime());
  d.setSeconds(0, 0);
  d.setHours(Math.floor(end / 60), end % 60, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
