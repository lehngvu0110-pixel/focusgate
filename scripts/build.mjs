#!/usr/bin/env node
/** FocusGate — build: chép core vào extension + app desktop, rồi đóng gói. */
import { cp, rm, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = join(ROOT, 'packages/core/src');

async function syncCore() {
  for (const target of [
    join(ROOT, 'packages/extension/vendor/core'),
    join(ROOT, 'packages/desktop/vendor/core')
  ]) {
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    await cp(CORE, target, { recursive: true });
    console.log('• core →', target.replace(ROOT + '/', ''));
  }
}

async function syncStyles() {
  const src = join(ROOT, 'packages/extension/src/styles.css');
  const dst = join(ROOT, 'packages/desktop/renderer/styles.css');
  await cp(src, dst);
  console.log('• styles.css → packages/desktop/renderer/styles.css');
}

async function dirSize(dir) {
  let total = 0;
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    total += s.isDirectory() ? await dirSize(p) : s.size;
  }
  return total;
}

/** Nếu gói phát hành có thư mục extension/ ở gốc (để Chrome nạp thẳng), làm mới nó. */
async function syncRootExtension() {
  const root = join(ROOT, 'extension');
  if (!existsSync(root)) return;
  await rm(root, { recursive: true, force: true });
  await cp(join(ROOT, 'packages/extension'), root, { recursive: true });
  console.log('• packages/extension → extension/ (thư mục Chrome nạp)');
}

async function zipExtension() {
  const dist = join(ROOT, 'dist');
  await mkdir(dist, { recursive: true });
  const out = join(dist, 'focusgate-extension.zip');
  await rm(out, { force: true });
  execFileSync('zip', ['-r', '-q', out, '.', '-x', '*.DS_Store'], { cwd: join(ROOT, 'packages/extension') });
  const size = (await stat(out)).size;
  console.log(`• đóng gói → dist/focusgate-extension.zip (${(size / 1024).toFixed(0)} KB)`);
}

await syncCore();
await syncStyles();
await syncRootExtension();
console.log('• kích thước extension:', ((await dirSize(join(ROOT, 'packages/extension'))) / 1024).toFixed(0), 'KB');
if (!process.argv.includes('--no-zip') && existsSync('/usr/bin/zip')) await zipExtension();
console.log('Xong.');
