#!/usr/bin/env node
/** Đóng gói FocusGate.app cho macOS (Apple Silicon). */
import { packager } from '@electron/packager';
import { rm, mkdir, cp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'dist/.stage-desktop');
const OUT = join(ROOT, 'dist/mac');
const DIST = process.env.ELECTRON_OVERRIDE_DIST_PATH;

if (process.platform !== 'darwin' && (!DIST || !existsSync(DIST))) {
  console.error('Trên máy không phải macOS, cần đặt ELECTRON_OVERRIDE_DIST_PATH trỏ tới bản Electron darwin-arm64.');
  process.exit(1);
}

await rm(STAGE, { recursive: true, force: true });
await rm(OUT, { recursive: true, force: true });
await mkdir(STAGE, { recursive: true });

for (const item of ['main.js', 'preload.cjs', 'src', 'renderer', 'vendor', 'assets']) {
  await cp(join(ROOT, 'packages/desktop', item), join(STAGE, item), { recursive: true });
}
await writeFile(join(STAGE, 'package.json'), JSON.stringify({
  name: 'focusgate',
  productName: 'FocusGate',
  version: '1.0.0',
  description: 'Xong việc rồi hẵng lướt — nhắc việc khi bật máy và khoá thứ gây xao nhãng.',
  main: 'main.js',
  type: 'module',
  author: 'FocusGate'
}, null, 2));

const paths = await packager({
  dir: STAGE,
  out: OUT,
  platform: 'darwin',
  arch: process.arch === 'x64' && process.platform === 'darwin' ? 'x64' : 'arm64',
  appBundleId: 'com.focusgate.app',
  appCategoryType: 'public.app-category.productivity',
  icon: join(ROOT, 'packages/desktop/assets/icon.icns'),
  name: 'FocusGate',
  appVersion: '1.0.0',
  overwrite: true,
  prune: false,
  darwinDarkModeSupport: true,
  extendInfo: {
    LSUIElement: true,                       // sống ở thanh menu, không hiện trong Dock
    NSHumanReadableCopyright: 'FocusGate',
    LSMinimumSystemVersion: '11.0'
  }
});

console.log('• đã tạo', paths.join(', '));
const app = join(paths[0], 'FocusGate.app');
execFileSync('zip', ['-r', '-q', '-y', join(ROOT, 'dist/FocusGate-macOS-arm64.app.zip'), 'FocusGate.app'], { cwd: paths[0] });
console.log('• dist/FocusGate-macOS-arm64.app.zip');
await rm(STAGE, { recursive: true, force: true });
