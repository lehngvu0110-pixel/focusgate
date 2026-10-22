/**
 * Quay một trang (Chromium hoặc cửa sổ Electron) bằng CDP Page.startScreencast.
 * Dùng thay recordVideo của Playwright: recordVideo quay ở độ phân giải CSS rồi đệm xám,
 * và với Electron bản mới thì làm cửa sổ không hiện ra. Screencast lấy đúng điểm ảnh thật,
 * ghi từng khung JPEG kèm mốc thời gian, rồi ffmpeg dựng lại thành video 30 fps đúng nhịp.
 */
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

export async function startScreencast(page, outFile, { width, height }) {
  const dir = join(dirname(outFile), '_' + basename(outFile) + '.frames');
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = []; let n = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const file = join(dir, String(n++).padStart(5, '0') + '.jpg');
    frames.push({ file, t: f.metadata.timestamp });
    await writeFile(file, Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  const wall0 = Date.now() / 1000;

  return async function stop() {
    const wallEnd = Date.now() / 1000;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    if (!frames.length) throw new Error('Screencast không nhận được khung hình nào');
    const list = [];
    frames.forEach((f, i) => {                     // mỗi khung giữ tới khi khung sau xuất hiện
      const next = i + 1 < frames.length ? frames[i + 1].t : wallEnd;
      list.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - (i === 0 ? wall0 : f.t)).toFixed(4)}`);
    });
    list.push(`file '${frames.at(-1).file}'`);
    const lf = join(dir, 'list.txt'); await writeFile(lf, list.join('\n'));
    const codec = outFile.endsWith('.webm')
      ? ['-c:v', 'libvpx-vp9', '-crf', '24', '-b:v', '0', '-row-mt', '1', '-deadline', 'good']
      : ['-c:v', 'libx264', '-crf', '14', '-preset', 'medium'];
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lf,
      '-vf', `fps=30,scale=${width}:${height}:flags=lanczos,format=yuv420p`, ...codec, outFile]);
    await rm(dir, { recursive: true, force: true });
    return frames.length;
  };
}
