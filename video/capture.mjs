/**
 * FocusGate — quay các cảnh demo thật trong Chromium (extension) và Electron (app desktop).
 * Mỗi cảnh xuất ra một tệp .webm trong video/clips/.
 */
import { launchForVideo } from './launch.mjs';
import { rename, mkdir, rm, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS = join(ROOT, 'video/clips');
const W = 900, H = 1120;

await rm(CLIPS, { recursive: true, force: true });
await mkdir(CLIPS, { recursive: true });

/** Ghi một cảnh: mở context có quay phim, chạy kịch bản, lưu ra tên mong muốn. */
async function scene(name, fn) {
  const dir = join(CLIPS, '_' + name);
  const h = await launchForVideo({ recordVideo: { dir, size: { width: W, height: H } }, viewport: { width: W, height: H } });
  await h.reset();
  const page = await h.context.newPage();
  await page.setViewportSize({ width: W, height: H });
  try {
    await fn(h, page);
  } finally {
    const p = await page.video()?.path();
    await page.close();                 // phải đóng page trước khi video được ghi xong
    await h.close();
    if (p) await rename(p, join(CLIPS, name + '.webm'));
    await rm(dir, { recursive: true, force: true });
  }
  console.log('• đã quay', name + '.webm');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- */
/* Cảnh 1 — Ghi việc cần làm trên bảng điều khiển                    */
/* ---------------------------------------------------------------- */
await scene('a-ghi-viec', async (h, page) => {
  await page.goto(h.url('src/dashboard.html'), { waitUntil: 'domcontentloaded' });
  await sleep(1400);
  await page.locator('#tTitle').click();
  await page.locator('#tTitle').type('Làm xong bài tập Giải tích chương 3', { delay: 62 });
  await sleep(700);
  await page.locator('#tDue').fill(new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16));
  await sleep(900);
  await page.locator('#tAdd').scrollIntoViewIfNeeded();
  await sleep(400);
  await page.locator('#tAdd').click();
  await sleep(1600);
  await page.locator('#tTitle').click();
  await page.locator('#tTitle').type('Ôn 30 từ vựng tiếng Anh', { delay: 52 });
  await sleep(500);
  await page.locator('#tAdd').click();
  await sleep(2200);
});

/* ---------------------------------------------------------------- */
/* Cảnh 2 — Mở facebook.com và bị chặn                               */
/* ---------------------------------------------------------------- */
await scene('b-bi-chan', async (h, page) => {
  await h.call('addTask', { title: 'Làm xong bài tập Giải tích chương 3', enforce: true, dueAt: Date.now() + 3 * 3600e3 });
  await h.call('addTask', { title: 'Ôn 30 từ vựng tiếng Anh', enforce: true, repeat: 'daily' });
  await h.setState({ stats: { streak: 12, bestStreak: 12, points: 430, lastSuccessDay: null, days: {} } });
  await h.call('refresh');

  await page.goto('https://lms.hcmut.edu.vn/course/22', { waitUntil: 'domcontentloaded' });
  await sleep(1800);
  await page.goto('https://facebook.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/blocked/, { timeout: 8000 });
  await sleep(3600);
  await page.mouse.wheel(0, 260);
  await sleep(2400);
  await page.mouse.wheel(0, -260);
  await sleep(1400);
});

/* ---------------------------------------------------------------- */
/* Cảnh 3 — Tick xong việc, cổng mở, trang tải lại                   */
/* ---------------------------------------------------------------- */
await scene('c-mo-cong', async (h, page) => {
  await h.call('addTask', { title: 'Làm xong bài tập Giải tích chương 3', enforce: true, dueAt: Date.now() + 3 * 3600e3 });
  await h.call('addTask', { title: 'Ôn 30 từ vựng tiếng Anh', enforce: true, repeat: 'daily' });
  await h.setState({ stats: { streak: 12, bestStreak: 12, points: 430, lastSuccessDay: null, days: {} } });
  await h.call('refresh');

  await page.goto('https://facebook.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/blocked/, { timeout: 8000 });
  await sleep(1500);
  await page.locator('.check').first().click();
  await sleep(2100);
  await page.locator('.check').first().click();
  await sleep(1300);
  await page.waitForURL(/facebook\.com/, { timeout: 12000 }).catch(() => {});
  await sleep(3400);
});

/* ---------------------------------------------------------------- */
/* Cảnh 4 — Popup trên thanh công cụ                                 */
/* ---------------------------------------------------------------- */
await scene('d-popup', async (h, page) => {
  await h.call('addTask', { title: 'Làm xong bài tập Giải tích chương 3', enforce: true });
  await h.call('addTask', { title: 'Ôn 30 từ vựng tiếng Anh', enforce: true });
  await h.setState({ stats: { streak: 12, bestStreak: 12, points: 430, lastSuccessDay: null, days: {} } });
  await h.call('refresh');
  await page.goto(h.url('src/popup.html'), { waitUntil: 'domcontentloaded' });
  // popup chỉ rộng 368px — phóng to và canh giữa cho vừa khung video dọc
  await page.addStyleTag({ content: `
    html { background: #08080C; height: 100%; }
    body { zoom: 2.35; margin: 24px auto 0 !important;
           border: 1px solid rgba(255,255,255,.12); border-radius: 14px; overflow: hidden;
           box-shadow: 0 24px 70px -20px rgba(0,0,0,.9); }
  ` });
  await sleep(2600);
  await page.locator('.check').first().click();
  await sleep(2600);
});

console.log('\nXong. Các tệp trong video/clips/:');
for (const f of (await readdir(CLIPS)).sort()) console.log('  ' + f);
