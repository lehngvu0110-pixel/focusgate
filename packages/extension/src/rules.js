/** FocusGate — dựng luật declarativeNetRequest từ state */
import { normalizePattern, workPatternsFromTasks } from '../vendor/core/index.js';

const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;
const esc = (s) => s.replace(RE_ESCAPE, '\\$&');

/** Tách pattern thành nhóm chỉ-domain và nhóm có-path. */
export function splitPatterns(list = []) {
  const domains = [];
  const paths = [];
  for (const raw of list) {
    const p = normalizePattern(raw);
    if (!p) continue;
    (p.includes('/') ? paths : domains).push(p);
  }
  return { domains: [...new Set(domains)], paths: [...new Set(paths)] };
}

/**
 * Regex (cú pháp RE2 — không dùng lookahead) khớp TOÀN BỘ url của một pattern,
 * để regexSubstitution \0 lấy được url gốc đem sang trang chặn.
 */
export function patternToRegex(pattern) {
  const p = normalizePattern(pattern);
  const slash = p.indexOf('/');
  const domain = slash === -1 ? p : p.slice(0, slash);
  const path = slash === -1 ? null : p.slice(slash);
  const hostPart = '^https?://([a-z0-9-]+\\.)*' + esc(domain);
  return path === null
    ? hostPart + '(?:[:/?#].*)?$'
    : hostPart + esc(path) + '(?:[/?#].*)?$';
}

/**
 * Dựng toàn bộ dynamic rules.
 * @param {object} state
 * @param {string} blockedPageUrl  chrome-extension://<id>/src/blocked.html
 */
export function buildRules(state, blockedPageUrl) {
  const s = state.settings || {};
  const rules = [];
  let id = 1;
  const redirect = (regexFilter) => ({
    id: id++,
    priority: 1,
    action: { type: 'redirect', redirect: { regexSubstitution: blockedPageUrl + '?u=\\0' } },
    condition: { regexFilter, resourceTypes: ['main_frame'] }
  });

  // --- Luật CHO PHÉP (ưu tiên cao nhất) ---
  const allowPatterns = [...(s.allowlist || []), ...workPatternsFromTasks(state.tasks || [])];
  const { domains: allowDomains, paths: allowPaths } = splitPatterns(allowPatterns);
  if (allowDomains.length) {
    // requestDomains khớp cả subdomain, gộp 1 luật cho nhẹ
    for (const chunk of chunked(allowDomains, 200)) {
      rules.push({
        id: id++,
        priority: 100,
        action: { type: 'allow' },
        condition: { requestDomains: chunk, resourceTypes: ['main_frame'] }
      });
    }
  }
  for (const p of allowPaths) {
    rules.push({
      id: id++,
      priority: 110,
      action: { type: 'allow' },
      condition: { regexFilter: patternToRegex(p), resourceTypes: ['main_frame'] }
    });
  }

  // --- Luật CHẶN ---
  if (s.mode === 'blocklist') {
    const { domains, paths } = splitPatterns(s.blocklist || []);
    for (const d of [...domains, ...paths]) rules.push(redirect(patternToRegex(d)));
  } else {
    rules.push(redirect('^https?://.*'));
  }

  return rules;
}

function* chunked(arr, size) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}
