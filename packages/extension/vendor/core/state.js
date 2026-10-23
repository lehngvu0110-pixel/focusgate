/** FocusGate — mô hình dữ liệu + giá trị mặc định */

export const STATE_VERSION = 1;

/** Trang giải trí hay gây mất tập trung (dùng cho chế độ danh sách đen). */
export const DEFAULT_BLOCKLIST = [
  'facebook.com', 'messenger.com', 'instagram.com', 'threads.net', 'threads.com',
  'tiktok.com', 'douyin.com', 'youtube.com', 'shorts.youtube.com',
  'twitter.com', 'x.com', 'reddit.com', 'pinterest.com', 'tumblr.com',
  'twitch.tv', 'netflix.com', 'disneyplus.com', 'fptplay.vn', 'vieon.vn',
  '9gag.com', 'imgur.com', 'discord.com', 'snapchat.com', 'linkedin.com/feed',
  'kenh14.vn', 'genk.vn', 'voz.vn', 'tinhte.vn', 'spiderum.com',
  'zingmp3.vn', 'nhaccuatui.com', 'soundcloud.com', 'open.spotify.com',
  'shopee.vn', 'lazada.vn', 'tiki.vn', 'sendo.vn', 'thegioididong.com',
  'steampowered.com', 'epicgames.com', 'itch.io', 'chess.com', 'lichess.org',
  'coccoc.com/search', 'baomoi.com', 'vnexpress.net', 'dantri.com.vn'
];

/** Trang học tập / công cụ luôn được vào kể cả khi khoá chặt. */
export const DEFAULT_ALLOWLIST = [
  'google.com', 'google.com.vn', 'bing.com', 'duckduckgo.com',
  'wikipedia.org', 'wiktionary.org',
  'github.com', 'gitlab.com', 'stackoverflow.com', 'stackexchange.com',
  'claude.ai', 'chatgpt.com', 'openai.com', 'gemini.google.com',
  'drive.google.com', 'docs.google.com', 'sheets.google.com', 'mail.google.com',
  'calendar.google.com', 'meet.google.com', 'classroom.google.com',
  'notion.so', 'overleaf.com', 'desmos.com', 'wolframalpha.com', 'geogebra.org',
  'hcmut.edu.vn', 'lms.hcmut.edu.vn', 'mybk.hcmut.edu.vn', 'e-learning.hcmut.edu.vn',
  'arxiv.org', 'scholar.google.com', 'sciencedirect.com', 'ieee.org', 'springer.com',
  'khanacademy.org', 'coursera.org', 'edx.org', 'w3schools.com', 'mdn.mozilla.org',
  'developer.mozilla.org', 'python.org', 'nodejs.org', 'npmjs.com'
];

/** Câu cam kết người dùng phải gõ tay khi bấm "thoát khẩn cấp". */
export const COMMIT_PHRASES = [
  'Tôi biết việc mình đang định làm không quan trọng bằng công việc còn dang dở, nhưng tôi vẫn chọn bỏ dở nó ngay lúc này.',
  'Tôi tự nguyện phá vỡ cam kết của chính mình, xoá sạch chuỗi ngày tập trung đã tích luỹ, chỉ để đổi lấy vài phút lướt web.',
  'Việc tôi sắp mở ra không giúp tôi tiến gần hơn tới mục tiêu nào cả, và tôi hoàn toàn ý thức được điều đó khi gõ dòng này.',
  'Người tôi của ngày mai sẽ phải trả giá cho quyết định mà người tôi của hôm nay đang đưa ra ngay trong giây phút này.',
  'Tôi chấp nhận mất toàn bộ điểm tập trung và bắt đầu lại từ số không, chỉ vì tôi không đủ kiên nhẫn thêm vài phút nữa.'
];

export function todayKey(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function uid(prefix = 't') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function defaultSettings() {
  return {
    theme: 'dark',                // 'dark' (mặc định) | 'light'
    mode: 'allowlist',            // 'allowlist' (nghiêm) | 'blocklist' (nhẹ)
    strictness: 'strict',         // 'strict' | 'hard' | 'soft'
    allowlist: [...DEFAULT_ALLOWLIST],
    blocklist: [...DEFAULT_BLOCKLIST],
    allowLocalFiles: true,
    escalateOverdue: true,        // task quá hạn tự động chuyển sang bắt buộc
    remindOnBrowserStart: true,   // mở màn hình nhắc khi bật trình duyệt
    closeDistractingTabs: true,   // chuyển hướng luôn các tab đang mở khi bật cổng
    schedules: [],                // [{id, label, days:[0..6], start:'19:00', end:'22:00', enabled}]
    pomodoro: { focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesPerLongBreak: 4, autoStartNext: false },
    emergency: {
      enabled: true,
      cooldownSec: 30,
      unlockMinutes: 10,
      maxPerDay: 2,
      minPhraseChars: 100
    },
    blockedApps: ['Discord', 'Steam', 'Telegram', 'Zalo', 'Netflix', 'Spotify'],
    launchAtLogin: true,
    syncEnabled: true,
    syncPort: 47823
  };
}

export function defaultStats() {
  return { streak: 0, bestStreak: 0, points: 0, lastSuccessDay: null, days: {} };
}

export function defaultState(now = Date.now()) {
  return {
    version: STATE_VERSION,
    createdAt: now,
    tasks: [],
    settings: defaultSettings(),
    stats: defaultStats(),
    session: null,
    unlock: null,                 // {until, usedAt, phrase}
    lastRolloverDay: todayKey(new Date(now))
  };
}

export function makeTask(input = {}, now = Date.now()) {
  return {
    id: input.id || uid('task'),
    title: String(input.title || '').trim() || 'Việc chưa đặt tên',
    note: String(input.note || ''),
    createdAt: input.createdAt ?? now,
    remindAt: input.remindAt ?? null,   // mốc bắt đầu nhắc/chặn (ms) — null = ngay lập tức
    dueAt: input.dueAt ?? null,         // hạn chót (ms)
    estimateMin: Number.isFinite(input.estimateMin) ? input.estimateMin : 25,
    enforce: input.enforce !== false,   // true = chặn web cho tới khi xong
    tabs: Array.isArray(input.tabs) ? input.tabs.map(normalizeTab).filter(Boolean) : [],
    repeat: input.repeat || 'none',     // none | daily | weekdays | weekly
    status: input.status === 'done' ? 'done' : 'pending',
    completedAt: input.completedAt ?? null,
    focusSec: input.focusSec ?? 0,
    pointsAwarded: Number.isFinite(input.pointsAwarded) ? input.pointsAwarded : 0
  };
}

function normalizeTab(tab) {
  if (!tab) return null;
  if (typeof tab === 'string') return { url: tab, title: tab };
  if (!tab.url) return null;
  return { url: String(tab.url), title: String(tab.title || tab.url) };
}

/** Gộp state đọc từ ổ đĩa với mặc định (để không vỡ khi thêm trường mới). */
export function hydrate(raw, now = Date.now()) {
  const base = defaultState(now);
  if (!raw || typeof raw !== 'object') return base;
  const s = {
    ...base,
    ...raw,
    settings: {
      ...base.settings,
      ...(raw.settings || {}),
      pomodoro: { ...base.settings.pomodoro, ...(raw.settings?.pomodoro || {}) },
      emergency: { ...base.settings.emergency, ...(raw.settings?.emergency || {}) }
    },
    stats: { ...base.stats, ...(raw.stats || {}), days: { ...(raw.stats?.days || {}) } },
    tasks: Array.isArray(raw.tasks) ? raw.tasks.map((t) => makeTask(t, now)) : []
  };
  s.version = STATE_VERSION;
  return s;
}

/** Task có đang "hiệu lực" (đã tới giờ nhắc) không? */
export function isTaskActive(task, now = Date.now()) {
  if (!task || task.status === 'done') return false;
  if (task.remindAt && task.remindAt > now) return false;
  return true;
}

export function isOverdue(task, now = Date.now()) {
  return !!(task && task.status !== 'done' && task.dueAt && task.dueAt < now);
}

/** Task đang thực sự khoá cổng. */
export function blockingTasks(state, now = Date.now()) {
  const escalate = state.settings?.escalateOverdue !== false;
  return (state.tasks || []).filter((t) => {
    if (!isTaskActive(t, now)) return false;
    return t.enforce === true || (escalate && isOverdue(t, now));
  });
}

const DAY_MS = 86400000;

/** Số ngày lịch giữa hai mốc (theo giờ máy, không lệch vì đổi giờ mùa hè). */
export function daysBetween(fromTs, toTs) {
  const a = new Date(fromTs); a.setHours(12, 0, 0, 0);
  const b = new Date(toTs); b.setHours(12, 0, 0, 0);
  return Math.round((b - a) / DAY_MS);
}

/** Dời một mốc thời gian đi n ngày lịch, giữ nguyên giờ phút. */
export function shiftDays(ts, n) {
  if (!ts || !n) return ts;
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/**
 * Đặt lại các task lặp lại khi sang chu kỳ mới.
 * Mốc nhắc/hạn chót được dời sang chu kỳ mới (giữ giờ phút), nếu không task vừa
 * sống lại đã "quá hạn" từ hôm qua và khoá cổng oan.
 * Trả về state MỚI (không sửa tại chỗ) + số task đã reset.
 */
export function rolloverRepeats(state, now = Date.now()) {
  const day = todayKey(new Date(now));
  if (state.lastRolloverDay === day) return { state, reset: 0 };
  const dow = new Date(now).getDay();
  let reset = 0;
  const tasks = (state.tasks || []).map((t) => {
    if (t.status !== 'done' || t.repeat === 'none' || !t.repeat) return t;
    const sinceDone = t.completedAt ? daysBetween(t.completedAt, now) : Infinity;
    if (sinceDone <= 0) return t;                        // vừa xong hôm nay
    if (t.repeat === 'weekdays' && (dow === 0 || dow === 6)) return t;
    if (t.repeat === 'weekly' && sinceDone < 7) return t; // đủ một tuần mới sống lại (kể cả khi mở máy trễ)

    // Dời mốc sang chu kỳ hiện tại: hằng tuần dời theo bội số 7 ngày để giữ đúng thứ.
    const anchor = t.dueAt || t.remindAt;
    let shift = 0;
    if (anchor) {
      const lag = daysBetween(anchor, now);
      if (lag > 0) shift = t.repeat === 'weekly' ? Math.ceil(lag / 7) * 7 : lag;
    }
    reset++;
    return {
      ...t,
      status: 'pending',
      completedAt: null,
      focusSec: 0,
      remindAt: shiftDays(t.remindAt, shift),
      dueAt: shiftDays(t.dueAt, shift)
    };
  });
  return { state: { ...state, tasks, lastRolloverDay: day }, reset };
}
