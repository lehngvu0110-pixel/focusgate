import { send, $, fill, el, toast, fmtClock, fmtRelative, CHECK_SVG, onStateChanged, applyTheme } from './shared.js';

let snap = null;

async function refresh() {
  snap = await send('get');
  render();
}

function render() {
  const { gate, summary, state } = snap;
  applyTheme(state.settings?.theme);
  $('#streakLine').textContent = summary.streak > 0
    ? `🔥 ${summary.streak} ngày liên tiếp · ${summary.points} điểm`
    : `${summary.points} điểm · ${summary.focusMin} phút hôm nay`;

  const locked = gate.active;
  const unlocked = !!gate.unlockedUntil;
  fill($('#banner'), el('div', {
    class: 'banner',
    style: unlocked ? 'background:var(--warn-soft);color:var(--warn);border-color:color-mix(in srgb,var(--warn) 32%,transparent)'
      : locked ? 'background:var(--danger-soft);color:var(--danger);border-color:var(--danger-line)'
      : 'background:var(--success-soft);color:var(--success);border-color:color-mix(in srgb,var(--success) 32%,transparent)'
  },
    el('span', { html: locked && !unlocked
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/></svg>' }),
    el('span', { class: 'grow txt' },
      unlocked ? `Mở tạm · ${fmtRelative(gate.unlockedUntil)}`
        : locked ? gate.reasons.map((r) => r.label).join(' · ')
        : 'Cổng đang mở — không còn việc bắt buộc'),
    unlocked && el('button', {
      class: 'btn btn-sm', onclick: async () => { await send('cancelUnlock'); await refresh(); }
    }, 'Khoá lại')));

  const s = state.session;
  fill($('#miniTimer'), s ? el('div', { class: 'card mini-timer' },
    el('div', { class: 'n', id: 'mt' }, fmtClock(s.paused ? s.durationMs - (s.elapsedBeforePause || 0) : s.endsAt - Date.now())),
    el('div', { class: 'grow tiny muted' }, { focus: 'Phiên tập trung', break: 'Nghỉ ngắn', longBreak: 'Nghỉ dài' }[s.phase]),
    el('button', { class: 'btn btn-sm', onclick: async () => { await send(s.paused ? 'resumeSession' : 'pauseSession'); await refresh(); } }, s.paused ? '▶' : '❚❚'),
    el('button', { class: 'btn btn-sm btn-ghost', onclick: async () => { await send('stopSession'); await refresh(); } }, '■')) : null);

  const blockingIds = new Set(gate.tasks.map((t) => t.id));
  const pending = state.tasks.filter((t) => t.status !== 'done')
    .sort((a, b) => (blockingIds.has(b.id) - blockingIds.has(a.id)) || ((a.dueAt || 9e15) - (b.dueAt || 9e15)))
    .slice(0, 6);

  fill($('#list'), ...(pending.length ? pending.map((t) =>
    el('div', { class: 'task' + (blockingIds.has(t.id) ? ' is-blocking' : '') },
      el('button', {
        class: 'check', role: 'checkbox', 'aria-checked': 'false', html: CHECK_SVG,
        'aria-label': 'Hoàn thành: ' + t.title,
        onclick: async () => { await send('completeTask', { id: t.id }); toast('Xong! +10 điểm'); await refresh(); }
      }),
      el('div', { class: 'grow' },
        el('div', { class: 'task-title' }, t.title),
        blockingIds.has(t.id) && el('div', { class: 'task-meta' }, el('span', { class: 'badge badge-danger' }, 'Bắt buộc'))),
      el('button', {
        class: 'btn btn-sm btn-ghost', title: 'Tập trung việc này',
        onclick: async () => { await send('startSession', { taskId: t.id }); await refresh(); }
      }, '▶')))
    : [el('div', { class: 'card empty small' }, 'Không còn việc nào. Nghỉ ngơi thôi!')]));
}

$('#openDash').onclick = () => { send('openDashboard'); window.close(); };
$('#add').onclick = addQuick;
$('#quick').addEventListener('keydown', (e) => { if (e.key === 'Enter') addQuick(); });
async function addQuick() {
  const v = $('#quick').value.trim();
  if (!v) return;
  await send('addTask', { title: v, enforce: true });
  $('#quick').value = '';
  toast('Đã thêm');
  await refresh();
}
$('#focus25').onclick = async () => {
  const first = snap.gate.tasks[0] || snap.state.tasks.find((t) => t.status !== 'done');
  await send('startSession', { taskId: first?.id || null });
  toast('Bắt đầu tập trung');
  await refresh();
};
$('#saveTabs').onclick = async () => {
  const first = snap.state.tasks.find((t) => t.status !== 'done');
  if (!first) { toast('Thêm một việc trước đã'); return; }
  const r = await send('captureTabs', { taskId: first.id });
  toast(`Đã lưu ${r.tabs.length} tab vào "${first.title}"`);
  await refresh();
};

onStateChanged(() => refresh());
setInterval(() => {
  const s = snap?.state?.session;
  const n = document.getElementById('mt');
  if (s && n) n.textContent = fmtClock(s.paused ? s.durationMs - (s.elapsedBeforePause || 0) : s.endsAt - Date.now());
}, 1000);
refresh().catch((e) => { document.body.textContent = 'Lỗi: ' + e.message; });
