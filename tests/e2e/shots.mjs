import { launch } from './harness.mjs';
import { mkdir } from 'node:fs/promises';
const OUT = new URL('../../dist/shots', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const h = await launch();
await h.reset();

// dựng dữ liệu mẫu cho đẹp
const now = Date.now();
await h.call('addTask', { title: 'Hoàn thành báo cáo thí nghiệm Vật lý 1', note: 'Phần 3: xử lý số liệu + vẽ đồ thị sai số', enforce: true, dueAt: now + 3 * 3600e3, tabs: [{ url: 'https://overleaf.com/project/abc', title: 'Overleaf' }, { url: 'https://lms.hcmut.edu.vn/course/22', title: 'LMS' }] });
await h.call('addTask', { title: 'Ôn 30 từ vựng tiếng Anh', enforce: true, repeat: 'daily' });
await h.call('addTask', { title: 'Đọc 1 chương sách Giải tích', enforce: false, dueAt: now - 2 * 3600e3 });
await h.call('addTask', { title: 'Dọn bàn học', enforce: false });
const s = (await h.call('get')).state;
await h.call('completeTask', { id: s.tasks[3].id });
await h.setState({ stats: { streak: 12, bestStreak: 12, points: 430, lastSuccessDay: null,
  days: Object.fromEntries([...Array(14)].map((_, i) => {
    const d = new Date(now - i * 864e5);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return [k, { focusSec: [95,75,50,120,0,85,60,110,40,70,100,55,80,65][i] * 60, completed: (i%4)+1, created: 3, emergencies: 0 }];
  })) } });
await h.call('refresh');
await h.call('updateSettings', { patch: { schedules: [{ id: 'sc1', days: [1,2,3,4,5], start: '19:00', end: '22:00', enabled: true }] } });

async function shot(url, name, size, theme) {
  if (theme) await h.call('updateSettings', { patch: { theme } });
  const p = await h.context.newPage();
  await p.setViewportSize(size);
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1100);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: size.full !== false });
  await p.close();
  console.log('•', name);
}

await shot('http://facebook.com/feed', 'blocked-dark',  { width: 1000, height: 1120 }, 'dark');
await shot(h.url('src/dashboard.html#tasks'),    'dash-tasks',   { width: 1100, height: 1400 }, 'dark');
await shot(h.url('src/dashboard.html#stats'),    'dash-stats',   { width: 1100, height: 1000 }, 'dark');
await shot(h.url('src/dashboard.html#block'),    'dash-block',   { width: 1100, height: 1300 }, 'dark');
await shot(h.url('src/dashboard.html#settings'), 'dash-settings',{ width: 1100, height: 1400 }, 'dark');
await shot(h.url('src/popup.html'), 'popup', { width: 368, height: 560 }, 'dark');
await shot('http://tiktok.com/@abc', 'blocked-light', { width: 1000, height: 1120 }, 'light');
await shot(h.url('src/dashboard.html#tasks'), 'dash-tasks-light', { width: 1100, height: 1400 }, 'light');
await h.close();
