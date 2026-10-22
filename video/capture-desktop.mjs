/** Quay màn hình khoá của app desktop (Electron). */
import pw from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { startScreencast } from './screencast.mjs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../packages/desktop/src/store.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS = join(ROOT, 'video/clips');
const W = 900, H = 1120;

const dir = mkdtempSync(join(tmpdir(), 'fg-vid-'));
const file = join(dir, 'state.json');
const s = new Store(file);
const now = Date.now();
s.addTask({ title: 'Làm xong bài tập Giải tích chương 3', enforce: true, dueAt: now + 3 * 3600e3 });
s.addTask({ title: 'Ôn 30 từ vựng tiếng Anh', enforce: true, repeat: 'daily' });
s.update((st) => ({ ...st, stats: { ...st.stats, streak: 12, bestStreak: 12, points: 430 } }));

const app = await pw._electron.launch({
  executablePath: join(ROOT, 'node_modules/electron/dist/electron'),
  args: [join(ROOT, 'packages/desktop'), '--no-sandbox', '--disable-gpu'],
  env: { ...process.env, FG_TEST: '1', FG_STATE_FILE: file, FG_SYNC_PORT: '0' }
});

let lock = null;
for (let i = 0; i < 80 && !lock; i++) {
  for (const w of app.windows()) if (w.url().includes('lock.html')) lock = w;
  await new Promise((r) => setTimeout(r, 200));
}
if (!lock) throw new Error('Không thấy cửa sổ khoá');
await lock.setViewportSize({ width: W, height: H });
await mkdir(CLIPS, { recursive: true });
const stop = await startScreencast(lock, join(CLIPS, 'e-desktop.webm'), { width: W, height: H });
await new Promise((r) => setTimeout(r, 4200));
await lock.locator('.check').first().click();
await new Promise((r) => setTimeout(r, 2600));

await stop();
await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
await app.close().catch(() => {});
rmSync(dir, { recursive: true, force: true });
console.log('• đã quay e-desktop.webm');
