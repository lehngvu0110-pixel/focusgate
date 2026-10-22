import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUrl, normalizePattern, hostInDomain, matchesPattern, classifyUrl, workPatternsFromTasks
} from '../src/matcher.js';

test('parseUrl: bỏ www, hạ chữ thường, nhận diện trang nội bộ', () => {
  assert.equal(parseUrl('https://WWW.Facebook.com/abc').host, 'facebook.com');
  assert.equal(parseUrl('https://m.YouTube.com/').host, 'm.youtube.com');
  assert.equal(parseUrl('chrome://extensions').internal, true);
  assert.equal(parseUrl('chrome-extension://abc/page.html').internal, true);
  assert.equal(parseUrl('about:blank').internal, true);
  assert.equal(parseUrl(''), null);
  assert.equal(parseUrl(null), null);
  assert.equal(parseUrl('facebook.com/x').host, 'facebook.com', 'thiếu scheme vẫn parse được');
});

test('normalizePattern: gọt scheme, www, wildcard, dấu / cuối', () => {
  assert.equal(normalizePattern('https://www.Facebook.com/'), 'facebook.com');
  assert.equal(normalizePattern('*.reddit.com'), 'reddit.com');
  assert.equal(normalizePattern('*reddit.com'), 'reddit.com');
  assert.equal(normalizePattern('  YouTube.COM/shorts/  '), 'youtube.com/shorts');
  assert.equal(normalizePattern(''), '');
  assert.equal(normalizePattern(undefined), '');
});

test('hostInDomain: khớp cả subdomain nhưng không khớp nhầm hậu tố', () => {
  assert.equal(hostInDomain('m.facebook.com', 'facebook.com'), true);
  assert.equal(hostInDomain('facebook.com', 'facebook.com'), true);
  assert.equal(hostInDomain('notfacebook.com', 'facebook.com'), false, 'không được khớp nhầm');
  assert.equal(hostInDomain('facebook.com.evil.net', 'facebook.com'), false);
  assert.equal(hostInDomain('', 'facebook.com'), false);
});

test('matchesPattern: pattern có path chỉ khớp đúng nhánh path', () => {
  const yt = parseUrl('https://www.youtube.com/shorts/xyz');
  const ytHome = parseUrl('https://www.youtube.com/watch?v=1');
  assert.equal(matchesPattern(yt, 'youtube.com/shorts'), true);
  assert.equal(matchesPattern(ytHome, 'youtube.com/shorts'), false);
  assert.equal(matchesPattern(ytHome, 'youtube.com'), true);
  const li = parseUrl('https://www.linkedin.com/feed/');
  assert.equal(matchesPattern(li, 'linkedin.com/feed'), true);
  assert.equal(matchesPattern(parseUrl('https://linkedin.com/jobs'), 'linkedin.com/feed'), false);
});

test('classifyUrl chế độ allowlist: mặc định chặn, chỉ cho danh sách trắng', () => {
  const opts = { mode: 'allowlist', allowlist: ['google.com', 'hcmut.edu.vn'], blocklist: [] };
  assert.equal(classifyUrl('https://facebook.com', opts).allowed, false);
  assert.equal(classifyUrl('https://tiktok.com/@abc', opts).allowed, false);
  assert.equal(classifyUrl('https://docs.google.com/document/d/1', opts).allowed, true);
  assert.equal(classifyUrl('https://lms.hcmut.edu.vn/course', opts).allowed, true);
});

test('classifyUrl chế độ blocklist: mặc định cho qua, chỉ chặn danh sách đen', () => {
  const opts = { mode: 'blocklist', allowlist: [], blocklist: ['facebook.com', 'youtube.com'] };
  assert.equal(classifyUrl('https://m.facebook.com/', opts).allowed, false);
  assert.equal(classifyUrl('https://vnexpress.net', opts).allowed, true);
  assert.equal(classifyUrl('https://youtube.com/watch', opts).allowed, false);
});

test('classifyUrl: danh sách trắng thắng danh sách đen', () => {
  const opts = { mode: 'blocklist', allowlist: ['youtube.com/playlist'], blocklist: ['youtube.com'] };
  assert.equal(classifyUrl('https://youtube.com/playlist?list=1', opts).allowed, true);
  assert.equal(classifyUrl('https://youtube.com/watch?v=1', opts).allowed, false);
});

test('classifyUrl: tab công việc luôn được vào dù đang khoá chặt', () => {
  const opts = { mode: 'allowlist', allowlist: [], workPatterns: ['figma.com'] };
  assert.equal(classifyUrl('https://www.figma.com/file/abc', opts).allowed, true);
  assert.equal(classifyUrl('https://www.figma.com/file/abc', opts).reason, 'tab-công-việc');
});

test('classifyUrl: không bao giờ chặn trang nội bộ trình duyệt', () => {
  const opts = { mode: 'allowlist', allowlist: [] };
  for (const u of ['chrome://settings', 'chrome-extension://abcd/blocked.html', 'about:blank', 'devtools://x', 'edge://flags']) {
    assert.equal(classifyUrl(u, opts).allowed, true, u + ' phải được cho qua');
  }
});

test('classifyUrl: tệp file:// theo cấu hình', () => {
  assert.equal(classifyUrl('file:///Users/a/b.pdf', { mode: 'allowlist', allowLocalFiles: true }).allowed, true);
  assert.equal(classifyUrl('file:///Users/a/b.pdf', { mode: 'allowlist', allowLocalFiles: false }).allowed, false);
});

test('classifyUrl: URL rác không làm sập, mặc định cho qua', () => {
  for (const bad of [null, undefined, '', '   ', 'http://', '::::']) {
    assert.doesNotThrow(() => classifyUrl(bad, { mode: 'allowlist' }));
  }
});

test('workPatternsFromTasks: chỉ lấy tab của task chưa xong, không trùng lặp', () => {
  const tasks = [
    { status: 'pending', tabs: [{ url: 'https://www.figma.com/a' }, { url: 'https://figma.com/b' }] },
    { status: 'done', tabs: [{ url: 'https://netflix.com' }] },
    { status: 'pending', tabs: ['https://overleaf.com/project'] }
  ];
  const p = workPatternsFromTasks(tasks).sort();
  assert.deepEqual(p, ['figma.com', 'overleaf.com']);
});
