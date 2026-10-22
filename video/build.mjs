/**
 * Ghép video dọc 1080×1920 @30fps từ footage thật + thẻ chữ.
 *
 *   node video/build.mjs            → dựng cả hai chuyện, cả hai ngôn ngữ
 *   node video/build.mjs escape     → chỉ dựng chuyện "lối thoát khẩn cấp"
 *
 * `speed` trong TIMELINE là hệ số tăng tốc: `dur` là độ dài trên video,
 * còn lượng footage tiêu thụ là dur × speed.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HERE = join(ROOT, 'video');
const CLIPS = join(HERE, 'clips');
const ASSETS = join(HERE, 'assets');
const TMP = join(HERE, '_seg');
const OUT = join(ROOT, 'dist/video');

const FPS = 30;
const GEO = { W: 1080, H: 1920, VX: 90, VY: 500, VW: 900, VH: 1120 };
const ANIM = 38 / FPS;                    // độ dài phần hoạt ảnh của mỗi thẻ

const STORIES = {
  /* ---- Chuyện 1: demo sản phẩm (≈59 giây) ---- */
  demo: {
    out: 'focusgate-tiktok',
    timeline: [
      { kind: 'card', name: 'title', dur: 4.0 },
      { kind: 'clip', file: 'a-ghi-viec.webm', ss: 0.8, dur: 10.0, ovl: 0, speed: 1.3 },
      { kind: 'clip', file: 'b-bi-chan.webm',  ss: 0.1, dur: 8.5,  ovl: 1 },
      { kind: 'clip', file: 'c-mo-cong.webm',  ss: 0.0, dur: 8.8,  ovl: 2 },
      { kind: 'clip', file: 'd-popup.webm',    ss: 0.0, dur: 5.8,  ovl: 3 },
      { kind: 'clip', file: 'e-desktop.webm',  ss: 0.0, dur: 8.0,  ovl: 4 },
      { kind: 'card', name: 'stats', dur: 6.8 },
      { kind: 'card', name: 'cta',   dur: 7.1 }
    ]
  },

  /* ---- Chuyện 2: lối thoát khẩn cấp (≈59 giây) ----
     Các mốc ss lấy từ clips/escape-marks.json do capture-escape.mjs ghi lại:
     blocked 2.0 · panelOpen 6.8 · pasteBlocked 9.3 · typed 22.1
     ready 34.9 · unlocked 38.8 · relocked 42.7 · hết clip 43.2            */
  escape: {
    out: 'focusgate-tiktok-loi-thoat',
    timeline: [
      { kind: 'card', name: 'title', dur: 5.0 },
      { kind: 'clip', file: 'f-loi-thoat.webm',      ss: 0.4,  dur: 6.4,  ovl: 0, crop: '640:800:0:0' },
      { kind: 'clip', file: 'f-loi-thoat.webm',      ss: 7.0,  dur: 3.6,  ovl: 1, crop: '640:800:0:0' },
      { kind: 'clip', file: 'f-loi-thoat.webm',      ss: 10.8, dur: 10.0, ovl: 2, speed: 1.1, crop: '640:800:0:0' },
      { kind: 'clip', file: 'f-loi-thoat.webm',      ss: 22.1, dur: 5.6,  ovl: 3, speed: 2.25, crop: '640:800:0:0' },
      { kind: 'clip', file: 'f-loi-thoat.webm',      ss: 33.9, dur: 4.9,  ovl: 4, crop: '640:800:0:0' },
      { kind: 'clip', file: 'f-loi-thoat.webm',      ss: 38.6, dur: 4.3,  ovl: 5, crop: '640:800:0:0' },
      { kind: 'clip', file: 'g-cung-tuyet-doi.webm', ss: 1.2,  dur: 6.2,  ovl: 6, crop: '640:800:0:0' },
      { kind: 'card', name: 'stats', dur: 7.2 },
      { kind: 'card', name: 'cta',   dur: 6.2 }
    ]
  }
};

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
  '-profile:v', 'high', '-level', '4.0', '-g', String(FPS * 2), '-r', String(FPS)];

const wanted = process.argv.slice(2).filter((a) => STORIES[a]);
const list = wanted.length ? wanted : Object.keys(STORIES);

await rm(TMP, { recursive: true, force: true });
await mkdir(TMP, { recursive: true });
await mkdir(OUT, { recursive: true });

for (const story of list) {
  const { out: base, timeline } = STORIES[story];
  const total = timeline.reduce((a, t) => a + t.dur, 0);
  console.log(`\n▸ ${story} — ${timeline.length} đoạn, ${total.toFixed(1)} giây`);

  for (const lang of ['vi', 'en']) {
    const segs = [];

    timeline.forEach((t, i) => {
      const seg = join(TMP, `${story}-${lang}-${String(i).padStart(2, '0')}.mp4`);
      segs.push(seg);

      if (t.kind === 'card') {
        const hold = Math.max(0, t.dur - ANIM).toFixed(3);
        // đoạn đầu không mờ dần: khung hình đầu chính là ảnh bìa mặc định trên TikTok
        const fade = i === 0 ? '' : ',fade=t=in:st=0:d=0.18';
        ff([
          '-framerate', String(FPS),
          '-i', join(ASSETS, 'cards', `${story}-${lang}-${t.name}`, 'f%04d.png'),
          '-vf', `tpad=stop_mode=clone:stop_duration=${hold},trim=duration=${t.dur},setpts=PTS-STARTPTS${fade},format=yuv420p`,
          ...X264, seg
        ]);
      } else {
        const clip = join(CLIPS, t.file);
        if (!existsSync(clip)) throw new Error('Thiếu clip: ' + clip);
        const srcDur = (t.dur * (t.speed || 1)).toFixed(3);
        const rate = t.speed ? `,setpts=PTS/${t.speed}` : '';
        // một số clip được ghi ở khung hẹp nên video có viền đệm xám — cắt đúng vùng nội dung
        const crop = t.crop ? `,crop=${t.crop}` : '';
        ff([
          '-ss', String(t.ss), '-t', srcDur, '-i', clip,
          '-loop', '1', '-i', join(ASSETS, `ovl-${story}-${lang}-${t.ovl}.png`),
          '-filter_complex',
          `color=c=0x08080C:s=${GEO.W}x${GEO.H}:r=${FPS}:d=${t.dur}[bgc];` +
          `[0:v]fps=${FPS},setpts=PTS-STARTPTS${rate}${crop},scale=${GEO.VW}:${GEO.VH}:flags=lanczos,format=rgba[v];` +
          `[bgc][v]overlay=${GEO.VX}:${GEO.VY}:shortest=1[a];` +
          `[a][1:v]overlay=0:0:shortest=1,trim=duration=${t.dur},setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.14,format=yuv420p[o]`,
          '-map', '[o]', ...X264, seg
        ]);
      }
    });

    // nối các đoạn + gắn một rãnh tiếng im lặng cho tương thích nền tảng
    const listFile = join(TMP, `${story}-${lang}.txt`);
    execFileSync('bash', ['-c', `printf '%s\\n' ${segs.map((s) => `"file '${s}'"`).join(' ')} > "${listFile}"`]);
    const final = join(OUT, `${base}-${lang}.mp4`);
    ff([
      '-f', 'concat', '-safe', '0', '-i', listFile,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-map', '0:v', '-map', '1:a', '-shortest',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
      final
    ]);
    // ảnh bìa = khung hình đầu
    ff(['-i', final, '-vframes', '1', join(OUT, `${base}-${lang}-cover.png`)]);
    console.log(`  ✓ ${base}-${lang}.mp4`);
  }
}

await rm(TMP, { recursive: true, force: true });
