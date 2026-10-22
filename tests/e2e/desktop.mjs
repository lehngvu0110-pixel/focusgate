/** FocusGate Desktop — kiểm thử đầu-cuối trên Electron thật (chạy dưới xvfb). */
import pw from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../../packages/desktop/src/store.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ELECTRON = join(ROOT, 'node_modules/electron/dist/electron');
const APP = join(ROOT, 'packages/desktop');

const results = [];
function eq(a, b, m) { if (a !== b) throw new Error(`${m}\n   nhận: ${JSON.stringify(a)}\n   mong: ${JSON.stringify(b)}`); }
function assert(c, m) { if (!c) throw new Error(m); }

async function withApp(seed, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'fg-el-'));
  const file = join(dir, 'state.json');
  const store = new Store(file);
  seed?.(store);
  const app = await pw._electron.launch({
    executablePath: ELECTRON,
    args: [APP, '--no-sandbox', '--disable-gpu'],
    env: { ...process.env, FG_TEST: '1', FG_STATE_FILE: file, FG_SYNC_PORT: '0' }
  });
  try { return await fn(app, () => new Store(file)); }
  finally {
    await app.evaluate(({ app: a }) => { a.exit(0); }).catch(() => {});
    await app.close().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}

async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log(`  ✓ ${name}  ${Date.now() - t0}ms`); }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.log(`  ✗ ${name}\n    ${e.message}`); }
}

/** Lấy cửa sổ khoá (trang duy nhất đang mở lock.html). */
async function lockPage(app) {
  for (let i = 0; i < 60; i++) {
    for (const w of app.windows()) {
      if (w.url().includes('lock.html')) return w;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Không thấy cửa sổ khoá');
}

console.log('\nFocusGate Desktop E2E (Electron thật)\n');

await test('Bật app khi còn việc → hiện màn hình khoá đúng nội dung', async () => {
  await withApp((s) => s.addTask({ title: 'Ôn thi Giải tích 1', enforce: true }), async (app) => {
    const p = await lockPage(app);
    await p.waitForSelector('#headline');
    await p.waitForFunction(() => document.querySelector('#headline').textContent.includes('việc'), null, { timeout: 8000 });
    assert((await p.locator('#headline').textContent()).includes('1 việc'), 'Tiêu đề phải nói còn 1 việc');
    await p.getByText('Ôn thi Giải tích 1').first().waitFor({ state: 'visible', timeout: 8000 });
    const visible = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().some((w) => w.isVisible()));
    eq(visible, true, 'Cửa sổ khoá phải đang hiện');
  });
});

await test('Không có việc bắt buộc → không hiện màn hình khoá', async () => {
  await withApp((s) => s.addTask({ title: 'Việc nhẹ', enforce: false }), async (app) => {
    await new Promise((r) => setTimeout(r, 2500));
    const visible = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().some((w) => w.isVisible()));
    eq(visible, false, 'Không được khoá khi không có việc bắt buộc');
  });
});

await test('Tick hoàn thành → màn hình khoá tự ẩn đi', async () => {
  await withApp((s) => s.addTask({ title: 'Việc duy nhất', enforce: true }), async (app, reload) => {
    const p = await lockPage(app);
    await p.waitForSelector('.check');
    await p.locator('.check').first().click();
    // cửa sổ bị ẩn ngay sau đó nên không dùng waitForFunction (rAF ngừng chạy khi ẩn)
    for (let i = 0; i < 40; i++) {
      const vis = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some((w) => w.isVisible()));
      if (!vis) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const vis = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some((w) => w.isVisible()));
    eq(vis, false, 'Xong việc thì màn hình khoá phải biến mất');
    eq(reload().get().tasks[0].status, 'done', 'Trạng thái phải được lưu ra đĩa');
  });
});

await test('Thêm việc ngay trên màn hình khoá', async () => {
  await withApp((s) => s.addTask({ title: 'Việc gốc', enforce: true }), async (app, reload) => {
    const p = await lockPage(app);
    await p.waitForSelector('#quick');
    await p.locator('#quick').fill('Việc thêm từ màn hình khoá');
    await p.locator('#quickAdd').click();
    await p.getByText('Việc thêm từ màn hình khoá').first().waitFor({ state: 'visible', timeout: 8000 });
    eq(reload().get().tasks.length, 2, 'Phải lưu đủ 2 việc');
  });
});

await test('Không thoát được app khi còn việc bắt buộc', async () => {
  await withApp((s) => s.addTask({ title: 'Việc A', enforce: true }), async (app) => {
    await lockPage(app);
    const r = await app.evaluate(async ({ ipcMain }) => {
      // gọi thẳng handler như giao diện vẫn gọi
      return new Promise((resolve) => {
        const fake = {};
        ipcMain.emit('fg:call', fake, 'quitApp', {});
        resolve(true);
      });
    });
    assert(r, 'gọi được handler');
    await new Promise((r2) => setTimeout(r2, 800));
    const alive = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length > 0);
    eq(alive, true, 'App vẫn phải sống vì còn việc chưa xong');
  });
});

await test('Trạng thái được ghi ra đĩa ngay, mở lại app vẫn đúng', async () => {
  await withApp((s) => s.addTask({ title: 'Việc bền', enforce: true }), async (app, reload) => {
    await lockPage(app);
    const st = reload();
    eq(st.get().tasks[0].title, 'Việc bền', 'Đọc lại từ đĩa phải thấy việc');
    eq(st.gate().active, true, 'Cổng vẫn khoá');
  });
});

await test('Lối thoát khẩn cấp trên desktop: chờ + gõ đúng câu mới mở', async () => {
  await withApp((s) => {
    s.addTask({ title: 'Việc A', enforce: true });
    s.updateSettings({ emergency: { enabled: true, cooldownSec: 1, unlockMinutes: 10, maxPerDay: 2, minPhraseChars: 100 } });
  }, async (app, reload) => {
    const p = await lockPage(app);
    await p.waitForSelector('#escape');
    await p.locator('#escape summary').click();
    await p.waitForSelector('#phraseBox');
    assert(await p.locator('#escapeConfirm').isDisabled(), 'Nút phải khoá lúc đầu');
    const phrase = await p.locator('#phraseBox').textContent();
    await p.locator('#typed').fill(phrase);
    await p.waitForFunction(() => !document.querySelector('#escapeConfirm').disabled, null, { timeout: 8000 });
    await p.locator('#escapeConfirm').click();
    await p.waitForFunction(() => document.querySelector('#headline').textContent.includes('mở tạm'), null, { timeout: 8000 });
    const st = reload().get();
    assert(st.unlock && st.unlock.until > Date.now(), 'Phải có cửa sổ mở tạm trong state');
  });
});

await test('Máy chủ đồng bộ chạy cùng app và trả đúng state', async () => {
  await withApp((s) => s.addTask({ title: 'Việc đồng bộ', enforce: true }), async (app) => {
    await lockPage(app);
    const port = await app.evaluate(() => 47823);
    const res = await fetch(`http://127.0.0.1:${port}/state`).then((r) => r.json());
    eq(res.state.tasks[0].title, 'Việc đồng bộ', 'Extension đọc được state qua HTTP nội bộ');
    eq(res.gate.active, true, 'Trạng thái cổng cũng được chia sẻ');
  });
});

const pass = results.filter((r) => r.ok).length;
console.log(`\n${'─'.repeat(52)}\n  ${pass}/${results.length} bài kiểm thử desktop đạt\n`);
process.exit(pass === results.length ? 0 : 1);
