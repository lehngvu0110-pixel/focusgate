/**
 * Quay toàn bộ luồng "lối thoát khẩn cấp" thật trong Chromium.
 *
 * Khung hẹp (640×800) với deviceScaleFactor 2 → video 1280×1600, chữ to gấp ~1,4 lần
 * so với khung 900 nên panel cam kết đọc được rõ trên điện thoại.
 * Ghi kèm mốc thời gian từng nhịp ra clips/escape-marks.json để build.mjs cắt đúng chỗ.
 */
import { launchForVideo } from './launch.mjs';
import { rename, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIPS = join(ROOT, 'video/clips');
const W = 640, H = 800, DSF = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TASKS = [
  { title: 'Làm xong bài tập Giải tích chương 3', enforce: true },
  { title: 'Ôn 30 từ vựng tiếng Anh', enforce: true, repeat: 'daily' }
];
const STATS = { streak: 12, bestStreak: 12, points: 430, lastSuccessDay: null, days: {} };

async function scene(name, fn) {
  const dir = join(CLIPS, '_' + name);
  const h = await launchForVideo({
    recordVideo: { dir, size: { width: W * DSF, height: H * DSF } },
    viewport: { width: W, height: H },
    deviceScaleFactor: DSF
  });
  await h.reset();
  const page = await h.context.newPage();
  await page.setViewportSize({ width: W, height: H });
  const t0 = Date.now();
  const marks = {};
  const mark = (k) => { marks[k] = Number(((Date.now() - t0) / 1000).toFixed(2)); };
  try {
    await fn(h, page, mark);
  } finally {
    const p = await page.video()?.path();
    await page.close();
    await h.close();
    if (p) await rename(p, join(CLIPS, name + '.webm'));
    await rm(dir, { recursive: true, force: true });
  }
  console.log(`• ${name}.webm`, JSON.stringify(marks));
  return marks;
}

/** Cuộn sao cho phần tử nằm cách đỉnh khung một khoảng cố định. */
const frame = (page, sel, gap = 56) => page.evaluate(([s, g]) => {
  const el = document.querySelector(s);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - g;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}, [sel, gap]);

const toTop = (page) => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ---------------------------------------------------------------- */
/* Luồng chính                                                       */
/* ---------------------------------------------------------------- */
const marks = await scene('f-loi-thoat', async (h, page, mark) => {
  for (const t of TASKS) await h.call('addTask', t);
  await h.setState({ stats: STATS });
  await h.call('refresh');
  const info = await h.call('emergencyInfo');

  await page.goto('https://facebook.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/blocked/, { timeout: 8000 });
  await sleep(1700);
  mark('blocked');

  // mở panel, đưa bảng "cái giá" lên đầu khung
  await frame(page, '#escape', 120);
  await sleep(700);
  await page.locator('#escape summary').click();
  await page.waitForSelector('#phraseBox');
  await sleep(500);
  await frame(page, '#escapeBody .cost', 70);
  await sleep(3000);
  mark('panelOpen');

  // thử dán — bị chặn, hiện toast
  await page.locator('#typed').dispatchEvent('paste');
  await sleep(2400);
  mark('pasteBlocked');

  // đưa ô nhập + thanh đếm ngược vào khung rồi gõ tay từng chữ
  await frame(page, '#phraseBox', 64);
  await sleep(800);
  await page.locator('#typed').click();
  await page.locator('#typed').type(info.phrase, { delay: 56 });
  await sleep(1000);
  mark('typed');

  // chờ hết đếm ngược 30 giây — nút vẫn khoá
  await frame(page, '#escapeConfirm', 300);
  await page.waitForFunction(() => {
    const b = document.getElementById('escapeConfirm');
    return b && !b.disabled;
  }, null, { timeout: 45000, polling: 500 });
  await sleep(1100);
  mark('ready');

  await page.locator('#escapeConfirm').click();
  await page.waitForFunction(() => document.querySelector('#headline')?.textContent.includes('mở tạm'),
    null, { timeout: 8000, polling: 250 });
  await toTop(page);
  await sleep(3400);
  mark('unlocked');

  // đổi ý: khoá lại ngay
  await page.getByText(/quay lại làm việc|back to work/i).click();
  await sleep(600);
  await toTop(page);
  await sleep(2400);
  mark('relocked');
});

/* ---------------------------------------------------------------- */
/* Chế độ cứng tuyệt đối: tắt hẳn lối thoát                          */
/* ---------------------------------------------------------------- */
await scene('g-cung-tuyet-doi', async (h, page, mark) => {
  for (const t of TASKS) await h.call('addTask', t);
  await h.setState({
    stats: STATS,
    settings: { emergency: { enabled: false, cooldownSec: 30, unlockMinutes: 10, maxPerDay: 2 } }
  });
  await h.call('refresh');

  await page.goto('https://facebook.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/blocked/, { timeout: 8000 });
  await sleep(1200);
  await frame(page, '#escape', 120);
  await sleep(600);
  await page.locator('#escape summary').click();
  await page.waitForSelector('#escapeBody .cost');
  await sleep(400);
  await frame(page, '#escapeBody .cost', 90);
  await sleep(4400);
  mark('shown');
});

await writeFile(join(CLIPS, 'escape-marks.json'), JSON.stringify(marks, null, 2));
console.log('\nMốc thời gian đã ghi vào clips/escape-marks.json');
