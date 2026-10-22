/**
 * Ghép các câu lồng tiếng rời thành một dải tiếng đúng mốc thời gian của video.
 *
 *   node video/vo.mjs                → dựng cả 4 dải (2 chuyện × 2 ngôn ngữ)
 *   node video/vo.mjs escape vi      → chỉ một dải
 *
 * Đầu vào : video/audio/vo-src/<chuyện>-<ngôn ngữ>-<số thứ tự>.<đuôi bất kỳ>
 *           (wav · aiff · mp3 · m4a — ffmpeg đọc được là được)
 *           Số thứ tự 01, 02… theo đúng thứ tự câu trong video/vo-script.json.
 * Đầu ra  : video/audio/vo-<chuyện>-<ngôn ngữ>.wav
 *
 * Việc kịch bản nói dài hơn chỗ trống là chuyện bình thường khi đọc máy.
 * Script tự xử: cắt khoảng lặng đầu/cuối, rồi nếu vẫn dài thì nói nhanh lên
 * tối đa 1,15 lần (tai gần như không nhận ra). Quá mức đó thì báo để sửa chữ.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUD = join(ROOT, 'video/audio');
const SRC = join(AUD, 'vo-src');
const TMP = join(AUD, '_vo_tmp');

const MAX_TEMPO = 1.15;      // trần tăng tốc nghe vẫn tự nhiên
const HEADROOM = 0.06;       // chừa một nhịp thở giữa hai câu

const script = JSON.parse(readFileSync(join(ROOT, 'video/vo-script.json'), 'utf8'));
const ff = (a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
const dur = (f) => Number(execFileSync('ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());

if (!existsSync(SRC)) {
  console.log(`Chưa có thư mục ${SRC.replace(ROOT + '/', '')} — hãy tạo tiếng đọc trước (xem 3-Long-tieng.command).`);
  process.exit(0);
}

const args = process.argv.slice(2);
const stories = args.filter((a) => script[a]).length ? args.filter((a) => script[a]) : ['demo', 'escape'];
const langs = args.filter((a) => ['vi', 'en'].includes(a)).length ? args.filter((a) => ['vi', 'en'].includes(a)) : ['vi', 'en'];

let built = 0;
for (const story of stories) {
  for (const lang of langs) {
    const lines = script[story][lang];
    const total = script[story].bounds.at(-1);
    const files = lines.map((_, i) => {
      const pre = `${story}-${lang}-${String(i + 1).padStart(2, '0')}.`;
      const hit = readdirSync(SRC).find((f) => f.startsWith(pre));
      return hit ? join(SRC, hit) : null;
    });
    if (files.every((f) => !f)) continue;
    const missing = files.filter((f) => !f).length;
    if (missing) { console.log(`✗ ${story}/${lang}: thiếu ${missing}/${lines.length} câu — bỏ qua`); continue; }

    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });

    // Lượt 1 — cắt lặng đầu/cuối, chuẩn hoá về 48 kHz mono, đo lại độ dài thật
    const trimmed = files.map((f, i) => {
      const o = join(TMP, `t${i}.wav`);
      ff(['-i', f, '-af',
        'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono,' +
        'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.03:detection=peak,' +
        'areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.06:detection=peak,areverse,' +
        'highpass=f=85,dynaudnorm=f=180:g=9:p=0.62:m=6',
        '-ac', '1', '-ar', '48000', o]);
      return o;
    });

    // Lượt 2 — xếp chỗ. Câu nào tràn thì lần lượt: mượn chỗ của khoảng lặng phía
    // trước, đẩy câu sau lùi lại nếu câu sau còn dư, cuối cùng mới tăng tốc đọc.
    const nat = trimmed.map(dur);
    const start = lines.map((l) => l.start);
    const cap = lines.map((l, i) => Math.min(l.until, lines[i + 1] ? lines[i + 1].until : total));
    const slotOf = (i) => Math.min(cap[i], i + 1 < lines.length ? start[i + 1] : total) - start[i] - HEADROOM;

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < lines.length; i++) {
        let need = nat[i] - slotOf(i);
        if (need <= 0) continue;
        const prevEnd = i ? start[i - 1] + nat[i - 1] + HEADROOM : 0;
        const room = Math.min(need, Math.max(0, start[i] - prevEnd), 0.6);   // mượn phía trước
        if (room > 0.01) { start[i] -= room; need -= room; }
        if (need <= 0 || i + 1 >= lines.length) continue;
        const nextSlack = slotOf(i + 1) - nat[i + 1];                        // đẩy câu sau
        const push = Math.min(need, Math.max(0, nextSlack), 0.8);
        if (push > 0.01) start[i + 1] += push;
      }
    }

    const plan = lines.map((l, i) => {
      const slot = slotOf(i);
      const d = nat[i];
      const tempo = d > slot ? Math.min(MAX_TEMPO, d / Math.max(slot, 0.2)) : 1;
      const out = d / tempo;
      return { i, start: start[i], moved: start[i] - l.start, slot, d, tempo, out, over: out - slot, text: l.text };
    });

    const over = plan.filter((p) => p.over > 0.12);
    console.log(`\n▸ ${story} · ${lang} — ${lines.length} câu`);
    for (const p of plan) {
      const tag = p.over > 0.12 ? 'TRÀN' : p.tempo > 1.001 ? `×${p.tempo.toFixed(2)}` : 'ok';
      const mv = Math.abs(p.moved) > 0.02 ? ` ${p.moved > 0 ? '→' : '←'}${Math.abs(p.moved).toFixed(2)}s` : '';
      console.log(`   ${String(p.i + 1).padStart(2, '0')} ${p.start.toFixed(1).padStart(5)}s  ` +
        `${p.d.toFixed(2)}s→${p.out.toFixed(2)}s / chỗ ${p.slot.toFixed(2)}s  [${tag}]${mv}`);
    }
    if (over.length) {
      console.log(`   ⚠ ${over.length} câu vẫn dài hơn chỗ trống quá 0,12 giây — cân nhắc rút ngắn chữ` +
        ` trong video/vo-script.json rồi thu lại.`);
    }

    // Lượt 3 — dựng một lệnh ffmpeg: mỗi câu tăng tốc → đẩy lùi đúng mốc → trộn lại
    const ins = [];
    const chain = [];
    plan.forEach((p, k) => {
      ins.push('-i', trimmed[k]);
      const tempo = p.tempo > 1.001 ? `atempo=${p.tempo.toFixed(4)},` : '';
      chain.push(`[${k}:a]${tempo}adelay=${Math.round(p.start * 1000)}:all=1[v${k}]`);
    });
    const mix = plan.map((_, k) => `[v${k}]`).join('');
    const out = join(AUD, `vo-${story}-${lang}.wav`);
    ff([...ins, '-filter_complex',
      `${chain.join(';')};${mix}amix=inputs=${plan.length}:normalize=0:dropout_transition=0,` +
      `apad,atrim=0:${total},asetpts=N/SR/TB,aformat=channel_layouts=stereo[o]`,
      '-map', '[o]', '-ar', '48000', out]);
    console.log(`   ✓ ${out.replace(ROOT + '/', '')}  (${dur(out).toFixed(2)}s)`);
    built++;
  }
}
rmSync(TMP, { recursive: true, force: true });
console.log(built ? `\nXong ${built} dải tiếng. Chạy tiếp: node video/mux.mjs` : '\nKhông tìm thấy tệp tiếng nào trong video/audio/vo-src.');
