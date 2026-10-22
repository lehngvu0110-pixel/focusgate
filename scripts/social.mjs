#!/usr/bin/env node
/** Kết xuất bộ ảnh quảng bá FocusGate từ social/card.html bằng Chromium. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist/social');
await mkdir(OUT, { recursive: true });

const CARDS = [
  ['og',     1200,  630, 'og-1200x630',          'Ảnh xem trước khi chia sẻ link (Facebook, LinkedIn, X)'],
  ['square', 1080, 1080, 'post-1080x1080',       'Bài đăng vuông (Instagram, Facebook)'],
  ['story',  1080, 1920, 'story-1080x1920',      'Story / Reels cover (Instagram, Facebook)'],
  ['cover',  1500,  500, 'cover-1500x500',       'Ảnh bìa (X / LinkedIn)'],
  ['c1',     1080, 1080, 'carousel-1-van-de',    'Carousel 1/3 — vấn đề'],
  ['c2',     1080, 1080, 'carousel-2-cach-lam',  'Carousel 2/3 — cách làm'],
  ['c3',     1080, 1080, 'carousel-3-bang-chung','Carousel 3/3 — bằng chứng'],
  ['m1',     1600, 1000, 'mockup-trang-chan',    'Ảnh đóng khung — trang chặn trong trình duyệt'],
  ['m2',     1600, 1000, 'mockup-bang-dieu-khien','Ảnh đóng khung — bảng điều khiển'],
  ['m3',     1600, 1000, 'mockup-man-hinh-khoa', 'Ảnh đóng khung — màn hình khoá macOS']
];

const browser = await chromium.launch({
  executablePath: process.env.FG_CHROME || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--font-render-hinting=none']
});

for (const [card, w, h, name, label] of CARDS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto('file://' + join(ROOT, 'social/card.html'), { waitUntil: 'networkidle' });
  await page.evaluate((c) => { document.body.dataset.card = c; }, card);
  await page.waitForTimeout(450);
  await page.locator('.card.' + card).screenshot({ path: join(OUT, name + '.png') });
  await page.close();
  console.log(`• ${name}.png  ${w}×${h}  — ${label}`);
}
await browser.close();
