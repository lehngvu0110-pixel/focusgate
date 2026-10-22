/**
 * Ghép âm thanh vào các tệp MP4 đã dựng xong.
 *
 *   node video/mux.mjs               → ghép cả 4 video
 *   node video/mux.mjs escape vi     → chỉ một tệp
 *
 * Nguồn âm thanh, theo thứ tự ưu tiên:
 *   video/audio/vo-<chuyện>-<ngôn ngữ>.wav   giọng đọc (nếu có)
 *   video/audio/mix-<chuyện>.wav             nhạc nền + hiệu ứng (luôn có)
 *
 * Khi có giọng đọc, nhạc nền tự động nhỏ lại mỗi lúc người đọc cất tiếng
 * (sidechaincompress), nên lời thoại luôn nổi lên trên.
 * Âm lượng cuối chuẩn hoá về -15 LUFS rồi hạ trần đỉnh xuống -2,5 dBFS —
 * chừa chỗ cho phần vống lên khi mã hoá AAC, tránh vỡ tiếng trên loa điện thoại.
 * (alimiter phải ghi level=0 — ffmpeg 4.x bỏ qua level=disabled rồi tự kéo biên độ
 *  ngược lên đúng trần, làm đỉnh thực vọt lên trên 0 dBFS. Bộ mã hoá AAC của
 *  ffmpeg 4.x còn vống thêm ~2 dB ở 192 kbps, nên đặt 256 kbps cho chắc.)
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUD = join(ROOT, 'video/audio');
// Kho video: thư mục dựng của mã nguồn, hoặc thư mục video trong gói phát hành.
const OUT = [join(ROOT, 'dist/video'), join(ROOT, 'video-tiktok')].find(existsSync) || join(ROOT, 'dist/video');

/** Nhạc nền: bản WAV nếu có (dựng từ video/audio.py), không thì bản m4a kèm theo gói. */
const musicFor = (story) =>
  [join(AUD, `mix-${story}.wav`), join(AUD, `mix-${story}.m4a`)].find(existsSync);

const STORIES = { demo: 'focusgate-tiktok', escape: 'focusgate-tiktok-loi-thoat' };
const LANGS = ['vi', 'en'];
const I_LUFS = -15, TP = -1.5, LRA = 11;

const ff = (args, capture = false) => {
  const a = ['-hide_banner', '-loglevel', capture ? 'info' : 'error', '-y', ...args];
  return capture
    ? execFileSync('ffmpeg', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    : execFileSync('ffmpeg', a, { stdio: 'inherit' });
};

/** Đo loudness lượt 1 để lượt 2 chuẩn hoá chính xác thay vì ước lượng. */
function measure(inputs, chain) {
  // loudnorm in JSON ra stderr, nên phải dùng spawnSync để bắt được
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...inputs, '-vn',
    '-filter_complex', `${chain};[pre]loudnorm=I=${I_LUFS}:TP=${TP}:LRA=${LRA}:print_format=json[m]`,
    '-map', '[m]', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 32 << 20 });
  const txt = String(r.stderr || '') + String(r.stdout || '');
  const m = txt.match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
  if (!m) throw new Error('Không đọc được kết quả đo loudness:\n' + txt.slice(-900));
  return JSON.parse(m[0]);
}

const args = process.argv.slice(2);
const stories = args.filter((a) => STORIES[a]);
const langs = args.filter((a) => LANGS.includes(a));
const doStories = stories.length ? stories : Object.keys(STORIES);
const doLangs = langs.length ? langs : LANGS;

mkdirSync(OUT, { recursive: true });

for (const story of doStories) {
  for (const lang of doLangs) {
    const base = `${STORIES[story]}-${lang}`;
    const out = join(OUT, `${base}-co-tieng.mp4`);
    // Nguồn hình: bản im lặng nếu còn, không thì chính bản có tiếng (chỉ chép luồng
    // hình nên tiếng cũ bị bỏ đi) — cách này để gói phát hành không cần chứa cả hai.
    const video = [join(OUT, `${base}.mp4`), out].find(existsSync);
    const music = musicFor(story);
    const vo = join(AUD, `vo-${story}-${lang}.wav`);
    if (!video) { console.log(`· bỏ qua ${base} (không tìm thấy video trong ${OUT})`); continue; }
    if (!music) throw new Error(`Thiếu nhạc nền: ${AUD}/mix-${story}.wav (hoặc .m4a)`);

    const hasVo = existsSync(vo);
    const inputs = ['-i', video, '-i', music, ...(hasVo ? ['-i', vo] : [])];
    // [1] nhạc+hiệu ứng, [2] giọng đọc. Có giọng thì nén né 8 dB khi có lời.
    const chain = hasVo
      ? '[2:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,' +
        'highpass=f=85,acompressor=threshold=-18dB:ratio=3:attack=8:release=180,volume=1.9,' +
        'asplit=2[voA][voB];' +
        '[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[bg];' +
        '[bg][voA]sidechaincompress=threshold=0.045:ratio=9:attack=14:release=330:makeup=1[duck];' +
        '[duck][voB]amix=inputs=2:normalize=0:duration=first,' +
        'alimiter=limit=0.94:level=0[pre]'
      : '[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,' +
        'acompressor=threshold=-21dB:ratio=2.6:attack=6:release=200:makeup=3,' +
        'alimiter=limit=0.94:level=0[pre]';

    const probe = measure(inputs, chain);
    const ln = `loudnorm=I=${I_LUFS}:TP=${TP}:LRA=${LRA}:measured_I=${probe.input_i}:` +
      `measured_TP=${probe.input_tp}:measured_LRA=${probe.input_lra}:measured_thresh=${probe.input_thresh}:` +
      `offset=${probe.target_offset}:linear=true`;

    const dst = video === out ? out + '.tmp.mp4' : out;
    ff([...inputs, '-filter_complex', `${chain};[pre]${ln},alimiter=limit=0.68:level=0,aresample=48000[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
      '-shortest', '-movflags', '+faststart', dst]);
    if (dst !== out) renameSync(dst, out);
    console.log(`  ✓ ${base}-co-tieng.mp4${hasVo ? '  (có giọng đọc)' : '  (nhạc nền + hiệu ứng)'}`);
  }
}
