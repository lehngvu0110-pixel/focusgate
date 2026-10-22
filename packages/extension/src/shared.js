/** FocusGate — tiện ích dùng chung cho các trang giao diện */

export function send(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (res) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      if (!res) return reject(new Error('Không nhận được phản hồi từ FocusGate.'));
      if (!res.ok) return reject(new Error(res.error || 'Lỗi không rõ'));
      resolve(res.data);
    });
  });
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Thay toàn bộ con của node, tự bỏ qua null/undefined/boolean/'' (tránh in ra chữ "null"). */
export function fill(node, ...children) {
  if (!node) return node;
  node.replaceChildren(...children.flat(Infinity).filter(
    (c) => c !== null && c !== undefined && typeof c !== 'boolean' && c !== ''
  ));
  return node;
}

export const CHECK_SVG = '<svg viewBox="0 0 16 16"><path d="M3 8.5 6.2 11.7 13 4.8"/></svg>';

/* --- Định dạng --- */

export function fmtClock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

export function fmtDuration(min) {
  if (!min) return '0 phút';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h} giờ ${m} phút`;
  if (h) return `${h} giờ`;
  return `${m} phút`;
}

const DOW = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function fmtWhen(ts, now = Date.now()) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  const dayDiff = Math.round((startOfDay(ts) - startOfDay(now)) / 86400000);
  if (dayDiff === 0) return `hôm nay ${time}`;
  if (dayDiff === 1) return `ngày mai ${time}`;
  if (dayDiff === -1) return `hôm qua ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${DOW[d.getDay()]} ${time}`;
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${time}`;
}

export function fmtRelative(ts, now = Date.now()) {
  const diff = ts - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const unit = mins < 60 ? `${mins} phút`
    : abs < 86400000 ? `${Math.round(mins / 60)} giờ`
    : `${Math.round(abs / 86400000)} ngày`;
  return diff >= 0 ? `còn ${unit}` : `trễ ${unit}`;
}

function startOfDay(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
}

/** Chuyển ms -> chuỗi cho <input type="datetime-local"> theo giờ máy. */
export function toLocalInput(ts) {
  if (!ts) return '';
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
export function fromLocalInput(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function faviconFor(url, size = 32) {
  try {
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', url);
    u.searchParams.set('size', String(size));
    return u.toString();
  } catch { return ''; }
}

/* --- Toast --- */
let toastTimer;
export function toast(message) {
  let node = document.querySelector('.toast');
  if (!node) { node = el('div', { class: 'toast' }); document.body.append(node); }
  node.textContent = message;
  requestAnimationFrame(() => node.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
}

/** Áp chủ đề giao diện (mặc định: tối). */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

/** Đăng ký nhận thay đổi state từ service worker. */
export function onStateChanged(cb) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'state:changed') cb(msg.payload);
  });
}

export const REPEAT_LABELS = {
  none: 'Không lặp', daily: 'Hằng ngày', weekdays: 'Thứ 2–6', weekly: 'Hằng tuần'
};
