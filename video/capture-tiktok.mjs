/**
 * Quay footage cho clip TikTok duy nhất (bản dọc, chữ to).
 * Khung 480×590 CSS px, deviceScaleFactor 2 → khung hình 960×1180, đúng bằng ô hình trong khung 9:16.
 * Quay bằng screencast.mjs (CDP) ở điểm ảnh thật, không dùng recordVideo của Playwright.
 * Ghi mốc thời gian từng nhịp ra <out>/marks.json để bước dựng cắt đúng chỗ.
 */
import { launchForVideo } from './launch.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startScreencast } from './screencast.mjs';

const OUT = process.env.FG_TT_OUT || join(dirname(fileURLToPath(import.meta.url)), 'tiktok/work/clips');
const W = 480, H = 590, DSF = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(OUT, { recursive: true });

const TASKS = [
  { title: 'Làm xong bài tập Giải tích chương 3', enforce: true, dueAt: Date.now() + 3 * 3600e3 },
  { title: 'Ôn 30 từ vựng tiếng Anh', enforce: true, repeat: 'daily' }
];
// hôm qua đã giữ chuỗi → hôm nay xong việc thì chuỗi lên 13 (seed null sẽ làm chuỗi tụt về 1, sai câu chuyện)
const _y = new Date(Date.now() - 864e5), _p = (n) => String(n).padStart(2, '0');
const STATS = { streak: 12, bestStreak: 12, points: 430, days: {},
  lastSuccessDay: `${_y.getFullYear()}-${_p(_y.getMonth() + 1)}-${_p(_y.getDate())}` };
const all = {};

async function scene(name, fn) {
  const h = await launchForVideo({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  await h.reset();
  const page = await h.context.newPage();
  await page.goto('about:blank');
  const stop = await startScreencast(page, join(OUT, name + '.mp4'), { width: W * DSF, height: H * DSF });
  const t0 = Date.now(); const marks = {};
  const mark = (k) => { marks[k] = +((Date.now() - t0) / 1000).toFixed(2); };
  let nf = 0;
  try { await fn(h, page, mark); }
  finally { nf = await stop(); await page.close(); await h.close(); }
  all[name] = marks; console.log('•', name, nf + ' khung', JSON.stringify(marks));
}
const seed = async (h, tasks = TASKS) => {
  for (const t of tasks) await h.call('addTask', t);
  await h.setState({ stats: STATS }); await h.call('refresh');
};
const scrollTo = (page, sel, gap = 24) => page.evaluate(([s, g]) => {
  const el = document.querySelector(s); if (!el) return;
  window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - g), behavior: 'smooth' });
}, [sel, gap]);

/* 1 — Đang lướt Facebook thì thêm việc bắt buộc: tab bị kéo về trang chặn (hook + "trang mở sẵn") */
await scene('t1-keo-ve', async (h, page, mark) => {
  await h.setState({ stats: STATS });
  await page.goto('https://facebook.com/', { waitUntil: 'domcontentloaded' });
  await sleep(1600); await page.mouse.wheel(0, 180); await sleep(900); mark('scrolling');
  await h.call('addTask', TASKS[0]); await h.call('addTask', TASKS[1]); mark('taskAdded');
  await page.waitForURL(/blocked/, { timeout: 8000 }); mark('blocked');
  await sleep(4200); mark('end');
});

/* 2 — Ghi việc trên bảng điều khiển */
await scene('t2-ghi-viec', async (h, page, mark) => {
  await h.setState({ stats: STATS });
  await page.goto(h.url('src/dashboard.html'), { waitUntil: 'domcontentloaded' });
  await sleep(700);
  await scrollTo(page, '#tTitle', 150); await sleep(700); mark('ready');
  await page.locator('#tTitle').click();
  await page.locator('#tTitle').type('Làm xong bài tập Giải tích chương 3', { delay: 45 }); mark('typed');
  await sleep(350);
  await page.locator('#tDue').fill(new Date(Date.now() + 3 * 3600e3 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16));
  await sleep(600); mark('due');
  await page.locator('#tAdd').scrollIntoViewIfNeeded(); await sleep(300);
  await page.locator('#tAdd').click(); mark('added');
  await sleep(500);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  await sleep(2600); mark('end');
});

/* 3 — Bấm link TikTok từ một trang học tập → bị chặn */
await scene('t3-bam-link', async (h, page, mark) => {
  await seed(h);
  await page.goto('https://lms.hcmut.edu.vn/course/22', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = 'https://www.tiktok.com/@trend/video/7'; a.id = 'lnk';
    a.textContent = 'Xem clip này nè 👉 tiktok.com/@trend';
    a.style.cssText = 'display:block;margin:18px 12px;padding:16px 18px;border-radius:14px;background:#fff;' +
      'box-shadow:0 1px 3px rgba(0,0,0,.15);font:600 17px system-ui;color:#1877F2;text-decoration:none';
    document.body.insertBefore(a, document.body.children[1]);
  });
  await sleep(1500); mark('shown');
  await page.hover('#lnk'); await sleep(400);
  await page.click('#lnk'); mark('clicked');
  await page.waitForURL(/blocked/, { timeout: 8000 }); mark('blocked');
  await sleep(3000); mark('end');
});

/* 4 — Lối thoát khẩn cấp: cái giá → dán bị chặn → gõ tay → đếm ngược → mở tạm, chuỗi về 0 */
await scene('t4-loi-thoat', async (h, page, mark) => {
  await seed(h);
  const info = await h.call('emergencyInfo');
  await page.goto('https://facebook.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/blocked/, { timeout: 8000 }); await sleep(600);
  await scrollTo(page, '#escape', 80); await sleep(500);
  await page.locator('#escape summary').click(); await page.waitForSelector('#phraseBox');
  await sleep(300); await scrollTo(page, '#escapeBody .cost', 16); await sleep(700); mark('cost');
  await sleep(1800);
  await scrollTo(page, '#phraseBox', 16); await sleep(600);
  await page.locator('#typed').dispatchEvent('paste'); mark('paste');
  await sleep(1500);
  await page.locator('#typed').click(); mark('typeStart');
  await page.locator('#typed').type(info.phrase, { delay: 34 }); mark('typed');
  await scrollTo(page, '#typed', 16);
  await page.waitForFunction(() => { const b = document.getElementById('escapeConfirm'); return b && !b.disabled; },
    null, { timeout: 45000, polling: 250 }); mark('ready');
  await sleep(700);
  await page.locator('#escapeConfirm').click(); mark('confirm');
  await page.waitForFunction(() => document.querySelector('#headline')?.textContent.includes('mở tạm'), null, { timeout: 8000, polling: 200 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); mark('unlocked');
  await sleep(3500); mark('end');
});

/* 5 — Làm xong thật: tick hai việc → cổng mở → về đúng trang Facebook */
await scene('t5-xong-viec', async (h, page, mark) => {
  await seed(h);
  await page.goto('https://facebook.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/blocked/, { timeout: 8000 }); await sleep(1100); mark('blocked');
  await page.locator('.check').first().click(); mark('tick1'); await sleep(1500);
  await page.locator('.check').first().click(); mark('tick2');
  await page.waitForFunction(() => /Xong hết/.test(document.querySelector('#headline')?.textContent || ''), null, { timeout: 6000, polling: 100 }).catch(() => {});
  mark('allDone');
  await page.waitForURL((u) => u.href.startsWith('https://facebook.com'), { timeout: 12000 }).catch(() => {}); mark('back');
  await sleep(2500); mark('end');
});

/* 6 — Popup trên thanh công cụ: tick nhanh không cần mở bảng điều khiển */
await scene('t6-popup', async (h, page, mark) => {
  await seed(h);
  await page.goto(h.url('src/popup.html'), { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: `
    html { background: #08080C; min-height: 100%; }
    body { zoom: 1.24; margin: 18px auto 0 !important; border: 1px solid rgba(255,255,255,.12);
           border-radius: 14px; overflow: hidden; box-shadow: 0 24px 70px -20px rgba(0,0,0,.9); }` });
  await sleep(1400); mark('shown');
  await page.locator('.check').first().click(); mark('tick1'); await sleep(1300);
  await page.locator('.check').first().click(); mark('tick2'); await sleep(2200); mark('end');
});

await writeFile(join(OUT, 'marks.json'), JSON.stringify(all, null, 2));
console.log('Xong →', OUT);
