/* FocusGate Desktop — cửa sổ cài đặt */
const $ = (s) => document.querySelector(s);
let snap = null;

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || typeof c === 'boolean' || c === '') continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}
const fill = (node, ...k) => node.replaceChildren(...k.flat(Infinity).filter((c) => c !== null && c !== undefined && typeof c !== 'boolean' && c !== ''));

async function refresh() {
  snap = await window.fg.call('get');
  const { gate, summary, state } = snap;
  document.documentElement.dataset.theme = state.settings?.theme === 'light' ? 'light' : 'dark';
  $('#status').textContent = gate.active
    ? `Đang khoá · ${gate.reasons.map((r) => r.label).join(' · ')}`
    : `Cổng đang mở · 🔥 ${summary.streak} ngày · ${summary.points} điểm`;

  const apps = state.settings.blockedApps || [];
  fill($('#appList'), ...(apps.length ? apps.map((a) =>
    el('span', { class: 'chip' }, el('span', {}, a),
      el('button', { 'aria-label': 'Bỏ ' + a, onclick: () => setApps(apps.filter((x) => x !== a)) }, '×')))
    : [el('span', { class: 'small muted' }, 'Chưa chặn app nào.')]));

  $('#login').checked = state.settings.launchAtLogin !== false;
  $('#quit').disabled = gate.active;
  $('#quitHint').textContent = gate.active
    ? 'Chưa thoát được — còn việc bắt buộc chưa xong. Đó là mục đích của app này.'
    : '';
  $('#syncInfo').textContent = `Máy chủ nội bộ đang chạy ở 127.0.0.1:${state.settings.syncPort || 47823}. `
    + 'Extension FocusGate trên trình duyệt sẽ tự bắt tay và dùng chung danh sách việc.';
}

async function setApps(list) {
  await window.fg.call('updateSettings', { patch: { blockedApps: list } });
  refresh();
}

$('#appAdd').onclick = async () => {
  const v = $('#appInput').value.trim();
  if (!v) return;
  const cur = snap.state.settings.blockedApps || [];
  if (!cur.includes(v)) await setApps([...cur, v]);
  $('#appInput').value = '';
};
$('#appInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#appAdd').click(); });

$('#appScan').onclick = async () => {
  const { apps } = await window.fg.call('listRunningApps');
  const cur = new Set(snap.state.settings.blockedApps || []);
  const suggestions = apps.filter((a) => !cur.has(a) && !/^(Finder|FocusGate|Electron|SystemUIServer|loginwindow)$/.test(a));
  fill($('#appSuggest'), ...(suggestions.length ? [
    el('span', { class: 'tiny muted', style: 'width:100%' }, 'Đang chạy — bấm để thêm vào danh sách chặn:'),
    ...suggestions.map((a) => el('button', { class: 'chip', style: 'cursor:pointer', onclick: () => setApps([...cur, a]) }, el('span', {}, a)))
  ] : [el('span', { class: 'small muted' }, 'Không lấy được danh sách app (cần quyền Accessibility).')]));
};

$('#login').onchange = async (e) => {
  await window.fg.call('updateSettings', { patch: { launchAtLogin: e.target.checked } });
  refresh();
};
$('#openLock').onclick = () => window.fg.call('get').then(refresh);
$('#quit').onclick = async () => {
  const r = await window.fg.call('quitApp');
  if (!r.ok) $('#quitHint').textContent = r.error;
};

window.fg.onState((d) => { snap = d; refresh(); });
setInterval(refresh, 10000);
refresh();
