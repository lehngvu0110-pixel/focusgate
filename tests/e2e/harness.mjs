import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeWeb } from './server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const EXT = process.env.FG_EXT_DIR || join(ROOT, 'packages/extension');
const PORT = 8899;

export async function launch(opts = {}) {
  const server = await startFakeWeb(PORT);
  const profile = await mkdtemp(join(tmpdir(), 'fg-profile-'));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.FG_CHROME || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
    ...(opts.recordVideo ? { recordVideo: opts.recordVideo, viewport: opts.viewport } : {}),
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      `--host-resolver-rules=MAP * 127.0.0.1:${PORT}, EXCLUDE localhost, EXCLUDE 127.0.0.1`,
      '--no-first-run',
      '--no-default-browser-check',
      '--no-proxy-server',
      '--ignore-certificate-errors',
      '--disable-features=DialMediaRouteProvider'
    ]
  });

  // Chờ service worker của extension đăng ký để lấy id
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 20000 });
  const extId = new URL(sw.url()).host;

  const api = {
    context, server, profile, extId, sw,
    url: (p) => `chrome-extension://${extId}/${p}`,
    /** Gọi thẳng API của background bên trong service worker. */
    async call(type, payload = {}) {
      for (let i = 0; i < 80; i++) {
        const ready = await sw.evaluate(() => !!globalThis.__FG__).catch(() => false);
        if (ready) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      return sw.evaluate(async ([t, p]) => {
        const fn = globalThis.__FG__?.actions?.[t];
        if (!fn) throw new Error('Không có hành động: ' + t);
        return JSON.parse(JSON.stringify(await fn(p)));
      }, [type, payload]);
    },
    /** Ghi đè state trực tiếp (để dựng tình huống test nhanh). */
    async setState(patch) {
      return sw.evaluate(async (p) => {
        const KEY = 'focusgate.state';
        const cur = (await chrome.storage.local.get(KEY))[KEY] || {};
        await chrome.storage.local.set({ [KEY]: { ...cur, ...p, settings: { ...(cur.settings || {}), ...(p.settings || {}) } } });
      }, patch);
    },
    async reset() {
      await sw.evaluate(() => chrome.storage.local.remove('focusgate.state'));
      await api.call('refresh');
    },
    async close() {
      await context.close().catch(() => {});
      server.close();
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    }
  };
  await api.call('refresh'); // đảm bảo background đã khởi tạo & luật đã áp
  return api;
}

/** Chờ điều kiện, tránh sleep cứng. */
export async function until(fn, { timeout = 8000, interval = 120, label = 'điều kiện' } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e.message; }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Hết thời gian chờ ${label} (${timeout}ms). Giá trị cuối: ${JSON.stringify(last)}`);
}
