/** Khởi chạy Chromium có extension + máy chủ giả HTTPS, dùng riêng để quay video. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeWebTls } from './tls-server.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(ROOT, 'packages/extension');
const PORT = 8443;

export async function launchForVideo({ recordVideo, viewport, deviceScaleFactor = 1 }) {
  const server = await startFakeWebTls(PORT);
  const profile = await mkdtemp(join(tmpdir(), 'fg-video-'));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.FG_CHROME || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
    ignoreHTTPSErrors: true,
    recordVideo,
    viewport,
    deviceScaleFactor,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      `--host-resolver-rules=MAP * 127.0.0.1:${PORT}, EXCLUDE localhost, EXCLUDE 127.0.0.1`,
      '--ignore-certificate-errors',
      '--no-proxy-server',      // bỏ qua proxy của môi trường: HTTPS phải đi thẳng tới máy chủ giả
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=DialMediaRouteProvider'
    ]
  });

  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 20000 });
  const extId = new URL(sw.url()).host;

  const api = {
    context, server, profile, extId, sw,
    url: (p) => `chrome-extension://${extId}/${p}`,
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
    async setState(patch) {
      return sw.evaluate(async (p) => {
        const KEY = 'focusgate.state';
        const cur = (await chrome.storage.local.get(KEY))[KEY] || {};
        await chrome.storage.local.set({
          [KEY]: { ...cur, ...p, settings: { ...(cur.settings || {}), ...(p.settings || {}) } }
        });
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
  await api.call('refresh');
  return api;
}
