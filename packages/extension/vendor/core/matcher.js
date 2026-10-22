/**
 * FocusGate — URL matching
 * Không phụ thuộc DOM / chrome API để unit-test được.
 */

/** Các scheme luôn được phép (nếu chặn sẽ làm hỏng trình duyệt). */
export const INTERNAL_SCHEMES = [
  'chrome:', 'chrome-extension:', 'edge:', 'extension:', 'about:',
  'devtools:', 'view-source:', 'moz-extension:', 'safari-web-extension:',
  'chrome-search:', 'chrome-untrusted:', 'blob:', 'data:'
];

/** Trích host (đã hạ chữ thường, bỏ "www.") + path từ URL. */
export function parseUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    // Cho phép người dùng gõ thiếu scheme: "facebook.com/abc"
    try { u = new URL('https://' + raw); } catch { return null; }
  }
  const scheme = u.protocol.toLowerCase();
  let host = (u.hostname || '').toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  return {
    scheme,
    host,
    path: u.pathname || '/',
    search: u.search || '',
    href: u.href,
    internal: INTERNAL_SCHEMES.includes(scheme)
  };
}

/**
 * Chuẩn hoá một dòng người dùng nhập thành pattern.
 *  "https://www.Facebook.com/groups/" -> "facebook.com/groups"
 *  "*.reddit.com"                     -> "reddit.com"
 */
export function normalizePattern(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^[a-z-]+:\/\//, '');      // bỏ scheme
  s = s.replace(/^\*\.?/, '');              // bỏ wildcard đầu
  s = s.replace(/^www\./, '');
  s = s.replace(/\/+$/, '');                // bỏ dấu / cuối
  return s;
}

/** host "m.facebook.com" có thuộc domain "facebook.com" không? */
export function hostInDomain(host, domain) {
  if (!host || !domain) return false;
  return host === domain || host.endsWith('.' + domain);
}

/**
 * Một URL đã phân tích có khớp pattern không.
 * Pattern chỉ có domain  -> khớp domain + mọi subdomain + mọi path.
 * Pattern có path        -> thêm điều kiện path bắt đầu bằng path đó.
 */
export function matchesPattern(parsed, pattern) {
  const p = normalizePattern(pattern);
  if (!p || !parsed) return false;
  const slash = p.indexOf('/');
  const domain = slash === -1 ? p : p.slice(0, slash);
  const pathPrefix = slash === -1 ? null : p.slice(slash);
  if (!hostInDomain(parsed.host, domain)) return false;
  if (pathPrefix === null) return true;
  const path = parsed.path.replace(/\/+$/, '') || '/';
  return path === pathPrefix || path.startsWith(pathPrefix + '/') ||
         parsed.path.startsWith(pathPrefix);
}

/** Tìm pattern đầu tiên trong danh sách khớp URL. */
export function firstMatch(parsed, patterns) {
  if (!parsed || !Array.isArray(patterns)) return null;
  for (const pattern of patterns) {
    if (matchesPattern(parsed, pattern)) return normalizePattern(pattern);
  }
  return null;
}

/**
 * Quyết định một URL có được vào hay không KHI CỔNG CHẶN ĐANG BẬT.
 * @returns {{allowed:boolean, reason:string, matched:string|null}}
 */
export function classifyUrl(rawUrl, opts = {}) {
  const {
    mode = 'allowlist',       // 'allowlist' = chỉ cho vào danh sách trắng | 'blocklist' = chỉ chặn danh sách đen
    allowlist = [],
    blocklist = [],
    workPatterns = [],        // domain sinh ra từ tab công việc của task đang mở
    allowLocalFiles = true
  } = opts;

  const parsed = parseUrl(rawUrl);
  if (!parsed) return { allowed: true, reason: 'url-không-hợp-lệ', matched: null };
  if (parsed.internal) return { allowed: true, reason: 'trang-nội-bộ-trình-duyệt', matched: null };
  if (parsed.scheme === 'file:') {
    return allowLocalFiles
      ? { allowed: true, reason: 'tệp-máy-tính', matched: null }
      : { allowed: false, reason: 'tệp-máy-tính-bị-chặn', matched: null };
  }
  if (parsed.scheme !== 'http:' && parsed.scheme !== 'https:') {
    return { allowed: true, reason: 'scheme-khác', matched: null };
  }

  const work = firstMatch(parsed, workPatterns);
  if (work) return { allowed: true, reason: 'tab-công-việc', matched: work };

  const allowed = firstMatch(parsed, allowlist);
  if (allowed) return { allowed: true, reason: 'danh-sách-trắng', matched: allowed };

  if (mode === 'blocklist') {
    const blocked = firstMatch(parsed, blocklist);
    return blocked
      ? { allowed: false, reason: 'danh-sách-đen', matched: blocked }
      : { allowed: true, reason: 'không-nằm-trong-danh-sách-đen', matched: null };
  }

  // allowlist mode (mặc định, nghiêm)
  return { allowed: false, reason: 'ngoài-danh-sách-trắng', matched: null };
}

/** Sinh danh sách domain từ các tab công việc đã lưu trong task. */
export function workPatternsFromTasks(tasks = []) {
  const out = new Set();
  for (const t of tasks) {
    if (!t || t.status === 'done') continue;
    for (const tab of t.tabs || []) {
      const parsed = parseUrl(typeof tab === 'string' ? tab : tab?.url);
      if (parsed && !parsed.internal && parsed.host) out.add(parsed.host);
    }
  }
  return [...out];
}
