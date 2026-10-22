import pw from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../../packages/desktop/src/store.js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = mkdtempSync(join(tmpdir(), 'fg-shot-'));
const file = join(dir, 'state.json');
const s = new Store(file);
const now = Date.now();
s.addTask({ title: 'Hoàn thành báo cáo thí nghiệm Vật lý 1', note: 'Phần 3: xử lý số liệu + vẽ đồ thị sai số', enforce: true, dueAt: now + 3 * 3600e3, tabs: [{ url: 'https://overleaf.com/p' }, { url: 'https://lms.hcmut.edu.vn/c' }] });
s.addTask({ title: 'Ôn 30 từ vựng tiếng Anh', enforce: true, repeat: 'daily' });
s.addTask({ title: 'Đọc 1 chương sách Giải tích', enforce: false, dueAt: now - 2 * 3600e3 });
s.update((st) => ({ ...st, stats: { ...st.stats, streak: 12, bestStreak: 12, points: 430, days: { [new Date().toISOString().slice(0,10)]: { focusSec: 5700, completed: 1, created: 3, emergencies: 0 } } } }));

const app = await pw._electron.launch({
  executablePath: join(ROOT, 'node_modules/electron/dist/electron'),
  args: [join(ROOT, 'packages/desktop'), '--no-sandbox', '--disable-gpu'],
  env: { ...process.env, FG_TEST: '1', FG_STATE_FILE: file }
});
let lock = null;
for (let i = 0; i < 60 && !lock; i++) {
  for (const w of app.windows()) if (w.url().includes('lock.html')) lock = w;
  await new Promise((r) => setTimeout(r, 200));
}
await lock.setViewportSize({ width: 1100, height: 820 });
await lock.emulateMedia({ colorScheme: 'dark' });
await lock.waitForTimeout(1200);
await lock.screenshot({ path: join(ROOT, 'dist/shots/desktop-lock-dark.png') });
await lock.emulateMedia({ colorScheme: 'light' });
await lock.waitForTimeout(500);
await lock.screenshot({ path: join(ROOT, 'dist/shots/desktop-lock-light.png') });
await app.evaluate(({ app: a }) => { globalThis.__FG_TEST__.handlers.openPanel(); });
let panel = null;
for (let i = 0; i < 40 && !panel; i++) {
  for (const w of app.windows()) if (w.url().includes('panel.html')) panel = w;
  await new Promise((r) => setTimeout(r, 200));
}
if (panel) { await panel.waitForTimeout(1200); await panel.screenshot({ path: join(ROOT, 'dist/shots/desktop-panel.png'), fullPage: true }); }
console.log('shots ok');
await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
await app.close().catch(() => {});
rmSync(dir, { recursive: true, force: true });
