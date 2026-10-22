/**
 * Kết xuất tài sản cho video:
 *  - bg.png                              nền 1080×1920 (aurora + hạt nhiễu)
 *  - ovl-<story>-<lang>-<i>.png          lớp phủ mỗi cảnh: nền + phụ đề + thanh cửa sổ,
 *                                        khoét lỗ trong suốt đúng chỗ video
 *  - cards/<story>-<lang>-<name>/f####.png   chuỗi khung hình cho thẻ mở đầu / số liệu / kết
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HERE = join(ROOT, 'video');
const OUT = join(HERE, 'assets');
const URL_BASE = 'file://' + join(HERE, 'scene.html');

/* Hình học khung hình — phải khớp với scene.html và với lệnh ffmpeg */
export const GEO = { W: 1080, H: 1920, VX: 90, VY: 500, VW: 900, VH: 1120, RADIUS: 20 };

const FPS = 30;
/** Thẻ chỉ động trong ~1,25 giây đầu; phần còn lại sẽ giữ khung cuối bằng ffmpeg. */
const ANIM_FRAMES = 38;
const CARD_MODES = ['title', 'stats', 'cta'];
const LANGS = ['vi', 'en'];
/** Số cảnh có lớp phủ của từng chuyện. */
const STORIES = { demo: 5, escape: 7 };

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.FG_CHROME || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--font-render-hinting=none']
});
const page = await browser.newPage({ viewport: { width: GEO.W, height: GEO.H }, deviceScaleFactor: 1 });

/* ---------- 1. Nền ---------- */
await page.goto(`${URL_BASE}?mode=title&lang=vi`, { waitUntil: 'networkidle' });
await page.evaluate(() => { document.querySelector('.card').remove(); });
await page.waitForTimeout(250);
await page.screenshot({ path: join(OUT, 'bg.png') });
console.log('• bg.png');

/* ---------- 2. Lớp phủ từng cảnh ---------- */
for (const [story, count] of Object.entries(STORIES)) {
  for (const lang of LANGS) {
    for (let i = 0; i < count; i++) {
      await page.goto(`${URL_BASE}?mode=overlay&story=${story}&lang=${lang}&i=${i}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(OUT, `cap-${story}-${lang}-${i}.png`), omitBackground: true });
    }
    console.log(`• cap-${story}-${lang}-0..${count - 1}.png`);
  }
}

/* ---------- 3. Chuỗi khung hình cho các thẻ ---------- */
for (const story of Object.keys(STORIES)) {
  for (const lang of LANGS) {
    for (const name of CARD_MODES) {
      const dir = join(OUT, 'cards', `${story}-${lang}-${name}`);
      await mkdir(dir, { recursive: true });
      await page.goto(`${URL_BASE}?mode=${name}&story=${story}&lang=${lang}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(220);
      for (let f = 0; f < ANIM_FRAMES; f++) {
        await page.evaluate((v) => window.setProgress(v), Math.min(1, (f / FPS) / 1.15));
        await page.screenshot({ path: join(dir, `f${String(f).padStart(4, '0')}.png`) });
      }
    }
    console.log(`• cards/${story}-${lang}-{title,stats,cta}`);
  }
}

await browser.close();

/* ---------- 4. Khoét lỗ video trên các lớp phủ ---------- */
const py = `
from PIL import Image, ImageDraw
import os, json
OUT = ${JSON.stringify(OUT)}
GEO = ${JSON.stringify(GEO)}
STORIES = ${JSON.stringify(STORIES)}
bg = Image.open(os.path.join(OUT, "bg.png")).convert("RGBA")
hole = Image.new("L", bg.size, 255)
ImageDraw.Draw(hole).rounded_rectangle(
    [GEO["VX"], GEO["VY"], GEO["VX"] + GEO["VW"] - 1, GEO["VY"] + GEO["VH"] - 1],
    radius=GEO["RADIUS"], fill=0, corners=(False, False, True, True))
inv = Image.eval(hole, lambda v: 255 - v)
n = 0
for story, count in STORIES.items():
    for lang in ("vi", "en"):
        for i in range(count):
            src = os.path.join(OUT, f"cap-{story}-{lang}-{i}.png")
            cap = Image.open(src).convert("RGBA")
            base = bg.copy()
            base.putalpha(hole)                      # nền đã khoét lỗ
            out = Image.alpha_composite(base, cap)   # phụ đề + thanh cửa sổ nằm trên
            # trong vùng lỗ, alpha phải là alpha của riêng phụ đề (thường bằng 0)
            merged = Image.composite(cap.split()[3], out.split()[3], inv)
            out.putalpha(merged)
            out.save(os.path.join(OUT, f"ovl-{story}-{lang}-{i}.png"))
            os.remove(src)
            n += 1
print(f"• {n} tệp ovl-*.png")
`;
await writeFile(join(HERE, '_punch.py'), py);
execFileSync('python3', [join(HERE, '_punch.py')], { stdio: 'inherit' });
await rm(join(HERE, '_punch.py'));
console.log('\nXong tài sản trong video/assets/');
