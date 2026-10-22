/* FocusGate Desktop — màn hình khoá */
const $ = (s) => document.querySelector(s);
let snap = null, escapeState = null, escapeBuilding = false, escapeOpenedAt = 0;

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || typeof c === 'boolean' || c === '') continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}
function fill(node, ...kids) {
  node.replaceChildren(...kids.flat(Infinity).filter((c) => c !== null && c !== undefined && typeof c !== 'boolean' && c !== ''));
}
const CHECK = '<svg viewBox="0 0 16 16"><path d="M3 8.5 6.2 11.7 13 4.8"/></svg>';
const clock = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return s >= 3600 ? `${Math.floor(s / 3600)}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)}` : `${p(Math.floor(s / 60))}:${p(s % 60)}`;
};
const rel = (ts) => {
  const d = Math.abs(ts - Date.now()), m = Math.round(d / 60000);
  const u = m < 60 ? `${m} phút` : d < 864e5 ? `${Math.round(m / 60)} giờ` : `${Math.round(d / 864e5)} ngày`;
  return ts >= Date.now() ? `còn ${u}` : `trễ ${u}`;
};

async function refresh() { snap = await window.fg.call('get'); render(); }

function render() {
  const { gate, summary, state } = snap;
  document.documentElement.dataset.theme = state.settings?.theme === 'light' ? 'light' : 'dark';
  const lockEl = $('#lock');
  const open = !gate.active || !!gate.unlockedUntil;
  lockEl.classList.toggle('open', open);
  $('#lockIcon').innerHTML = open
    ? '<rect x="4" y="10" width="16" height="11" rx="2.6"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>'
    : '<rect x="4" y="10" width="16" height="11" rx="2.6"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>';
  if (gate.unlockedUntil) {
    $('#headline').textContent = 'Cổng đang mở tạm';
    $('#subline').textContent = 'Bạn đã dùng lối thoát khẩn cấp. Đồng hồ đang chạy.';
    $('#escape').style.display = 'none';
    fill($('#unlocked'), el('div', { class: 'unlocked-banner' },
      el('div', { class: 'timer-num', id: 'unlockNum' }, clock(gate.unlockedUntil - Date.now())),
      el('div', { class: 'grow' },
        el('div', { class: 'strong' }, 'Hết giờ sẽ khoá lại'),
        el('div', { class: 'small muted' }, 'Chuỗi ngày tập trung đã về 0 và bạn bị trừ 50 điểm.')),
      el('button', { class: 'btn btn-success', onclick: async () => { await window.fg.call('cancelUnlock'); refresh(); } }, 'Tôi quay lại làm việc')));
  } else {
    $('#escape').style.display = '';
    fill($('#unlocked'));
    const n = gate.tasks.length;
    $('#headline').textContent = n ? `Còn ${n} việc chưa xong` : (gate.reasons[0]?.label || 'Đang trong giờ tập trung');
    $('#subline').textContent = n
      ? 'Tick xong việc bên dưới là màn hình này tự đóng.'
      : 'Bạn đã tự đặt khung giờ này. Hết giờ máy sẽ mở lại.';
  }

  fill($('#strip'),
    summary.streak > 0 && el('span', { class: 'badge badge-success' }, `🔥 ${summary.streak} ngày liên tiếp`),
    el('span', { class: 'badge badge-accent' }, `${summary.points} điểm`),
    summary.focusMin > 0 && el('span', { class: 'badge' }, `${summary.focusMin} phút tập trung hôm nay`),
    ...gate.reasons.filter((r) => r.type !== 'task').map((r) =>
      el('span', { class: 'badge badge-warn' }, r.label + (r.endsAt ? ` · ${rel(r.endsAt)}` : ''))));

  const ids = new Set(gate.tasks.map((t) => t.id));
  const list = state.tasks.filter((t) => t.status !== 'done')
    .sort((a, b) => (ids.has(b.id) - ids.has(a.id)) || ((a.dueAt || 9e15) - (b.dueAt || 9e15)));
  $('#tasksHead').textContent = list.length ? 'Việc cần xong trước' : 'Không còn việc nào';
  fill($('#tasks'), ...(list.length ? list.map((t) => taskRow(t, ids.has(t.id)))
    : [el('div', { class: 'card empty' }, 'Danh sách trống.')]));
}

function taskRow(t, blocking) {
  const overdue = t.dueAt && t.dueAt < Date.now();
  return el('div', { class: 'task' + (blocking ? ' is-blocking' : '') + (overdue ? ' is-overdue' : '') },
    el('button', {
      class: 'check', role: 'checkbox', 'aria-checked': 'false', html: CHECK,
      'aria-label': 'Hoàn thành: ' + t.title,
      onclick: async (e) => {
        e.currentTarget.setAttribute('aria-checked', 'true');
        await new Promise((r) => setTimeout(r, 160));
        await window.fg.call('completeTask', { id: t.id });
        refresh();
      }
    }),
    el('div', { class: 'grow' },
      el('div', { class: 'task-title' }, t.title),
      t.note && el('div', { class: 'small muted', style: 'margin-top:3px;white-space:pre-wrap' }, t.note),
      el('div', { class: 'task-meta' },
        blocking && el('span', { class: 'badge badge-danger' }, 'Bắt buộc'),
        overdue && el('span', { class: 'badge badge-warn' }, 'Quá hạn'),
        t.tabs?.length > 0 && el('span', { class: 'badge badge-accent' }, `${t.tabs.length} tab công việc`))));
}

/* --- Lối thoát khẩn cấp --- */
async function renderEscape() {
  if (escapeState || escapeBuilding) return;
  escapeBuilding = true;
  let info;
  try { info = await window.fg.call('emergencyInfo'); } finally { escapeBuilding = false; }
  escapeState = info;
  const body = $('#escapeBody');
  if (!info.ok) {
    fill(body, el('div', { class: 'cost' },
      el('div', { class: 'strong', style: 'color:var(--danger)' }, 'Không dùng được lối thoát'),
      el('div', { class: 'small', style: 'margin-top:4px' }, info.reason)));
    return;
  }
  const typed = el('textarea', { id: 'typed', placeholder: 'Gõ lại chính xác câu trên (không được dán)…', spellcheck: 'false' });
  ['paste', 'drop'].forEach((ev) => typed.addEventListener(ev, (e) => e.preventDefault()));
  typed.addEventListener('input', updateEscape);
  const confirm = el('button', { class: 'btn btn-danger btn-block', disabled: true, id: 'escapeConfirm' }, 'Chờ…');
  confirm.onclick = async () => {
    const r = await window.fg.call('emergencyUnlock', { typed: typed.value });
    if (!r.ok) { $('#escapeHint').textContent = r.error; return; }
    escapeState = null; refresh();
  };
  fill(body,
    el('div', { class: 'cost' },
      el('div', { class: 'strong', style: 'color:var(--danger)' }, 'Bấm nút này bạn sẽ mất:'),
      el('ul', {}, el('li', {}, `Chuỗi ${snap.summary.streak} ngày tập trung liên tiếp → về 0`),
        el('li', {}, '50 điểm tích luỹ'),
        el('li', {}, `Chỉ còn ${info.remaining - 1}/${info.remaining} lượt thoát cho hôm nay`)),
      el('div', { class: 'small muted', style: 'margin-top:8px' }, `Đổi lại: cổng mở ${info.unlockMinutes} phút rồi khoá lại.`)),
    el('div', { class: 'phrase', id: 'phraseBox' }, info.phrase),
    typed,
    el('div', { class: 'progress-line' }, el('span', { id: 'escapeHint' }, ''),
      el('div', { class: 'bar grow' }, el('i', { id: 'escapeBar', style: 'width:0%;background:var(--danger)' }))),
    confirm);
  escapeOpenedAt = Date.now();
  updateEscape();
}

function updateEscape() {
  if (!escapeState?.ok) return;
  const typed = $('#typed'), confirm = $('#escapeConfirm');
  if (!typed || !confirm) return;
  const norm = (x) => x.replace(/\s+/g, ' ').trim().toLowerCase();
  const match = norm(typed.value) === norm(escapeState.phrase);
  typed.classList.toggle('match', match);
  const waited = Math.floor((Date.now() - escapeOpenedAt) / 1000);
  const left = Math.max(0, escapeState.cooldownSec - waited);
  $('#escapeBar').style.width = Math.min(100, (waited / Math.max(1, escapeState.cooldownSec)) * 100) + '%';
  $('#escapeHint').textContent = left > 0
    ? `Chờ ${left}s · đã gõ ${norm(typed.value).length}/${norm(escapeState.phrase).length} ký tự`
    : match ? 'Đã đủ điều kiện.' : `Đã gõ ${norm(typed.value).length}/${norm(escapeState.phrase).length} ký tự`;
  confirm.disabled = !(match && left === 0);
  confirm.textContent = left > 0 ? `Chờ ${left} giây…` : match ? 'Tôi chấp nhận mất tất cả — mở cổng' : 'Gõ đúng câu cam kết để mở';
}

$('#escape').addEventListener('toggle', (e) => {
  if (!e.target.open) return;
  escapeOpenedAt = Date.now(); escapeState = null; renderEscape();
});
$('#quickAdd').onclick = addQuick;
$('#quick').addEventListener('keydown', (e) => { if (e.key === 'Enter') addQuick(); });
async function addQuick() {
  const v = $('#quick').value.trim();
  if (!v) return;
  await window.fg.call('addTask', { title: v, enforce: true });
  $('#quick').value = '';
  refresh();
}

window.fg.onState((data) => { snap = data; render(); });
window.fg.onShown(() => refresh());
setInterval(() => {
  updateEscape();
  const u = snap?.gate?.unlockedUntil;
  const n = document.getElementById('unlockNum');
  if (u && n) n.textContent = clock(u - Date.now());
}, 1000);
setInterval(refresh, 15000);
refresh();
