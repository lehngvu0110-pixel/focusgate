/**
 * FocusGate — service worker
 * Nhiệm vụ: giữ state, dựng luật chặn, canh giờ, ép các tab đang mở tuân thủ.
 */
import * as FG from '../vendor/core/index.js';
import { buildRules } from './rules.js';

const KEY = 'focusgate.state';
const BLOCKED_PAGE = chrome.runtime.getURL('src/blocked.html');
const DASHBOARD = chrome.runtime.getURL('src/dashboard.html');

/* ------------------------------------------------------------------ */
/* Lưu trữ                                                             */
/* ------------------------------------------------------------------ */

let writeChain = Promise.resolve();

async function loadState() {
  const raw = await chrome.storage.local.get(KEY);
  return FG.hydrate(raw[KEY], Date.now());
}

async function saveState(state) {
  await chrome.storage.local.set({ [KEY]: state });
  return state;
}

/** Đọc → biến đổi → ghi, tuần tự hoá để không mất dữ liệu khi gọi song song. */
function mutate(fn, { bump = true } = {}) {
  const next = writeChain.then(async () => {
    const state = await loadState();
    let out = (await fn(state)) || state;
    if (bump) out = { ...out, updatedAt: Date.now() };
    await saveState(out);
    await applyState(out);
    if (bump) pushToDesktop(out);
    return out;
  });
  writeChain = next.catch(() => {});
  return next;
}

/* ------------------------------------------------------------------ */
/* Áp dụng trạng thái ra trình duyệt                                   */
/* ------------------------------------------------------------------ */

async function syncRules(state) {
  const gate = FG.evaluateGate(state);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);
  const addRules = gate.active ? buildRules(state, BLOCKED_PAGE) : [];
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  } catch (err) {
    console.error('[FocusGate] Không đặt được luật chặn:', err);
    // Thử lại chỉ với luật chặn-tất-cả để không bao giờ "hở cổng" hoàn toàn
    if (gate.active) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds,
          addRules: buildRules({ ...state, settings: { ...state.settings, mode: 'allowlist', allowlist: [] } }, BLOCKED_PAGE)
        });
      } catch (e2) { console.error('[FocusGate] Thất bại lần hai:', e2); }
    }
  }
  return gate;
}

async function updateBadge(state) {
  const gate = FG.evaluateGate(state);
  const n = gate.tasks.length;
  await chrome.action.setBadgeText({ text: gate.active ? (n ? String(n) : '●') : '' });
  await chrome.action.setBadgeBackgroundColor({ color: gate.active ? '#e5484d' : '#30a46c' });
  await chrome.action.setTitle({
    title: gate.active
      ? `FocusGate đang khoá — ${gate.reasons.map((r) => r.label).join(' · ')}`
      : 'FocusGate — cổng đang mở, chúc bạn thư giãn vui vẻ'
  });
}

/** Ép mọi tab đang mở tuân thủ (DNR không tự áp cho tab đã tải xong). */
async function enforceTabs(state) {
  const gate = FG.evaluateGate(state);
  if (!gate.active || state.settings?.closeDistractingTabs === false) return;
  let tabs = [];
  try { tabs = await chrome.tabs.query({}); } catch { return; }
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (tab.url.startsWith(BLOCKED_PAGE) || tab.url.startsWith(DASHBOARD)) continue;
    const res = FG.checkUrl(state, tab.url);
    if (!res.allowed) {
      try {
        await chrome.tabs.update(tab.id, { url: BLOCKED_PAGE + '?u=' + encodeURIComponent(tab.url) });
      } catch { /* tab đã đóng */ }
    }
  }
}

async function applyState(state) {
  await syncRules(state);
  await updateBadge(state);
  await enforceTabs(state);
  broadcast(state);
}

function broadcast(state) {
  const payload = snapshot(state);
  chrome.runtime.sendMessage({ type: 'state:changed', payload }).catch(() => {});
}

function snapshot(state, now = Date.now()) {
  return {
    state,
    gate: FG.evaluateGate(state, now),
    summary: FG.summary(state, now),
    now
  };
}

/* ------------------------------------------------------------------ */
/* Đồng bộ với app desktop (nếu đang chạy)                             */
/* ------------------------------------------------------------------ */

function syncBase(state) {
  return `http://127.0.0.1:${state.settings?.syncPort || 47823}`;
}

/** Đẩy state hiện tại sang desktop. Lặng lẽ bỏ qua nếu desktop không chạy. */
async function pushToDesktop(state) {
  if (state.settings?.syncEnabled === false) return;
  try {
    await fetch(syncBase(state) + '/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
      signal: AbortSignal.timeout(1500)
    });
  } catch { /* desktop chưa bật — không sao */ }
}

/**
 * Bắt tay hai chiều: bên nào có updatedAt mới hơn thì bên đó thắng.
 * Trả về state mới nếu đã nhận dữ liệu từ desktop.
 */
async function syncWithDesktop() {
  const state = await loadState();
  if (state.settings?.syncEnabled === false) return null;
  let remote;
  try {
    const res = await fetch(syncBase(state) + '/state', { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    remote = await res.json();
  } catch {
    return null;   // desktop không chạy
  }
  const localAt = state.updatedAt || 0;
  const remoteAt = remote?.state?.updatedAt || 0;
  if (remoteAt > localAt) {
    const merged = FG.hydrate(remote.state);
    merged.updatedAt = remoteAt;
    await saveState(merged);
    await applyState(merged);
    return merged;
  }
  if (localAt > remoteAt) await pushToDesktop(state);
  return null;
}

/* ------------------------------------------------------------------ */
/* Đồng hồ: rollover, hết giờ pomodoro, hết cửa sổ mở tạm, nhắc việc   */
/* ------------------------------------------------------------------ */

async function tick() {
  await syncWithDesktop();
  await mutate((state) => {
    const now = Date.now();
    let s = state;

    // Task lặp lại sang ngày mới
    const rolled = FG.rolloverRepeats(s, now);
    s = rolled.state;

    // Hết cửa sổ thoát khẩn cấp
    if (s.unlock && s.unlock.until <= now) {
      s = { ...s, unlock: null };
      notify('Hết giờ nghỉ', 'Cổng tập trung đã khoá lại. Quay lại với việc của bạn nhé.');
    }

    // Phiên Pomodoro kết thúc
    if (s.session && FG.isSessionOver(s.session, now)) {
      const finished = s.session;
      if (finished.phase === 'focus') {
        s = FG.addFocusTime(s, Math.round(finished.durationMs / 1000), finished.taskId, now);
        const np = FG.nextPhase(s);
        notify('Hết một phiên tập trung 🎉', np === 'longBreak' ? 'Nghỉ dài nào!' : 'Nghỉ ngắn 5 phút.');
        s = s.settings.pomodoro?.autoStartNext ? FG.startSession(s, { phase: np }, now) : FG.stopSession(s);
      } else {
        notify('Hết giờ nghỉ', 'Bắt đầu phiên tập trung tiếp theo thôi.');
        s = s.settings.pomodoro?.autoStartNext ? FG.startSession(s, { phase: 'focus' }, now) : FG.stopSession(s);
      }
    }

    // Việc vừa tới giờ nhắc
    for (const t of s.tasks) {
      if (t.status === 'done' || !t.remindAt) continue;
      if (t.remindAt <= now && !t._notified && t.remindAt > now - 120000) {
        notify('Tới giờ: ' + t.title, t.enforce ? 'Các trang giải trí vừa bị khoá.' : 'Nhắc nhẹ thôi nhé.');
      }
    }
    return s;
  });
}

function notify(title, message) {
  try {
    chrome.notifications.create('fg_' + Date.now(), {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message,
      priority: 1
    });
  } catch { /* người dùng có thể đã tắt thông báo */ }
}

/* ------------------------------------------------------------------ */
/* Sự kiện                                                             */
/* ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.alarms.create('fg-tick', { periodInMinutes: 1 });
  await mutate((s) => s);
  if (details.reason === 'install') {
    chrome.tabs.create({ url: DASHBOARD + '?welcome=1' });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create('fg-tick', { periodInMinutes: 1 });
  const state = await loadState();
  await applyState(state);
  const gate = FG.evaluateGate(state);
  if (gate.active && state.settings?.remindOnBrowserStart !== false) {
    chrome.tabs.create({ url: BLOCKED_PAGE + '?startup=1', active: true });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fg-tick') tick();
});

// Lớp chặn dự phòng: bắt điều hướng kiểu SPA mà DNR bỏ sót
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  const url = info.url || tab?.url;
  if (!url || !/^https?:/i.test(url)) return;
  const state = await loadState();
  const res = FG.checkUrl(state, url);
  if (!res.allowed) {
    try {
      await chrome.tabs.update(tabId, { url: BLOCKED_PAGE + '?u=' + encodeURIComponent(url) });
    } catch { /* ignore */ }
  }
});

/* ------------------------------------------------------------------ */
/* API cho các trang giao diện                                         */
/* ------------------------------------------------------------------ */

const actions = {
  async get() {
    const merged = await syncWithDesktop();
    return snapshot(merged || await loadState());
  },

  /** Trạng thái kết nối với app desktop (hiển thị trong Cài đặt). */
  async desktopStatus() {
    const state = await loadState();
    if (state.settings?.syncEnabled === false) return { connected: false, reason: 'Bạn đã tắt đồng bộ.' };
    try {
      const res = await fetch(syncBase(state) + '/ping', { signal: AbortSignal.timeout(1200) });
      if (!res.ok) return { connected: false, reason: 'Không phản hồi.' };
      const j = await res.json();
      return { connected: j.app === 'focusgate-desktop', port: state.settings?.syncPort || 47823 };
    } catch {
      return { connected: false, reason: 'App desktop chưa chạy.' };
    }
  },

  async addTask(payload) {
    const s = await mutate((st) => ({ ...st, tasks: [...st.tasks, FG.makeTask(payload)] }));
    return snapshot(s);
  },

  async updateTask({ id, patch }) {
    const s = await mutate((st) => ({
      ...st,
      tasks: st.tasks.map((t) => (t.id === id ? FG.makeTask({ ...t, ...patch }) : t))
    }));
    return snapshot(s);
  },

  async deleteTask({ id }) {
    const s = await mutate((st) => ({ ...st, tasks: st.tasks.filter((t) => t.id !== id) }));
    return snapshot(s);
  },

  async completeTask({ id }) {
    const s = await mutate((st) => FG.completeTask(st, id));
    return snapshot(s);
  },

  async uncompleteTask({ id }) {
    const s = await mutate((st) => FG.uncompleteTask(st, id));
    return snapshot(s);
  },

  async updateSettings({ patch }) {
    const s = await mutate((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
    return snapshot(s);
  },

  async startSession({ taskId, phase }) {
    const s = await mutate((st) => FG.startSession(st, { taskId, phase: phase || 'focus' }));
    return snapshot(s);
  },
  async pauseSession() { return snapshot(await mutate((st) => FG.pauseSession(st))); },
  async resumeSession() { return snapshot(await mutate((st) => FG.resumeSession(st))); },
  async stopSession() {
    return snapshot(await mutate((st) => {
      let s = st;
      if (st.session && st.session.phase === 'focus') {
        const elapsed = Math.round(((st.session.elapsedBeforePause || 0) + (st.session.paused ? 0 : Date.now() - st.session.startedAt)) / 1000);
        if (elapsed > 30) s = FG.addFocusTime(s, elapsed, st.session.taskId);
      }
      return FG.stopSession(s);
    }));
  },

  async emergencyInfo() {
    const state = await loadState();
    return {
      ...FG.canUseEmergency(state),
      phrase: FG.pickPhrase(state),
      cooldownSec: state.settings.emergency?.cooldownSec ?? 30,
      unlockMinutes: state.settings.emergency?.unlockMinutes ?? 10
    };
  },

  async emergencyUnlock({ typed }) {
    const state = await loadState();
    const can = FG.canUseEmergency(state);
    if (!can.ok) return { ok: false, error: can.reason };
    if (!FG.phraseMatches(typed, FG.pickPhrase(state))) {
      return { ok: false, error: 'Câu cam kết chưa đúng. Gõ lại chính xác từng chữ.' };
    }
    const s = await mutate((st) => FG.applyEmergency(st));
    return { ok: true, snapshot: snapshot(s) };
  },

  async cancelUnlock() { return snapshot(await mutate((st) => FG.cancelUnlock(st))); },

  /** Lưu các tab đang mở vào một task ("bỏ tab công việc vô app"). */
  async captureTabs({ taskId, onlyCurrentWindow = true }) {
    const tabs = await chrome.tabs.query(onlyCurrentWindow ? { currentWindow: true } : {});
    const picked = tabs
      .filter((t) => t.url && /^https?:/i.test(t.url) && !t.url.startsWith(BLOCKED_PAGE))
      .map((t) => ({ url: t.url, title: t.title || t.url }));
    if (!taskId) return { tabs: picked };
    const s = await mutate((st) => ({
      ...st,
      tasks: st.tasks.map((t) => (t.id === taskId ? { ...t, tabs: dedupeTabs([...(t.tabs || []), ...picked]) } : t))
    }));
    return { tabs: picked, snapshot: snapshot(s) };
  },

  async listTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return {
      tabs: tabs
        .filter((t) => t.url && /^https?:/i.test(t.url) && !t.url.startsWith(BLOCKED_PAGE))
        .map((t) => ({ url: t.url, title: t.title || t.url, favIconUrl: t.favIconUrl }))
    };
  },

  /** Mở lại toàn bộ tab công việc của một task. */
  async openWorkTabs({ id }) {
    const state = await loadState();
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return { ok: false, error: 'Không tìm thấy việc.' };
    for (const tab of task.tabs || []) {
      try { await chrome.tabs.create({ url: tab.url, active: false }); } catch { /* ignore */ }
    }
    return { ok: true, opened: (task.tabs || []).length };
  },

  async openDashboard() {
    await chrome.tabs.create({ url: DASHBOARD });
    return { ok: true };
  },

  /** Buộc dựng lại luật + huy hiệu (dùng sau khi thay đổi storage từ bên ngoài). */
  async refresh() {
    const st = await loadState();
    await applyState(st);
    return snapshot(st);
  },

  async resetAll() {
    await chrome.storage.local.remove(KEY);
    const s = await mutate((st) => st);
    return snapshot(s);
  },

  async exportState() { return { json: JSON.stringify(await loadState(), null, 2) }; },

  async importState({ json }) {
    let parsed;
    try { parsed = JSON.parse(json); } catch { return { ok: false, error: 'Tệp JSON không hợp lệ.' }; }
    const s = await mutate(() => FG.hydrate(parsed));
    return { ok: true, snapshot: snapshot(s) };
  }
};

function dedupeTabs(list) {
  const seen = new Set();
  return list.filter((t) => (seen.has(t.url) ? false : (seen.add(t.url), true)));
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return;
  const fn = actions[msg.type];
  if (!fn) return;
  Promise.resolve(fn(msg.payload || {}))
    .then((r) => sendResponse({ ok: true, data: r }))
    .catch((e) => {
      console.error('[FocusGate]', msg.type, e);
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    });
  return true; // trả lời bất đồng bộ
});

// Cầu nối cho kiểm thử tự động (service worker không tự gửi message cho chính nó).
// Không lộ ra ngoài web: phạm vi chỉ trong service worker của extension.
globalThis.__FG__ = { actions, loadState, saveState, applyState, snapshot, FG };

// Khởi động nguội
chrome.alarms.create('fg-tick', { periodInMinutes: 1 });
loadState().then(applyState).catch((e) => console.error('[FocusGate] init', e));
