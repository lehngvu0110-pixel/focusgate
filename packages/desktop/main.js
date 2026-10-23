/**
 * FocusGate Desktop (macOS) — tiến trình chính.
 * Nhiệm vụ: nhắc việc ngay khi bật máy, khoá màn hình cho tới khi xong việc,
 * canh chừng các app gây xao nhãng, và đồng bộ với extension trình duyệt.
 */
import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, powerMonitor, shell, Notification } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, defaultStoreFile } from './src/store.js';
import { createSyncServer } from './src/sync-server.js';
import { IS_MAC, frontmostApp, runningApps, hideApp, isAppBlocked } from './src/mac.js';
import * as FG from './vendor/core/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_SMOKE = process.env.FG_SMOKE === '1';                 // bật rồi tự thoát — dùng cho kiểm thử nhanh
const IS_TEST = IS_SMOKE || process.env.FG_TEST === '1';       // chế độ kiểm thử: cửa sổ thường, không đụng login item

let store;
let lockWin = null;
let panelWin = null;
let tray = null;
let sync = null;
let monitorTimer = null;
let tickTimer = null;
let quitting = false;

/* ------------------------------------------------------------------ */
/* Chỉ cho phép một bản chạy                                           */
/* ------------------------------------------------------------------ */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showLock('second-instance'));
}

app.on('ready', async () => {
  store = new Store(process.env.FG_STATE_FILE || defaultStoreFile(app.getPath('userData')));

  if (IS_MAC) app.dock?.hide();            // sống ở thanh menu, không chiếm Dock

  try { createTray(); } catch (e) { console.error('[FocusGate] không tạo được biểu tượng thanh menu:', e.message); }
  await startSync();
  applyLoginItem();

  store.onChange(() => {
    broadcast();
    updateTray();
    enforce('state-change');
  });

  tickTimer = setInterval(onTick, 20_000);
  monitorTimer = setInterval(watchApps, 3000);

  try {
    powerMonitor.on('resume', () => showLock('resume'));
    powerMonitor.on('unlock-screen', () => showLock('unlock-screen'));
    // Tắt máy / đăng xuất: không được chặn hệ điều hành (nếu không macOS báo "FocusGate đã huỷ tắt máy").
    powerMonitor.on('shutdown', () => { quitting = true; app.quit(); });
  } catch (e) { console.error('[FocusGate] powerMonitor:', e.message); }

  updateTray();
  enforce('startup');

  if (IS_SMOKE) {
    // Chế độ kiểm thử tự động: mở cửa sổ, báo kết quả rồi thoát.
    setTimeout(async () => {
      const report = {
        ok: true,
        lockWindow: !!lockWin && !lockWin.isDestroyed(),
        trayCreated: !!tray,
        syncPort: sync?.port ?? null,
        gateActive: store.gate().active,
        stateFile: store.file
      };
      console.log('FG_SMOKE_REPORT ' + JSON.stringify(report));
      quitting = true;
      app.quit();
    }, 2500);
  }
});

app.on('window-all-closed', () => { /* giữ app sống ở thanh menu */ });

/** Nhịp đồng hồ: cập nhật state theo thời gian, báo sự kiện, và áp lại cổng
 *  (khung giờ bắt đầu/kết thúc làm cổng đổi mà state không hề đổi). */
function onTick() {
  if (!store) return;
  let events = [];
  try { events = store.tick(); } catch (e) { console.error('[FocusGate] tick:', e.message); }
  for (const e of events) {
    if (e.type === 'unlock-expired') notify('Hết giờ nghỉ', 'Cổng tập trung đã khoá lại. Quay lại với việc của bạn nhé.');
    else if (e.type === 'focus-ended') notify('Hết một phiên tập trung', `${e.next === 'longBreak' ? 'Nghỉ dài' : 'Nghỉ ngắn'} ${e.minutes || 5} phút nào.`);
    else if (e.type === 'reminder') notify('Tới giờ: ' + e.task.title, e.task.enforce ? 'Màn hình khoá đã bật.' : 'Nhắc nhẹ thôi nhé.');
  }
  updateTray();
  enforce('tick');
}

/** Chỉ mở link web thật ra trình duyệt; mọi thứ khác (file:, javascript:...) bị bỏ qua. */
function openSafeExternal(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') { shell.openExternal(u.href); return true; }
  } catch { /* URL hỏng */ }
  return false;
}

/** Cửa sổ chỉ hiển thị trang nội bộ, không bao giờ điều hướng ra ngoài. */
function lockDown(win) {
  win.webContents.setWindowOpenHandler(({ url }) => { openSafeExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); openSafeExternal(url); }
  });
}

app.on('before-quit', (e) => {
  if (quitting) return;
  const gate = store.gate();
  if (gate.active) {
    e.preventDefault();
    showLock('quit-attempt');
    notify('Chưa xong việc', 'Hoàn thành việc bắt buộc rồi hãy tắt FocusGate.');
  }
});

/* ------------------------------------------------------------------ */
/* Cửa sổ khoá                                                         */
/* ------------------------------------------------------------------ */
function createLockWindow() {
  const win = new BrowserWindow({
    show: false,
    frame: false,
    fullscreen: !IS_TEST,
    kiosk: false,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    closable: false,
    backgroundColor: '#0e0f14',
    width: 1100,
    height: 760,
    title: 'FocusGate',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(join(__dirname, 'renderer/lock.html'));
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.on('close', (e) => {
    if (!quitting && store.gate().active) e.preventDefault();
  });
  win.on('closed', () => { lockWin = null; });
  lockDown(win);
  return win;
}

function showLock(reason = '') {
  if (!store) return;
  if (!store.gate().active) return;
  if (!lockWin || lockWin.isDestroyed()) lockWin = createLockWindow();
  lockWin.show();
  lockWin.focus();
  lockWin.setAlwaysOnTop(true, 'screen-saver');
  if (IS_MAC) app.focus({ steal: true });
  lockWin.webContents.send('fg:shown', { reason });
}

function hideLock() {
  if (lockWin && !lockWin.isDestroyed()) lockWin.hide();
}

/** Bật/tắt màn hình khoá cho khớp trạng thái cổng. */
function enforce(reason) {
  if (!store) return;
  const gate = store.gate();
  if (gate.active) showLock(reason);
  else hideLock();
}

/* ------------------------------------------------------------------ */
/* Cửa sổ cài đặt nhỏ                                                  */
/* ------------------------------------------------------------------ */
function showPanel() {
  if (panelWin && !panelWin.isDestroyed()) { panelWin.show(); panelWin.focus(); return; }
  panelWin = new BrowserWindow({
    width: 560, height: 680, title: 'FocusGate — Cài đặt',
    backgroundColor: '#f6f7fb',
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  lockDown(panelWin);
  panelWin.loadFile(join(__dirname, 'renderer/panel.html'));
  panelWin.on('closed', () => { panelWin = null; });
}

/* ------------------------------------------------------------------ */
/* Thanh menu (tray)                                                   */
/* ------------------------------------------------------------------ */
function createTray() {
  const img = nativeImage.createFromPath(join(__dirname, 'assets/trayTemplate.png'));
  img.setTemplateImage(true);
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip('FocusGate');
  updateTray();
}

function updateTray() {
  if (!tray || !store) return;
  const gate = store.gate();
  const sum = store.summary();
  const label = gate.active ? `Đang khoá — ${gate.tasks.length} việc` : 'Cổng đang mở';
  tray.setToolTip('FocusGate · ' + label);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label, enabled: false },
    { label: `🔥 ${sum.streak} ngày liên tiếp · ${sum.points} điểm`, enabled: false },
    { type: 'separator' },
    { label: 'Mở màn hình việc cần làm', click: () => { if (store.gate().active) showLock('tray'); else showPanel(); } },
    { label: 'Cài đặt…', click: showPanel },
    { type: 'separator' },
    {
      label: gate.active ? 'Thoát (đang bị khoá)' : 'Thoát FocusGate',
      enabled: !gate.active,
      click: () => { quitting = true; app.quit(); }
    }
  ]));
}

/* ------------------------------------------------------------------ */
/* Canh chừng app gây xao nhãng                                        */
/* ------------------------------------------------------------------ */
async function watchApps() {
  if (!store || !IS_MAC) return;
  const gate = store.gate();
  if (!gate.active) return;
  const blocked = store.get().settings.blockedApps || [];
  if (!blocked.length) return;
  const front = await frontmostApp();
  if (!front || front === 'Electron' || front === 'FocusGate') return;
  if (!isAppBlocked(front, blocked)) return;
  await hideApp(front);
  showLock('blocked-app:' + front);
  notify('Ứng dụng bị khoá', `"${front}" nằm trong danh sách chặn. Xong việc rồi mở lại nhé.`);
}

function notify(title, body) {
  try { if (Notification.isSupported()) new Notification({ title, body }).show(); } catch { /* bỏ qua */ }
}

/* ------------------------------------------------------------------ */
/* Tự khởi động cùng macOS                                             */
/* ------------------------------------------------------------------ */
function applyLoginItem() {
  if (IS_TEST || !app.setLoginItemSettings) return;
  const want = store.get().settings.launchAtLogin !== false;
  try { app.setLoginItemSettings({ openAtLogin: want, openAsHidden: true }); }
  catch (e) { console.error('[FocusGate] login item:', e.message); }
}

/* ------------------------------------------------------------------ */
/* Máy chủ đồng bộ                                                     */
/* ------------------------------------------------------------------ */
async function startSync() {
  const port = store.get().settings.syncPort || 47823;
  try {
    sync = createSyncServer(store, { port });
    sync.port = await sync.listen();
    console.log('[FocusGate] đồng bộ tại http://127.0.0.1:' + sync.port);
  } catch (e) {
    console.error('[FocusGate] không mở được cổng đồng bộ:', e.message);
    sync = null;
  }
}

/* ------------------------------------------------------------------ */
/* Cầu nối với giao diện                                               */
/* ------------------------------------------------------------------ */
function payload() {
  return { state: store.get(), gate: store.gate(), summary: store.summary(), now: Date.now() };
}
function broadcast() {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('fg:state', payload());
  }
}

const handlers = {
  get: () => payload(),
  addTask: (p) => {
    if (!String(p?.title || '').trim()) throw new Error('Việc cần có tên.');
    store.addTask(p); return payload();
  },
  completeTask: (p) => { store.completeTask(p.id); return payload(); },
  uncompleteTask: (p) => { store.uncompleteTask(p.id); return payload(); },
  deleteTask: (p) => { store.deleteTask(p.id, { guard: true }); return payload(); },
  updateSettings: (p) => { store.updateSettings(p.patch, { guard: true }); applyLoginItem(); return payload(); },
  cancelUnlock: () => { store.cancelUnlock(); return payload(); },
  emergencyInfo: () => store.emergencyInfo(),
  emergencyUnlock: (p) => {
    const r = store.emergency(p.typed);
    return r.ok ? { ok: true, ...payload() } : r;
  },
  startSession: (p) => { store.update((s) => FG.startSession(s, { taskId: p.taskId, phase: p.phase || 'focus' })); return payload(); },
  pauseSession: () => { store.update((s) => FG.pauseSession(s)); return payload(); },
  resumeSession: () => { store.update((s) => FG.resumeSession(s)); return payload(); },
  stopSession: () => { store.update((s) => FG.endSession(s)); return payload(); },
  listRunningApps: async () => ({ apps: await runningApps() }),
  openPanel: () => { showPanel(); return { ok: true }; },
  showLock: () => {
    if (!store.gate().active) return { ok: false, error: 'Không còn việc bắt buộc nào — cổng đang mở.' };
    showLock('panel'); return { ok: true };
  },
  openExternal: (p) => ({ ok: openSafeExternal(p?.url) }),
  quitApp: () => {
    if (store.gate().active) return { ok: false, error: 'Còn việc chưa xong — chưa thoát được.' };
    quitting = true; app.quit(); return { ok: true };
  }
};

// Cầu nối cho kiểm thử tự động (chỉ tồn tại khi FG_TEST=1).
if (IS_TEST) {
  app.whenReady().then(() => { globalThis.__FG_TEST__ = { get store() { return store; }, handlers }; });
}

ipcMain.handle('fg:call', async (_e, type, p = {}) => {
  const fn = handlers[type];
  if (!fn) throw new Error('Không có hành động: ' + type);
  try {
    return await fn(p);
  } catch (e) {
    // Lỗi có chủ đích (ví dụ người gác từ chối) trả về như dữ liệu để giao diện hiện đúng câu chữ,
    // thay vì bị Electron bọc thành "Error invoking remote method…".
    return { ok: false, error: String(e?.message || e) };
  }
});

app.on('will-quit', () => {
  clearInterval(monitorTimer);
  clearInterval(tickTimer);
  sync?.close?.();
});
