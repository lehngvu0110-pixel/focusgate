/** FocusGate — kiểm thử extension + app desktop chạy cùng nhau. */
import pw from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, until } from './harness.mjs';
import { Store } from '../../packages/desktop/src/store.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ELECTRON = join(ROOT, 'node_modules/electron/dist/electron');
const APP = join(ROOT, 'packages/desktop');

const results = [];
function eq(a, b, m) { if (a !== b) throw new Error(`${m}\n   nhận: ${JSON.stringify(a)}\n   mong: ${JSON.stringify(b)}`); }
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ ok: true }); console.log(`  ✓ ${name}  ${Date.now() - t0}ms`); }
  catch (e) { results.push({ ok: false }); console.log(`  ✗ ${name}\n    ${e.message}`); }
}

const dir = mkdtempSync(join(tmpdir(), 'fg-int-'));
const stateFile = join(dir, 'state.json');
new Store(stateFile);   // tạo tệp rỗng

console.log('\nFocusGate — extension ⇄ app desktop\n');

const electronApp = await pw._electron.launch({
  executablePath: ELECTRON,
  args: [APP, '--no-sandbox', '--disable-gpu'],
  env: { ...process.env, FG_TEST: '1', FG_STATE_FILE: stateFile }
});
await new Promise((r) => setTimeout(r, 1500));
const h = await launch();
await h.reset();

/** Trang màn hình khoá của app desktop. */
async function lockPage() {
  for (let i = 0; i < 80; i++) {
    for (const w of electronApp.windows()) if (w.url().includes('lock.html')) return w;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Không thấy cửa sổ khoá của desktop');
}

try {
  await test('Extension thấy app desktop đang chạy', async () => {
    const st = await h.call('desktopStatus');
    eq(st.connected, true, 'Phải báo đã kết nối');
  });

  await test('Thêm việc trên extension → desktop nhận được', async () => {
    await h.call('addTask', { title: 'Việc tạo từ extension', enforce: true });
    await until(() => new Store(stateFile).get().tasks.some((t) => t.title === 'Việc tạo từ extension'),
      { label: 'desktop nhận việc', timeout: 10000 });
    const s = new Store(stateFile);
    eq(s.gate().active, true, 'Desktop cũng phải khoá theo');
  });

  await test('Màn hình khoá desktop hiện việc do extension tạo', async () => {
    const lock = await lockPage();
    await lock.getByText('Việc tạo từ extension').first().waitFor({ state: 'visible', timeout: 10000 });
  });

  await test('Tick xong trên màn hình khoá desktop → extension mở cổng theo', async () => {
    const lock = await lockPage();
    await lock.locator('.check').first().click();
    await until(async () => !(await h.call('get')).gate.active, { label: 'extension mở cổng', timeout: 15000 });
    const snap = await h.call('get');
    eq(snap.state.tasks.find((t) => t.title === 'Việc tạo từ extension').status, 'done', 'Trạng thái đồng bộ về extension');
    const p = await h.context.newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    eq(/blocked\.html/.test(p.url()), false, 'Trình duyệt phải mở lại được');
    await p.close();
  });

  await test('Việc tạo trên desktop cũng chặn web ở trình duyệt', async () => {
    await electronApp.evaluate(() => globalThis.__FG_TEST__.handlers.addTask({ title: 'Việc tạo từ desktop', enforce: true }));
    await until(async () => (await h.call('get')).gate.active, { label: 'extension khoá lại', timeout: 15000 });
    const p = await h.context.newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(/blocked\.html/, { timeout: 10000 });
    await p.close();
  });

  await test('Tắt đồng bộ thì hai bên chạy độc lập', async () => {
    await h.call('updateSettings', { patch: { syncEnabled: false } });
    const before = new Store(stateFile).get().tasks.length;
    await h.call('addTask', { title: 'Việc chỉ ở extension', enforce: false });
    await new Promise((r) => setTimeout(r, 2500));
    eq(new Store(stateFile).get().tasks.length, before, 'Desktop không được nhận thêm việc');
    const st = await h.call('desktopStatus');
    eq(st.connected, false, 'Báo đúng là đang tắt đồng bộ');
  });
} finally {
  await h.close();
  await electronApp.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await electronApp.close().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n${'─'.repeat(52)}\n  ${pass}/${results.length} bài kiểm thử tích hợp đạt\n`);
process.exit(pass === results.length ? 0 : 1);
