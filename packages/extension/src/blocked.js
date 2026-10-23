import { send, $, fill, el, toast, fmtClock, fmtWhen, fmtRelative, hostOf, CHECK_SVG, onStateChanged, applyTheme } from './shared.js';

/* ---- URL người dùng vừa định mở ---- */
function attemptedUrl() {
  const q = location.search;
  const i = q.indexOf('u=');
  if (i === -1) return null;
  let raw = q.slice(i + 2);
  // Luật DNR chép nguyên URL (chưa mã hoá); tab bị kéo về thì URL đã qua encodeURIComponent.
  // Chỉ giải mã trường hợp sau, tránh làm hỏng URL gốc có sẵn %2F, %20...
  if (!/^https?:\/\//i.test(raw)) {
    try { raw = decodeURIComponent(raw); } catch { /* giữ nguyên */ }
  }
  return /^https?:\/\//i.test(raw) ? raw : null;
}
const TARGET = attemptedUrl();
const FROM_STARTUP = new URLSearchParams(location.search).has('startup');

let snap = null;
let escapeOpenedAt = 0;

/* ------------------------------------------------------------------ */
async function refresh() {
  snap = await send('get');
  render();
}

function render() {
  const { gate, summary, state } = snap;
  applyTheme(state.settings?.theme);
  const lock = $('#lock');
  const head = $('#headline');
  const sub = $('#subline');

  /* --- Đang mở tạm (thoát khẩn cấp) --- */
  if (gate.unlockedUntil) {
    lock.classList.add('open');
    $('#lockIcon').innerHTML = '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>';
    head.textContent = 'Cổng đang mở tạm';
    sub.textContent = 'Bạn đã dùng lối thoát khẩn cấp. Đồng hồ đang chạy.';
    $('#attempt').classList.add('hidden');
    $('#escape').classList.add('hidden');
    renderUnlocked(gate.unlockedUntil);
  } else if (!gate.active) {
    lock.classList.add('open');
    $('#lockIcon').innerHTML = '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>';
    head.textContent = 'Xong hết rồi!';
    sub.textContent = TARGET ? 'Đang đưa bạn quay lại trang cũ…' : 'Không còn việc nào bắt buộc. Cổng đã mở.';
    $('#attempt').classList.add('hidden');
    $('#escape').classList.add('hidden');
    $('#unlocked').classList.add('hidden');
    if (TARGET) setTimeout(() => { location.replace(TARGET); }, 700);
  } else {
    lock.classList.remove('open');
    $('#lockIcon').innerHTML = '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>';
    const n = gate.tasks.length;
    head.textContent = n
      ? (FROM_STARTUP ? `Chào bạn — còn ${n} việc chưa xong` : `Còn ${n} việc chưa xong`)
      : gate.reasons[0]?.label || 'Đang trong giờ tập trung';
    sub.textContent = n
      ? 'Tick xong việc bên dưới là cổng mở ngay. Không cần xin phép ai cả.'
      : 'Bạn đã tự đặt khung giờ này. Hết giờ cổng sẽ tự mở.';
    $('#unlocked').classList.add('hidden');
    $('#escape').classList.remove('hidden');
    if (TARGET) {
      $('#attempt').classList.remove('hidden');
      $('#attemptUrl').textContent = hostOf(TARGET);
      $('#attemptUrl').title = TARGET;
    }
  }

  renderStrip(summary, gate);
  renderTasks(state, gate);
  renderTimer(state);
}

/* ---- Dải thống kê ---- */
function renderStrip(s, gate) {
  const strip = $('#strip');
  fill(strip, 
    s.streak > 0 && el('span', { class: 'badge badge-success' }, `🔥 ${s.streak} ngày liên tiếp`),
    el('span', { class: 'badge badge-accent' }, `${s.points} điểm`),
    s.focusMin > 0 && el('span', { class: 'badge' }, `${s.focusMin} phút tập trung hôm nay`),
    s.completedToday > 0 && el('span', { class: 'badge' }, `${s.completedToday} việc xong hôm nay`),
    ...gate.reasons.filter((r) => r.type !== 'task').map((r) =>
      el('span', { class: 'badge badge-warn' }, r.label + (r.endsAt ? ` · ${fmtRelative(r.endsAt)}` : '')))
  );
}

/* ---- Danh sách việc ---- */
function renderTasks(state, gate) {
  const box = $('#tasks');
  const now = Date.now();
  const blockingIds = new Set(gate.tasks.map((t) => t.id));
  const list = state.tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => (blockingIds.has(b.id) - blockingIds.has(a.id)) || ((a.dueAt || 9e15) - (b.dueAt || 9e15)));

  $('#tasksHead').textContent = list.length ? 'Việc cần xong trước' : 'Không còn việc nào';
  if (!list.length) {
    fill(box, el('div', { class: 'card empty' }, 'Danh sách trống. Thêm việc bên dưới để bắt đầu.'));
    return;
  }
  fill(box, ...list.map((t) => taskRow(t, blockingIds.has(t.id), now)));
}

function taskRow(t, blocking, now) {
  const overdue = t.dueAt && t.dueAt < now;
  return el('div', { class: `task${blocking ? ' is-blocking' : ''}${overdue ? ' is-overdue' : ''}` },
    el('button', {
      class: 'check', role: 'checkbox', 'aria-checked': 'false',
      'aria-label': 'Đánh dấu hoàn thành: ' + t.title, html: CHECK_SVG,
      onclick: async (e) => {
        e.currentTarget.setAttribute('aria-checked', 'true');
        await new Promise((r) => setTimeout(r, 180));
        await send('completeTask', { id: t.id });
        toast('Xong! +10 điểm');
        await refresh();
      }
    }),
    el('div', { class: 'grow' },
      el('div', { class: 'task-title' }, t.title),
      t.note && el('div', { class: 'small muted', style: 'margin-top:3px;white-space:pre-wrap' }, t.note),
      el('div', { class: 'task-meta' },
        blocking && el('span', { class: 'badge badge-danger' }, 'Bắt buộc'),
        overdue && el('span', { class: 'badge badge-warn' }, 'Quá hạn ' + fmtRelative(t.dueAt, now).replace('trễ ', '')),
        t.dueAt && !overdue && el('span', { class: 'badge' }, 'Hạn ' + fmtWhen(t.dueAt, now)),
        t.remindAt && t.remindAt > now && el('span', { class: 'badge' }, 'Nhắc ' + fmtWhen(t.remindAt, now)),
        t.tabs?.length > 0 && el('span', { class: 'badge badge-accent' }, `${t.tabs.length} tab công việc`)
      )
    ),
    el('div', { class: 'row' },
      t.tabs?.length > 0 && el('button', {
        class: 'btn btn-sm', title: 'Mở lại toàn bộ tab của việc này',
        onclick: async () => { const r = await send('openWorkTabs', { id: t.id }); toast(`Đã mở ${r.opened} tab`); }
      }, 'Mở tab'),
      el('button', {
        class: 'btn btn-sm btn-primary', title: 'Bắt đầu phiên tập trung cho việc này',
        onclick: async () => { await send('startSession', { taskId: t.id }); toast('Bắt đầu tập trung'); await refresh(); }
      }, 'Tập trung')
    )
  );
}

/* ---- Bộ đếm Pomodoro ---- */
function renderTimer(state) {
  const sec = $('#timerSec');
  const s = state.session;
  if (!s) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');
  const label = { focus: 'Phiên tập trung', break: 'Nghỉ ngắn', longBreak: 'Nghỉ dài' }[s.phase] || 'Phiên';
  $('#timerLabel').textContent = label + (s.paused ? ' (đang tạm dừng)' : '');
  const task = state.tasks.find((t) => t.id === s.taskId);
  $('#timerTask').textContent = task ? task.title : 'Không gắn với việc nào';
  $('#timerPause').textContent = s.paused ? 'Tiếp tục' : 'Tạm dừng';
  $('#timerPause').onclick = async () => { await send(s.paused ? 'resumeSession' : 'pauseSession'); await refresh(); };
  $('#timerStop').onclick = async () => { await send('stopSession'); toast('Đã dừng phiên'); await refresh(); };
  tickTimer();
}

function tickTimer() {
  const s = snap?.state?.session;
  if (!s) return;
  const remain = s.paused ? s.durationMs - (s.elapsedBeforePause || 0) : Math.max(0, s.endsAt - Date.now());
  $('#timerNum').textContent = fmtClock(remain);
  $('#timerBar').style.width = `${Math.min(100, 100 * (1 - remain / s.durationMs)).toFixed(1)}%`;
}

/* ---- Cửa sổ mở tạm ---- */
function renderUnlocked(until) {
  const box = $('#unlocked');
  box.classList.remove('hidden');
  fill(box, el('div', { class: 'unlocked-banner' },
    el('div', { class: 'timer-num', id: 'unlockNum' }, fmtClock(until - Date.now())),
    el('div', { class: 'grow' },
      el('div', { class: 'strong' }, 'Cổng mở tạm — hết giờ sẽ khoá lại'),
      el('div', { class: 'small muted' }, 'Chuỗi ngày tập trung đã về 0 và bạn bị trừ 50 điểm.')),
    el('button', {
      class: 'btn btn-success',
      onclick: async () => { await send('cancelUnlock'); toast('Tôn trọng bạn. Quay lại làm việc thôi!'); await refresh(); }
    }, 'Tôi quay lại làm việc')
  ));
}

/* ---- Lối thoát khẩn cấp ---- */
let escapeState = null;
let escapeBuilding = false;
async function renderEscape() {
  if (escapeState || escapeBuilding) return;
  escapeBuilding = true;
  let info;
  try {
    info = await send('emergencyInfo');
  } finally {
    escapeBuilding = false;
  }
  escapeState = info;
  const body = $('#escapeBody');

  if (!info.ok) {
    fill(body, 
      el('div', { class: 'cost' }, el('div', { class: 'strong', style: 'color:var(--danger)' }, 'Không dùng được lối thoát'),
        el('div', { class: 'small', style: 'margin-top:4px' }, info.reason)),
      el('div', { class: 'small muted' }, 'Cách duy nhất còn lại là hoàn thành việc của bạn. Đó cũng là điều bạn muốn khi cài app này.')
    );
    return;
  }

  const s = snap.summary;
  const typed = el('textarea', { id: 'typed', placeholder: 'Gõ lại chính xác câu trên (không được dán)…', spellcheck: 'false' });
  const confirm = el('button', { class: 'btn btn-danger btn-block', disabled: true, id: 'escapeConfirm' }, 'Chờ…');
  const hint = el('div', { class: 'progress-line' }, el('span', { id: 'escapeHint' }, ''), el('div', { class: 'bar grow' }, el('i', { id: 'escapeBar', style: 'width:0%;background:var(--danger)' })));

  ['paste', 'drop'].forEach((ev) => typed.addEventListener(ev, (e) => { e.preventDefault(); toast('Dán không tính — phải gõ tay.'); }));
  typed.addEventListener('input', updateEscape);

  fill(body, 
    el('div', { class: 'cost' },
      el('div', { class: 'strong', style: 'color:var(--danger)' }, 'Bấm nút này bạn sẽ mất:'),
      el('ul', {},
        el('li', {}, `Chuỗi ${s.streak} ngày tập trung liên tiếp → về 0`),
        el('li', {}, '50 điểm tích luỹ'),
        el('li', {}, `Chỉ còn ${info.remaining - 1}/${info.max ?? info.remaining} lượt thoát cho hôm nay sau lần này`)),
      el('div', { class: 'small muted', style: 'margin-top:8px' }, `Đổi lại: cổng mở ${info.unlockMinutes} phút rồi khoá lại.`)),
    el('div', { class: 'phrase copyblock', id: 'phraseBox' }, info.phrase),
    typed, hint, confirm
  );

  escapeOpenedAt = Date.now();
  updateEscape();
  confirm.onclick = async () => {
    const r = await send('emergencyUnlock', { typed: typed.value });
    if (!r.ok) { toast(r.error); return; }
    escapeState = null;
    await refresh();
  };
}

function updateEscape() {
  if (!escapeState || !escapeState.ok) return;
  const typed = $('#typed'); const confirm = $('#escapeConfirm');
  if (!typed || !confirm) return;
  const norm = (x) => x.replace(/\s+/g, ' ').trim().toLowerCase();
  const match = norm(typed.value) === norm(escapeState.phrase);
  typed.classList.toggle('match', match);

  const waited = Math.floor((Date.now() - escapeOpenedAt) / 1000);
  const left = Math.max(0, escapeState.cooldownSec - waited);
  const pct = Math.min(100, (waited / escapeState.cooldownSec) * 100);
  $('#escapeBar').style.width = pct + '%';

  const chars = norm(typed.value).length;
  const total = norm(escapeState.phrase).length;
  $('#escapeHint').textContent = left > 0
    ? `Chờ ${left}s · đã gõ ${chars}/${total} ký tự`
    : match ? 'Đã đủ điều kiện.' : `Đã gõ ${chars}/${total} ký tự`;

  confirm.disabled = !(match && left === 0);
  confirm.textContent = left > 0 ? `Chờ ${left} giây…` : match ? 'Tôi chấp nhận mất tất cả — mở cổng' : 'Gõ đúng câu cam kết để mở';
}

/* ------------------------------------------------------------------ */
$('#openDash').onclick = () => send('openDashboard');
$('#quickAdd').onclick = addQuick;
$('#quickTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') addQuick(); });
$('#escape').addEventListener('toggle', (e) => {
  if (!e.target.open) return;
  escapeOpenedAt = Date.now();
  escapeState = null;
  renderEscape();
});

async function addQuick() {
  const input = $('#quickTitle');
  const title = input.value.trim();
  if (!title) { input.focus(); return; }
  await send('addTask', { title, enforce: true });
  input.value = '';
  toast('Đã thêm việc');
  await refresh();
}

onStateChanged(() => refresh());
setInterval(() => {
  tickTimer();
  updateEscape();
  const until = snap?.gate?.unlockedUntil;
  if (until) {
    const n = document.getElementById('unlockNum');
    if (n) n.textContent = fmtClock(until - Date.now());
    if (until - Date.now() <= 0) refresh();
  }
}, 1000);
setInterval(refresh, 20000);
refresh().catch((e) => {
  $('#headline').textContent = 'Không kết nối được FocusGate';
  $('#subline').textContent = String(e.message || e);
});
