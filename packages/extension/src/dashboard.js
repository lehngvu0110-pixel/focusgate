import {
  send, $, fill, $$, el, toast, fmtWhen, fmtRelative, fmtDuration, hostOf,
  toLocalInput, fromLocalInput, CHECK_SVG, onStateChanged, REPEAT_LABELS, applyTheme
} from './shared.js';

let snap = null;
let draftTabs = [];
let showDone = false;

/* ------------------------------------------------------------------ */
/* Khung: tab điều hướng                                               */
/* ------------------------------------------------------------------ */
$$('.tabs button').forEach((btn) => {
  btn.onclick = () => {
    $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + btn.dataset.tab));
    location.hash = btn.dataset.tab;
  };
});
if (location.hash) {
  const b = $(`.tabs button[data-tab="${location.hash.slice(1)}"]`);
  if (b) b.click();
}

async function refresh() {
  snap = await send('get');
  applyTheme(snap.state.settings?.theme);
  renderStatus();
  renderTasks();
  renderBlock();
  renderStats();
  renderSettings();
}

/* ------------------------------------------------------------------ */
/* Trạng thái cổng                                                     */
/* ------------------------------------------------------------------ */
function renderStatus() {
  const { gate, summary } = snap;
  const locked = gate.active;
  const unlocked = !!gate.unlockedUntil;
  const color = unlocked ? 'var(--warn)' : locked ? 'var(--danger)' : 'var(--success)';
  const bg = unlocked ? 'var(--warn-soft)' : locked ? 'var(--danger-soft)' : 'var(--success-soft)';
  const text = unlocked ? `Mở tạm · ${fmtRelative(gate.unlockedUntil)}`
    : locked ? `Đang khoá · ${gate.reasons.map((r) => r.label).join(' · ')}`
    : 'Cổng đang mở';
  fill($('#statusPill'), 
    el('span', { class: 'status-pill', style: `background:${bg};color:${color}` },
      el('span', { class: 'dot' }), text),
    summary.streak > 0 && el('span', { class: 'badge badge-success', style: 'margin-left:8px' }, `🔥 ${summary.streak}`)
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Việc cần làm                                                   */
/* ------------------------------------------------------------------ */
function renderTasks() {
  const now = Date.now();
  const blockingIds = new Set(snap.gate.tasks.map((t) => t.id));
  const pending = snap.state.tasks.filter((t) => t.status !== 'done')
    .sort((a, b) => (blockingIds.has(b.id) - blockingIds.has(a.id)) || ((a.dueAt || 9e15) - (b.dueAt || 9e15)));
  const done = snap.state.tasks.filter((t) => t.status === 'done')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  $('#pendingHead').textContent = `Chưa xong (${pending.length})`;
  fill($('#pendingList'), ...(pending.length
    ? pending.map((t) => taskCard(t, blockingIds.has(t.id), now))
    : [el('div', { class: 'card empty' }, 'Chưa có việc nào. Thêm một việc ở trên để FocusGate bắt đầu bảo vệ bạn.')]));

  $('#toggleDone').textContent = showDone ? 'Ẩn việc đã xong' : `Hiện việc đã xong (${done.length})`;
  $('#doneWrap').classList.toggle('hidden', !showDone);
  fill($('#doneList'), ...(done.length
    ? done.slice(0, 50).map((t) => taskCard(t, false, now))
    : [el('div', { class: 'card empty' }, 'Chưa có việc nào hoàn thành.')]));

  renderDraftTabs();
}

function taskCard(t, blocking, now) {
  const isDone = t.status === 'done';
  const overdue = !isDone && t.dueAt && t.dueAt < now;
  return el('div', { class: `task${isDone ? ' is-done' : ''}${blocking ? ' is-blocking' : ''}${overdue ? ' is-overdue' : ''}` },
    el('button', {
      class: 'check', role: 'checkbox', 'aria-checked': String(isDone),
      'aria-label': (isDone ? 'Bỏ đánh dấu: ' : 'Hoàn thành: ') + t.title, html: CHECK_SVG,
      onclick: async () => {
        await send(isDone ? 'uncompleteTask' : 'completeTask', { id: t.id });
        toast(isDone ? 'Đã mở lại việc' : 'Xong! +10 điểm');
        await refresh();
      }
    }),
    el('div', { class: 'grow' },
      el('div', { class: 'task-title' }, t.title),
      t.note && el('div', { class: 'small muted', style: 'margin-top:3px;white-space:pre-wrap' }, t.note),
      el('div', { class: 'task-meta' },
        blocking && el('span', { class: 'badge badge-danger' }, 'Bắt buộc'),
        overdue && el('span', { class: 'badge badge-warn' }, 'Quá hạn'),
        t.dueAt && !overdue && !isDone && el('span', { class: 'badge' }, 'Hạn ' + fmtWhen(t.dueAt, now)),
        t.remindAt && t.remindAt > now && el('span', { class: 'badge' }, 'Nhắc ' + fmtWhen(t.remindAt, now)),
        t.repeat && t.repeat !== 'none' && el('span', { class: 'badge' }, REPEAT_LABELS[t.repeat]),
        t.focusSec > 0 && el('span', { class: 'badge' }, fmtDuration(Math.round(t.focusSec / 60)) + ' đã tập trung'),
        isDone && t.completedAt && el('span', { class: 'badge badge-success' }, 'Xong ' + fmtWhen(t.completedAt, now))
      ),
      t.tabs?.length > 0 && el('div', { class: 'chips', style: 'margin-top:8px' },
        ...t.tabs.slice(0, 6).map((tab) => el('span', { class: 'chip', title: tab.url }, el('span', {}, hostOf(tab.url)))),
        t.tabs.length > 6 && el('span', { class: 'chip' }, el('span', {}, `+${t.tabs.length - 6}`)))
    ),
    el('div', { class: 'task-actions' },
      !isDone && t.tabs?.length > 0 && iconBtn('Mở tab công việc', 'M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6v6M20 4l-9 9',
        async () => { const r = await send('openWorkTabs', { id: t.id }); toast(`Đã mở ${r.opened} tab`); }),
      !isDone && iconBtn('Bắt đầu tập trung', 'M12 8v4l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
        async () => { await send('startSession', { taskId: t.id }); toast('Đang tập trung'); await refresh(); }),
      !isDone && iconBtn('Lưu tab đang mở vào việc này', 'M12 5v14M5 12h14',
        async () => { const r = await send('captureTabs', { taskId: t.id }); toast(`Đã lưu ${r.tabs.length} tab`); await refresh(); }),
      confirmBtn('Xoá việc', 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
        async () => { await send('deleteTask', { id: t.id }); toast('Đã xoá'); await refresh(); })
    )
  );
}

function iconBtn(title, path, onclick) {
  return el('button', { class: 'btn btn-sm btn-ghost', title, 'aria-label': title, onclick },
    el('span', { html: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>` }));
}

/** Nút cần bấm hai lần để xác nhận (thay cho hộp thoại confirm gây treo trang). */
function confirmBtn(title, path, onconfirm) {
  let armed = false; let timer;
  const disarm = () => { armed = false; btn.classList.remove('btn-danger'); btn.classList.add('btn-ghost'); fill(btn, iconSpan(path)); };
  const btn = iconBtn(title, path, () => {
    if (!armed) {
      armed = true;
      btn.classList.add('btn-danger'); btn.classList.remove('btn-ghost');
      btn.textContent = 'Chắc chưa?';
      timer = setTimeout(disarm, 3000);
      return;
    }
    clearTimeout(timer);
    // bị từ chối (ví dụ việc bắt buộc khi cổng đang khoá) thì nút trở lại bình thường
    return Promise.resolve(onconfirm()).finally(disarm);
  });
  return btn;
}
function iconSpan(path) {
  return el('span', { html: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>` });
}

/* --- Form thêm việc --- */
function renderDraftTabs() {
  fill($('#tTabs'), ...draftTabs.map((tab, i) =>
    el('span', { class: 'chip', title: tab.url },
      el('span', {}, tab.title || hostOf(tab.url)),
      el('button', { 'aria-label': 'Bỏ tab', onclick: () => { draftTabs.splice(i, 1); renderDraftTabs(); } }, '×'))));
}

$('#tPickTabs').onclick = async () => {
  const { tabs } = await send('listTabs');
  if (!tabs.length) { toast('Không có tab nào để chọn'); return; }
  const picker = el('div', { class: 'card card-pad', style: 'margin-top:10px' },
    el('div', { class: 'strong', style: 'margin-bottom:8px' }, 'Chọn tab muốn gắn vào việc'),
    el('div', { class: 'stack', style: 'max-height:240px;overflow:auto' },
      ...tabs.map((t) => el('label', { class: 'row', style: 'cursor:pointer;gap:10px' },
        el('input', { type: 'checkbox', value: t.url, style: 'width:auto' }),
        el('span', { class: 'grow small', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, t.title),
        el('span', { class: 'tiny muted' }, hostOf(t.url))))),
    el('div', { class: 'row', style: 'margin-top:12px' },
      el('button', {
        class: 'btn btn-sm btn-primary', onclick: () => {
          const chosen = [...picker.querySelectorAll('input:checked')].map((i) => i.value);
          for (const url of chosen) {
            if (!draftTabs.some((d) => d.url === url)) draftTabs.push({ url, title: tabs.find((t) => t.url === url)?.title || url });
          }
          picker.remove(); renderDraftTabs();
        }
      }, 'Thêm các tab đã chọn'),
      el('button', { class: 'btn btn-sm btn-ghost', onclick: () => picker.remove() }, 'Huỷ')));
  $('#tTabs').after(picker);
};

$('#tAddUrl').onclick = () => {
  const box = el('div', { class: 'row', style: 'margin-top:10px' },
    el('input', { type: 'url', class: 'grow', placeholder: 'https://…', id: 'manualUrl' }),
    el('button', {
      class: 'btn btn-sm btn-primary', onclick: () => {
        const v = box.querySelector('#manualUrl').value.trim();
        if (!v) return;
        draftTabs.push({ url: /^https?:/i.test(v) ? v : 'https://' + v, title: hostOf(v) });
        box.remove(); renderDraftTabs();
      }
    }, 'Thêm'),
    el('button', { class: 'btn btn-sm btn-ghost', onclick: () => box.remove() }, 'Huỷ'));
  $('#tTabs').after(box);
  box.querySelector('#manualUrl').focus();
};

$('#tAdd').onclick = async () => {
  const title = $('#tTitle').value.trim();
  if (!title) { $('#tTitle').focus(); toast('Nhập tên việc đã nhé'); return; }
  await send('addTask', {
    title,
    note: $('#tNote').value.trim(),
    remindAt: fromLocalInput($('#tRemind').value),
    dueAt: fromLocalInput($('#tDue').value),
    repeat: $('#tRepeat').value,
    estimateMin: Number($('#tEstimate').value) || 25,
    enforce: $('#tEnforce').checked,
    tabs: draftTabs
  });
  ['#tTitle', '#tNote', '#tRemind', '#tDue'].forEach((s) => { $(s).value = ''; });
  $('#tRepeat').value = 'none'; $('#tEstimate').value = '25'; $('#tEnforce').checked = true;
  draftTabs = [];
  toast('Đã thêm việc');
  await refresh();
};
$('#tTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#tAdd').click(); });
$('#toggleDone').onclick = () => { showDone = !showDone; renderTasks(); };

/* ------------------------------------------------------------------ */
/* Tab: Chặn & lịch                                                    */
/* ------------------------------------------------------------------ */
function renderBlock() {
  const s = snap.state.settings;
  $('#modeAllow').checked = s.mode === 'allowlist';
  $('#modeBlock').checked = s.mode === 'blocklist';
  renderPatternList('#allowList', s.allowlist, 'allowlist');
  renderPatternList('#blockList', s.blocklist, 'blocklist');
  renderSchedules(s.schedules || []);
}

$$('input[name="mode"]').forEach((r) => {
  r.onchange = async () => { await send('updateSettings', { patch: { mode: r.value } }); toast('Đã đổi chế độ chặn'); await refresh(); };
});

function renderPatternList(sel, list, key) {
  fill($(sel), ...(list.length
    ? list.map((p) => el('span', { class: 'chip' }, el('span', {}, p),
        el('button', {
          'aria-label': 'Bỏ ' + p,
          onclick: async () => {
            await send('updateSettings', { patch: { [key]: snap.state.settings[key].filter((x) => x !== p) } });
            await refresh();
          }
        }, '×')))
    : [el('span', { class: 'small muted' }, 'Danh sách đang trống.')]));
}

async function addPattern(inputSel, key) {
  const input = $(inputSel);
  const v = input.value.trim();
  if (!v) return;
  const cur = snap.state.settings[key] || [];
  if (cur.includes(v)) { toast('Đã có trong danh sách'); input.value = ''; return; }
  await send('updateSettings', { patch: { [key]: [...cur, v] } });
  input.value = '';
  await refresh();
}
$('#allowAdd').onclick = () => addPattern('#allowInput', 'allowlist');
$('#blockAdd').onclick = () => addPattern('#blockInput', 'blocklist');
$('#allowInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addPattern('#allowInput', 'allowlist'); });
$('#blockInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addPattern('#blockInput', 'blocklist'); });

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function renderSchedules(list) {
  fill($('#schedList'), ...(list.length
    ? list.map((sc) => el('div', { class: 'card sched' },
        el('label', { class: 'switch' },
          el('input', { type: 'checkbox', checked: sc.enabled !== false, onchange: (e) => patchSched(sc.id, { enabled: e.target.checked }) }),
          el('span', { class: 'track' })),
        el('input', { type: 'time', value: sc.start, style: 'width:110px', onchange: (e) => patchSched(sc.id, { start: e.target.value }) }),
        el('span', { class: 'muted' }, '→'),
        el('input', { type: 'time', value: sc.end, style: 'width:110px', onchange: (e) => patchSched(sc.id, { end: e.target.value }) }),
        el('div', { class: 'dow' }, ...DOW.map((d, i) =>
          el('button', {
            'aria-pressed': String((sc.days || []).includes(i)), title: d,
            onclick: () => {
              const days = new Set(sc.days || []);
              days.has(i) ? days.delete(i) : days.add(i);
              patchSched(sc.id, { days: [...days].sort() });
            }
          }, d))),
        el('div', { class: 'spacer' }),
        confirmBtn('Xoá khung giờ', 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', async () => {
          await send('updateSettings', { patch: { schedules: snap.state.settings.schedules.filter((x) => x.id !== sc.id) } });
          await refresh();
        })))
    : [el('div', { class: 'empty small' }, 'Chưa có khung giờ nào.')]));
}

async function patchSched(id, patch) {
  const list = (snap.state.settings.schedules || []).map((s) => (s.id === id ? { ...s, ...patch } : s));
  await send('updateSettings', { patch: { schedules: list } });
  await refresh();
}

$('#schedAdd').onclick = async () => {
  const list = [...(snap.state.settings.schedules || []),
    { id: 'sc_' + Date.now().toString(36), days: [1, 2, 3, 4, 5], start: '19:00', end: '22:00', enabled: true }];
  await send('updateSettings', { patch: { schedules: list } });
  toast('Đã thêm khung giờ');
  await refresh();
};

/* ------------------------------------------------------------------ */
/* Tab: Thống kê                                                       */
/* ------------------------------------------------------------------ */
function renderStats() {
  const s = snap.summary;
  fill($('#statGrid'), 
    stat(s.streak, 'ngày liên tiếp', '🔥'),
    stat(s.bestStreak, 'kỷ lục chuỗi'),
    stat(s.points, 'điểm tích luỹ'),
    stat(s.focusMin, 'phút tập trung'),
    stat(s.completedToday, 'việc xong hôm nay'),
    stat(s.pending, 'việc còn lại')
  );
  renderChart();
  renderTodayLog();
}
function stat(n, label, emoji) {
  return el('div', { class: 'stat' },
    el('div', { class: 'n' }, emoji && el('span', { style: 'font-size:19px;margin-right:4px' }, emoji), String(n)),
    el('div', { class: 'l' }, label));
}

const DAYS_SHOWN = 14;
function renderChart() {
  const days = snap.state.stats.days || {};
  const rows = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const d = new Date(snap.now - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    rows.push({ key, date: d, min: Math.round((days[key]?.focusSec || 0) / 60), done: days[key]?.completed || 0 });
  }
  const max = Math.max(1, ...rows.map((r) => r.min));
  const maxIdx = rows.findIndex((r) => r.min === max && max > 0);

  const plot = el('div', { class: 'chart-plot' }, ...rows.map((r, i) => {
    const h = r.min === 0 ? 2 : Math.max(4, Math.round((r.min / max) * 126));
    return el('div', {
      class: 'chart-col' + (r.min === 0 ? ' is-zero' : ''), tabindex: '0',
      role: 'img', 'aria-label': `${r.date.getDate()}/${r.date.getMonth() + 1}: ${r.min} phút tập trung, ${r.done} việc xong`
    },
      el('div', { class: 'chart-tip' }, `${r.date.getDate()}/${r.date.getMonth() + 1} · ${r.min} phút · ${r.done} việc`),
      i === maxIdx && el('div', { class: 'chart-label' }, `${r.min} phút`),
      el('div', { class: 'chart-bar', style: `height:${h}px` }));
  }));

  fill($('#chart'), 
    max > 0 && el('div', { class: 'chart-gridline' }),
    plot,
    el('div', { class: 'chart-days' }, ...rows.map((r, i) =>
      el('div', {}, i % 2 === 0 || i === rows.length - 1 ? `${r.date.getDate()}/${r.date.getMonth() + 1}` : '')))
  );

  const total = rows.reduce((a, r) => a + r.min, 0);
  $('#chartRange').textContent = `${DAYS_SHOWN} ngày · tổng ${fmtDuration(total)}`;
  fill($('#chartTable'), el('div', { class: 'stack' },
    ...rows.slice().reverse().filter((r) => r.min || r.done).map((r) =>
      el('div', { class: 'row small' },
        el('span', { class: 'mono', style: 'width:76px' }, r.key.slice(5)),
        el('span', { class: 'grow' }, `${r.min} phút tập trung`),
        el('span', { class: 'muted' }, `${r.done} việc`))) ,
    rows.every((r) => !r.min && !r.done) && el('div', { class: 'small muted' }, 'Chưa có dữ liệu.')));
}

function renderTodayLog() {
  const s = snap.summary;
  const items = [
    ['Việc hoàn thành', s.completedToday],
    ['Phút tập trung', s.focusMin],
    ['Việc quá hạn', s.overdue],
    ['Lượt thoát khẩn cấp', s.emergenciesToday]
  ];
  fill($('#todayLog'), el('div', { class: 'stack' },
    ...items.map(([l, v]) => el('div', { class: 'row' },
      el('span', { class: 'grow small' }, l),
      el('span', { class: 'strong mono', style: 'font-size:14px' }, String(v))))));
}

/* ------------------------------------------------------------------ */
/* Tab: Cài đặt                                                        */
/* ------------------------------------------------------------------ */
const TOGGLES = [
  ['remindOnBrowserStart', 'Nhắc việc ngay khi mở trình duyệt', 'Mở màn hình nhắc nếu còn việc bắt buộc.'],
  ['closeDistractingTabs', 'Ép cả những tab đang mở sẵn', 'Tab giải trí đang mở cũng bị chuyển về màn hình nhắc.'],
  ['escalateOverdue', 'Việc quá hạn tự thành bắt buộc', 'Không kịp hạn thì cổng tự khoá lại.'],
  ['allowLocalFiles', 'Cho phép mở tệp trên máy (file://)', 'Tắt nếu bạn hay xem phim đã tải về.']
];

function renderSettings() {
  const s = snap.state.settings;
  fill($('#behaviorToggles'), ...TOGGLES.map(([key, title, desc]) =>
    el('label', { class: 'row', style: 'gap:12px;cursor:pointer;align-items:flex-start' },
      el('span', { class: 'switch', style: 'margin-top:2px' },
        el('input', {
          type: 'checkbox', checked: s[key] !== false,
          onchange: async (e) => { await send('updateSettings', { patch: { [key]: e.target.checked } }); toast('Đã lưu'); await refresh(); }
        }), el('span', { class: 'track' })),
      el('span', { class: 'grow' },
        el('span', { class: 'strong small', style: 'display:block;color:var(--text)' }, title),
        el('span', { class: 'tiny muted' }, desc)))));

  $('#syncEnabled').checked = s.syncEnabled !== false;
  if ($('#themeSelect') !== document.activeElement) $('#themeSelect').value = s.theme === 'light' ? 'light' : 'dark';
  refreshDesktopStatus();

  const setVal = (sel, v) => { const n = $(sel); if (n && n !== document.activeElement) n.value = v; };
  const p = s.pomodoro;
  setVal('#pFocus', p.focusMin); setVal('#pBreak', p.breakMin);
  setVal('#pLong', p.longBreakMin); setVal('#pCycles', p.cyclesPerLongBreak);
  const e = s.emergency;
  setVal('#eCooldown', e.cooldownSec); setVal('#eUnlock', e.unlockMinutes); setVal('#eMax', e.maxPerDay);
  if ($('#eEnabled') !== document.activeElement) $('#eEnabled').checked = e.enabled !== false;
}

const POMO_FIELDS = { '#pFocus': 'focusMin', '#pBreak': 'breakMin', '#pLong': 'longBreakMin', '#pCycles': 'cyclesPerLongBreak' };
for (const [sel, key] of Object.entries(POMO_FIELDS)) {
  $(sel).onchange = async (ev) => {
    const v = Number(ev.target.value);
    if (!Number.isFinite(v) || v <= 0) { toast('Giá trị không hợp lệ'); await refresh(); return; }
    await send('updateSettings', { patch: { pomodoro: { ...snap.state.settings.pomodoro, [key]: v } } });
    toast('Đã lưu'); await refresh();
  };
}
const EMER_FIELDS = { '#eCooldown': 'cooldownSec', '#eUnlock': 'unlockMinutes', '#eMax': 'maxPerDay' };
for (const [sel, key] of Object.entries(EMER_FIELDS)) {
  $(sel).onchange = async (ev) => {
    const v = Number(ev.target.value);
    if (!Number.isFinite(v) || v < 0) { toast('Giá trị không hợp lệ'); await refresh(); return; }
    await send('updateSettings', { patch: { emergency: { ...snap.state.settings.emergency, [key]: v } } });
    toast('Đã lưu'); await refresh();
  };
}
$('#eEnabled').onchange = async (ev) => {
  await send('updateSettings', { patch: { emergency: { ...snap.state.settings.emergency, enabled: ev.target.checked } } });
  toast(ev.target.checked ? 'Đã bật lối thoát' : 'Chế độ cứng tuyệt đối đang bật');
  await refresh();
};

$('#themeSelect').onchange = async (e) => {
  applyTheme(e.target.value);
  await send('updateSettings', { patch: { theme: e.target.value } });
  toast(e.target.value === 'light' ? 'Đã chuyển sang giao diện sáng' : 'Đã chuyển sang giao diện tối');
  await refresh();
};

$('#syncEnabled').onchange = async (e) => {
  await send('updateSettings', { patch: { syncEnabled: e.target.checked } });
  toast(e.target.checked ? 'Đã bật đồng bộ' : 'Đã tắt đồng bộ');
  await refresh();
};

let desktopTimer = 0;
async function refreshDesktopStatus() {
  if (Date.now() - desktopTimer < 4000) return;
  desktopTimer = Date.now();
  const node = $('#desktopStatus');
  if (!node) return;
  try {
    const r = await send('desktopStatus');
    if (r.connected) {
      node.style.background = 'var(--success-soft)'; node.style.color = 'var(--success)';
      fill(node, el('span', { class: 'dot' }), `Đã kết nối app desktop (cổng ${r.port})`);
    } else {
      node.style.background = 'var(--surface-2)'; node.style.color = 'var(--muted)';
      fill(node, el('span', { class: 'dot' }), r.reason || 'Chưa kết nối');
    }
  } catch {
    fill(node, el('span', { class: 'dot' }), 'Chưa kết nối');
  }
}

$('#exportBtn').onclick = async () => {
  const { json } = await send('exportState');
  const blob = new Blob([json], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `focusgate-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  toast('Đã tải tệp sao lưu');
};
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  const json = await file.text();
  ev.target.value = '';
  const r = await send('importState', { json });
  toast(r.ok ? 'Đã nhập dữ liệu' : r.error);
  await refresh();
};

let resetArmed = false;
$('#resetBtn').onclick = async () => {
  if (!resetArmed) {
    resetArmed = true;
    $('#resetBtn').textContent = 'Bấm lần nữa để xoá vĩnh viễn';
    setTimeout(() => { resetArmed = false; $('#resetBtn').textContent = 'Xoá sạch dữ liệu'; }, 4000);
    return;
  }
  try {
    await send('resetAll');
    toast('Đã xoá sạch dữ liệu');
  } finally {
    resetArmed = false;
    $('#resetBtn').textContent = 'Xoá sạch dữ liệu';
  }
  await refresh();
};

/* ------------------------------------------------------------------ */
onStateChanged(() => refresh());
// Thao tác bị từ chối (đã có toast báo lý do): vẽ lại theo state thật để công tắc/ô chọn không "nói dối".
window.addEventListener('unhandledrejection', () => { refresh().catch(() => {}); });
setInterval(refresh, 30000);
refresh().catch((e) => {
  document.body.prepend(el('div', { class: 'card card-pad', style: 'margin:20px' },
    el('div', { class: 'strong' }, 'Không kết nối được FocusGate'), el('div', { class: 'small muted' }, String(e.message || e))));
});
