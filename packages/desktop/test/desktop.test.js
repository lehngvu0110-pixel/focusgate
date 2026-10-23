import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { createSyncServer } from '../src/sync-server.js';
import { isAppBlocked } from '../src/mac.js';

const dir = () => mkdtempSync(join(tmpdir(), 'fg-store-'));

test('Store: tạo mới, lưu ra đĩa, đọc lại nguyên vẹn', () => {
  const d = dir(); const f = join(d, 'state.json');
  const s1 = new Store(f);
  s1.addTask({ title: 'Học bài', enforce: true });
  assert.equal(s1.gate().active, true);
  const s2 = new Store(f);
  assert.equal(s2.get().tasks[0].title, 'Học bài');
  assert.equal(s2.gate().active, true);
  rmSync(d, { recursive: true, force: true });
});

test('Store: tệp hỏng không làm sập app', () => {
  const d = dir(); const f = join(d, 'state.json');
  writeFileSync(f, '{{{ hỏng');
  const s = new Store(f);
  assert.deepEqual(s.get().tasks, []);
  assert.ok(s.get().settings.allowlist.length > 0);
  rmSync(d, { recursive: true, force: true });
});

test('Store: hoàn thành việc thì mở cổng; updatedAt tăng lên', async () => {
  const d = dir(); const s = new Store(join(d, 'state.json'));
  s.addTask({ title: 'A', enforce: true });
  const t0 = s.get().updatedAt;
  await new Promise((r) => setTimeout(r, 5));
  const id = s.get().tasks[0].id;
  s.completeTask(id);
  assert.equal(s.gate().active, false);
  assert.ok(s.get().updatedAt > t0, 'updatedAt phải tăng để đồng bộ nhận biết');
  rmSync(d, { recursive: true, force: true });
});

test('Store: ghi nguyên tử — không để lại tệp .tmp', () => {
  const d = dir(); const f = join(d, 'state.json');
  const s = new Store(f);
  s.addTask({ title: 'A' });
  assert.ok(JSON.parse(readFileSync(f, 'utf8')).tasks.length === 1);
  assert.throws(() => readFileSync(f + '.tmp', 'utf8'), 'không được còn tệp tạm');
  rmSync(d, { recursive: true, force: true });
});

test('Store: thoát khẩn cấp cần đúng câu cam kết', async () => {
  const d = dir(); const s = new Store(join(d, 'state.json'));
  s.addTask({ title: 'A', enforce: true });
  s.update((st) => ({ ...st, stats: { ...st.stats, streak: 5, points: 100 } }));
  assert.equal(s.emergency('sai bét').ok, false);
  const { pickPhrase } = await import('../vendor/core/index.js');
  const t0 = Date.now();
  assert.equal(s.emergency(pickPhrase(s.get()), t0).ok, false, 'chưa mở hộp thoại → chưa đếm ngược');
  s.emergencyInfo(t0);
  assert.match(s.emergency(pickPhrase(s.get()), t0 + 5000).error, /chờ/, 'chưa hết 30 giây');
  const r = s.emergency(pickPhrase(s.get()), t0 + 31000);
  assert.equal(r.ok, true);
  assert.equal(s.gate().active, false);
  assert.equal(s.get().stats.streak, 0);
  assert.equal(s.get().stats.points, 50);
  rmSync(d, { recursive: true, force: true });
});

test('Store.tick: hết cửa sổ mở tạm thì khoá lại', () => {
  const d = dir(); const s = new Store(join(d, 'state.json'));
  s.addTask({ title: 'A', enforce: true });
  s.update((st) => ({ ...st, unlock: { until: Date.now() - 1000 } }));
  assert.equal(s.gate().active, true, 'đã quá hạn mở tạm');
  const ev = s.tick();
  assert.ok(ev.some((e) => e.type === 'unlock-expired'));
  assert.equal(s.get().unlock, null);
  rmSync(d, { recursive: true, force: true });
});

test('Máy chủ đồng bộ: GET /state, /ping và POST /state', async () => {
  const d = dir(); const s = new Store(join(d, 'state.json'));
  s.addTask({ title: 'Việc trên desktop', enforce: true });
  const sync = createSyncServer(s, { port: 0 });
  const port = await sync.listen();
  const base = `http://127.0.0.1:${port}`;

  const ping = await (await fetch(base + '/ping')).json();
  assert.equal(ping.app, 'focusgate-desktop');

  const got = await (await fetch(base + '/state')).json();
  assert.equal(got.state.tasks[0].title, 'Việc trên desktop');
  assert.equal(got.gate.active, true);

  const next = { ...s.get(), tasks: [], updatedAt: Date.now() + 1000 };
  const put = await fetch(base + '/state', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'chrome-extension://abc' },
    body: JSON.stringify({ state: next })
  });
  assert.equal(put.status, 200);
  assert.equal(s.get().tasks.length, 0, 'extension đẩy state mới sang desktop');
  assert.equal(s.gate().active, false);

  await sync.close(); rmSync(d, { recursive: true, force: true });
});

test('Máy chủ đồng bộ: từ chối trang web thường', async () => {
  const d = dir(); const s = new Store(join(d, 'state.json'));
  const sync = createSyncServer(s, { port: 0 });
  const port = await sync.listen();
  const res = await fetch(`http://127.0.0.1:${port}/state`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(res.status, 403, 'trang web ngoài không được đọc dữ liệu');
  await sync.close(); rmSync(d, { recursive: true, force: true });
});

test('Máy chủ đồng bộ: dữ liệu rác bị từ chối gọn gàng', async () => {
  const d = dir(); const s = new Store(join(d, 'state.json'));
  const sync = createSyncServer(s, { port: 0 });
  const port = await sync.listen();
  const r1 = await fetch(`http://127.0.0.1:${port}/state`, { method: 'POST', body: '{{{' });
  assert.equal(r1.status, 400, 'JSON hỏng là lỗi của bên gửi');
  const r2 = await fetch(`http://127.0.0.1:${port}/state`, { method: 'POST', body: JSON.stringify({ nope: 1 }) });
  assert.equal(r2.status, 400);
  const r3 = await fetch(`http://127.0.0.1:${port}/khong-co`);
  assert.equal(r3.status, 404);
  assert.equal(s.get().tasks.length, 0, 'state không bị hỏng');
  await sync.close(); rmSync(d, { recursive: true, force: true });
});

test('isAppBlocked: khớp không phân biệt hoa thường và khớp một phần', () => {
  const list = ['Discord', 'Steam', 'Zalo'];
  assert.equal(isAppBlocked('Discord', list), true);
  assert.equal(isAppBlocked('discord', list), true);
  assert.equal(isAppBlocked('Discord Helper', list), true);
  assert.equal(isAppBlocked('Xcode', list), false);
  assert.equal(isAppBlocked('', list), false);
  assert.equal(isAppBlocked('Discord', []), false);
});

test('Store: không ghi đĩa khi không có gì đổi', () => {
  const d = dir(); const f = join(d, 'state.json');
  const s = new Store(f);
  s.addTask({ title: 'A' });
  const before = readFileSync(f, 'utf8');
  let emitted = 0; s.onChange(() => emitted++);
  s.tick(); s.tick();
  assert.equal(readFileSync(f, 'utf8'), before);
  assert.equal(emitted, 0);
  rmSync(d, { recursive: true, force: true });
});

test('Store: người gác chặn xoá việc bắt buộc khi đang khoá', () => {
  const d = dir(); const s = new Store(join(d, 'state.json'));
  s.addTask({ title: 'Bài tập', enforce: true });
  const id = s.get().tasks[0].id;
  assert.throws(() => s.deleteTask(id, { guard: true }), /Bài tập/);
  assert.throws(() => s.updateSettings({ mode: 'blocklist' }, { guard: true }), /Cổng đang khoá/);
  assert.equal(s.get().tasks.length, 1);
  s.completeTask(id);
  s.deleteTask(id, { guard: true });
  assert.equal(s.get().tasks.length, 0, 'làm xong rồi thì xoá thoải mái');
  rmSync(d, { recursive: true, force: true });
});

test('Máy chủ đồng bộ: bản cũ hơn không ghi đè được thay đổi trên desktop', async () => {
  const d = dir(); const s = new Store(join(d, 'state.json'));
  s.addTask({ title: 'Việc A', enforce: true });
  const stale = { ...s.get(), tasks: [], updatedAt: (s.get().updatedAt || 0) - 5000 };
  const sync = createSyncServer(s, { port: 0 });
  const port = await sync.listen();
  const res = await fetch(`http://127.0.0.1:${port}/state`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: stale })
  });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).state.tasks.length, 1, 'trả về bản hiện tại để bên kia cập nhật');
  assert.equal(s.get().tasks.length, 1);
  await sync.close(); rmSync(d, { recursive: true, force: true });
});

test('Máy chủ đồng bộ: chặn DNS rebinding (Host lạ) và không cấp CORS cho trang web', async () => {
  const d = dir(); const s = new Store(join(d, 'state.json'));
  const sync = createSyncServer(s, { port: 0 });
  const port = await sync.listen();
  const http = await import('node:http');
  const status = await new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port, path: '/state', headers: { Host: 'evil.example:' + port } }, (r) => { r.resume(); resolve(r.statusCode); });
  });
  assert.equal(status, 403, 'Host không phải localhost phải bị từ chối');
  const pre = await fetch(`http://127.0.0.1:${port}/state`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert.equal(pre.status, 403);
  assert.equal(pre.headers.get('access-control-allow-origin'), null);
  const ok = await fetch(`http://127.0.0.1:${port}/ping`, { headers: { Origin: 'chrome-extension://abcdef' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'chrome-extension://abcdef');
  await sync.close(); rmSync(d, { recursive: true, force: true });
});
