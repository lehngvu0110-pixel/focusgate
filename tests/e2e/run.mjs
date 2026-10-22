/**
 * FocusGate — kiểm thử đầu-cuối trên Chromium thật.
 * Mọi tên miền được ánh xạ về máy chủ giả nội bộ, nên không cần Internet.
 */
import { launch, until } from './harness.mjs';

let h;
const results = [];
let currentErrors = [];

const BLOCKED = /\/src\/blocked\.html/;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}\n   nhận: ${JSON.stringify(a)}\n   mong: ${JSON.stringify(b)}`); }

async function test(name, fn) {
  const t0 = Date.now();
  currentErrors = [];
  try {
    await h.reset();
    await fn();
    if (currentErrors.length) throw new Error('Có lỗi JS trên trang: ' + currentErrors.join(' | '));
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name}  ${Date.now() - t0}ms`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: e.message });
    console.log(`  ✗ ${name}\n    ${String(e.message).split('\n').join('\n    ')}`);
  }
}

async function newPage() {
  const p = await h.context.newPage();
  p.on('pageerror', (e) => currentErrors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_/.test(m.text())) currentErrors.push('console: ' + m.text()); });
  return p;
}

const addTask = (t) => h.call('addTask', { enforce: true, ...t });
const gate = async () => (await h.call('get')).gate;

/* ================================================================== */
async function main() {
  h = await launch();
  console.log(`\nFocusGate E2E — extension id ${h.extId}\n`);

  /* ---------- Chặn cơ bản ---------- */
  console.log('▸ Chặn cơ bản');

  await test('Cổng mở khi không có việc — mọi trang vào được', async () => {
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    eq(await p.locator('#site').textContent(), 'facebook.com', 'Phải vào được facebook khi không có việc');
    await p.close();
  });

  await test('Có việc bắt buộc — facebook bị chuyển sang trang chặn', async () => {
    await addTask({ title: 'Làm bài tập Giải tích' });
    assert((await gate()).active, 'Cổng phải khoá sau khi thêm việc bắt buộc');
    const p = await newPage();
    await p.goto('http://facebook.com/feed', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    eq(await p.locator('#attemptUrl').textContent(), 'facebook.com', 'Trang chặn phải cho biết đã định mở gì');
    assert((await p.locator('#headline').textContent()).includes('1 việc'), 'Tiêu đề phải nói còn 1 việc');
    await p.getByText('Làm bài tập Giải tích').first().waitFor({ state: 'visible', timeout: 8000 });
    await p.close();
  });

  await test('Subdomain cũng bị chặn (m.facebook.com)', async () => {
    await addTask({ title: 'Việc A' });
    const p = await newPage();
    await p.goto('http://m.facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.close();
  });

  await test('Trang trong danh sách trắng vẫn vào được khi đang khoá', async () => {
    await addTask({ title: 'Việc A' });
    for (const url of ['http://google.com/search?q=abc', 'http://lms.hcmut.edu.vn/course/1', 'http://stackoverflow.com/q/1']) {
      const p = await newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded' });
      assert(!BLOCKED.test(p.url()), url + ' phải vào được (danh sách trắng)');
      await p.close();
    }
  });

  await test('Tab công việc gắn vào việc luôn vào được', async () => {
    await addTask({ title: 'Thiết kế poster', tabs: [{ url: 'http://figma.com/file/abc', title: 'Figma' }] });
    const p = await newPage();
    await p.goto('http://figma.com/file/abc', { waitUntil: 'domcontentloaded' });
    eq(await p.locator('#site').textContent(), 'figma.com', 'Tab công việc phải vào được');
    const q = await newPage();
    await q.goto('http://tiktok.com/', { waitUntil: 'domcontentloaded' });
    await q.waitForURL(BLOCKED, { timeout: 8000 });
    await p.close(); await q.close();
  });

  await test('Tab đang mở sẵn bị kéo về trang chặn khi cổng bật', async () => {
    const p = await newPage();
    await p.goto('http://youtube.com/watch?v=1', { waitUntil: 'domcontentloaded' });
    eq(await p.locator('#site').textContent(), 'youtube.com', 'Ban đầu phải vào được');
    await addTask({ title: 'Ôn thi giữa kỳ' });
    await p.waitForURL(BLOCKED, { timeout: 10000 });
    await p.close();
  });

  await test('Bấm link sang trang cấm cũng bị chặn', async () => {
    await addTask({ title: 'Việc A', tabs: [{ url: 'http://figma.com/x' }] });
    const p = await newPage();
    await p.goto('http://figma.com/x', { waitUntil: 'domcontentloaded' });
    await p.locator('#go-tiktok').click();
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.close();
  });

  /* ---------- Mở khoá ---------- */
  console.log('\n▸ Hoàn thành việc & mở khoá');

  await test('Tick hoàn thành trên trang chặn → cổng mở và quay lại trang cũ', async () => {
    await addTask({ title: 'Nộp báo cáo thí nghiệm' });
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.locator('.check').first().click();
    await p.waitForURL(/facebook\.com/, { timeout: 12000 });
    eq(await p.locator('#site').textContent(), 'facebook.com', 'Phải tự quay lại trang ban đầu');
    assert(!(await gate()).active, 'Cổng phải mở sau khi xong hết việc');
    await p.close();
  });

  await test('Còn việc khác thì vẫn khoá', async () => {
    await addTask({ title: 'Việc 1' });
    await addTask({ title: 'Việc 2' });
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.locator('.check').first().click();
    await until(async () => (await p.locator('#headline').textContent()).includes('1 việc'), { label: 'còn 1 việc' });
    assert((await gate()).active, 'Vẫn phải khoá khi còn việc');
    await p.close();
  });

  await test('Thêm việc ngay trên trang chặn', async () => {
    await addTask({ title: 'Việc gốc' });
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.locator('#quickTitle').fill('Việc thêm từ màn hình chặn');
    await p.locator('#quickAdd').click();
    await until(async () => (await p.locator('#headline').textContent()).includes('2 việc'), { label: 'thành 2 việc' });
    await p.close();
  });

  /* ---------- Lối thoát khẩn cấp ---------- */
  console.log('\n▸ Lối thoát khẩn cấp');

  await test('Mặc định: phải chờ đếm ngược, nút bị khoá', async () => {
    await addTask({ title: 'Việc A' });
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.locator('#escape summary').click();
    await p.waitForSelector('#escapeConfirm');
    assert(await p.locator('#escapeConfirm').isDisabled(), 'Nút phải bị khoá lúc mới mở');
    assert(/Chờ \d+ giây/.test(await p.locator('#escapeConfirm').textContent()), 'Phải hiển thị đếm ngược');
    await p.close();
  });

  await test('Gõ sai câu cam kết thì không mở được', async () => {
    await h.setState({ settings: { emergency: { enabled: true, cooldownSec: 1, unlockMinutes: 10, maxPerDay: 2, minPhraseChars: 100 } } });
    await h.call('refresh');
    await addTask({ title: 'Việc A' });
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.locator('#escape summary').click();
    await p.locator('#typed').fill('tôi muốn thoát');
    await new Promise((r) => setTimeout(r, 1600));
    assert(await p.locator('#escapeConfirm').isDisabled(), 'Gõ sai thì nút vẫn phải khoá');
    await p.close();
  });

  await test('Gõ đúng + hết đếm ngược → mở tạm, mất streak, trừ điểm', async () => {
    await h.setState({
      settings: { emergency: { enabled: true, cooldownSec: 1, unlockMinutes: 10, maxPerDay: 2, minPhraseChars: 100 } },
      stats: { streak: 7, bestStreak: 9, points: 200, lastSuccessDay: null, days: {} }
    });
    await h.call('refresh');
    await addTask({ title: 'Việc A' });
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.locator('#escape summary').click();
    const phrase = await p.locator('#phraseBox').textContent();
    assert(phrase.length >= 100, 'Câu cam kết phải dài (ma sát thật)');
    await p.locator('#typed').fill(phrase);
    await until(async () => !(await p.locator('#escapeConfirm').isDisabled()), { label: 'nút mở khoá bật', timeout: 6000 });
    await p.locator('#escapeConfirm').click();
    await until(async () => !!(await gate()).unlockedUntil, { label: 'cổng mở tạm' });

    const s = (await h.call('get')).state;
    eq(s.stats.streak, 0, 'Streak phải về 0');
    eq(s.stats.points, 150, 'Phải bị trừ 50 điểm');

    const q = await newPage();
    await q.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    eq(await q.locator('#site').textContent(), 'facebook.com', 'Trong cửa sổ mở tạm phải vào được');
    await q.close(); await p.close();
  });

  await test('Nút "Tôi quay lại làm việc" khoá cổng lại ngay', async () => {
    await h.setState({ settings: { emergency: { enabled: true, cooldownSec: 0, unlockMinutes: 10, maxPerDay: 2 } } });
    await h.call('refresh');
    await addTask({ title: 'Việc A' });
    const info = await h.call('emergencyInfo');
    await h.call('emergencyUnlock', { typed: info.phrase });
    assert(!!(await gate()).unlockedUntil, 'Đang mở tạm');
    const p = await newPage();
    await p.goto(h.url('src/blocked.html'), { waitUntil: 'domcontentloaded' });
    await p.getByText('Tôi quay lại làm việc').click();
    await until(async () => (await gate()).active, { label: 'khoá lại' });
    const q = await newPage();
    await q.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await q.waitForURL(BLOCKED, { timeout: 8000 });
    await q.close(); await p.close();
  });

  await test('Hết lượt trong ngày thì không cho thoát nữa', async () => {
    await h.setState({ settings: { emergency: { enabled: true, cooldownSec: 0, unlockMinutes: 1, maxPerDay: 1 } } });
    await h.call('refresh');
    await addTask({ title: 'Việc A' });
    const info = await h.call('emergencyInfo');
    const r1 = await h.call('emergencyUnlock', { typed: info.phrase });
    eq(r1.ok, true, 'Lượt đầu phải thành công');
    await h.call('cancelUnlock');
    const r2 = await h.call('emergencyUnlock', { typed: info.phrase });
    eq(r2.ok, false, 'Lượt thứ hai phải bị từ chối');
    assert(/hết/i.test(r2.error), 'Phải báo đã hết lượt: ' + r2.error);
  });

  await test('Chế độ cứng tuyệt đối: không có lối thoát', async () => {
    await h.setState({ settings: { emergency: { enabled: false, cooldownSec: 0, unlockMinutes: 10, maxPerDay: 2 } } });
    await h.call('refresh');
    await addTask({ title: 'Việc A' });
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.locator('#escape summary').click();
    await until(async () => (await p.locator('#escapeBody').textContent()).includes('Không dùng được'), { label: 'thông báo chặn lối thoát' });
    assert(await p.locator('#escapeConfirm').count() === 0, 'Không được có nút mở khoá');
    await p.close();
  });

  /* ---------- Chế độ & lịch ---------- */
  console.log('\n▸ Chế độ chặn, lịch, hẹn giờ');

  await test('Chế độ danh sách đen: chỉ chặn trang giải trí', async () => {
    await h.setState({ settings: { mode: 'blocklist' } });
    await h.call('refresh');
    await addTask({ title: 'Việc A' });
    const ok = await newPage();
    await ok.goto('http://vnexpress-khac.net/', { waitUntil: 'domcontentloaded' });
    assert(!BLOCKED.test(ok.url()), 'Trang không nằm trong danh sách đen phải vào được');
    const bad = await newPage();
    await bad.goto('http://tiktok.com/@abc', { waitUntil: 'domcontentloaded' });
    await bad.waitForURL(BLOCKED, { timeout: 8000 });
    await ok.close(); await bad.close();
  });

  await test('Khung giờ tập trung khoá cổng dù không có việc nào', async () => {
    const now = new Date();
    const hh = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const start = new Date(now.getTime() - 30 * 60000);
    const end = new Date(now.getTime() + 60 * 60000);
    await h.call('updateSettings', {
      patch: { schedules: [{ id: 'sc1', days: [0, 1, 2, 3, 4, 5, 6], start: hh(start), end: hh(end), enabled: true }] }
    });
    const g = await gate();
    assert(g.active, 'Khung giờ phải khoá cổng');
    eq(g.tasks.length, 0, 'Không có việc nào nhưng vẫn khoá');
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await p.close();
  });

  await test('Việc hẹn giờ tương lai chưa khoá; quá hạn thì khoá', async () => {
    await h.call('addTask', { title: 'Việc tương lai', enforce: true, remindAt: Date.now() + 3600_000 });
    assert(!(await gate()).active, 'Chưa tới giờ thì chưa khoá');
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    assert(!BLOCKED.test(p.url()), 'Chưa tới giờ nên vào được');
    await p.close();

    await h.call('addTask', { title: 'Việc quá hạn', enforce: false, dueAt: Date.now() - 60_000 });
    assert((await gate()).active, 'Việc quá hạn phải tự khoá cổng');
  });

  await test('Phiên Pomodoro khoá cổng, dừng phiên thì mở', async () => {
    await h.call('startSession', { phase: 'focus' });
    assert((await gate()).active, 'Đang chạy phiên thì phải khoá');
    const p = await newPage();
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    await p.waitForURL(BLOCKED, { timeout: 8000 });
    await h.call('stopSession');
    await until(async () => !(await gate()).active, { label: 'cổng mở lại' });
    await p.goto('http://facebook.com/', { waitUntil: 'domcontentloaded' });
    assert(!BLOCKED.test(p.url()), 'Dừng phiên thì vào được');
    await p.close();
  });

  /* ---------- Giao diện ---------- */
  console.log('\n▸ Giao diện');

  await test('Dashboard: thêm việc qua form → cổng khoá ngay', async () => {
    const p = await newPage();
    await p.goto(h.url('src/dashboard.html'), { waitUntil: 'domcontentloaded' });
    await p.locator('#tTitle').fill('Ôn tập Đại số tuyến tính');
    await p.locator('#tAdd').click();
    await until(async () => (await gate()).active, { label: 'cổng khoá' });
    await p.getByText('Ôn tập Đại số tuyến tính').first().waitFor({ state: 'visible', timeout: 8000 });
    assert((await p.locator('#statusPill').textContent()).includes('Đang khoá'), 'Huy hiệu phải báo đang khoá');
    await p.close();
  });

  await test('Dashboard: thêm domain vào danh sách trắng có hiệu lực ngay', async () => {
    await addTask({ title: 'Việc A' });
    const p = await newPage();
    await p.goto(h.url('src/dashboard.html'), { waitUntil: 'domcontentloaded' });
    await p.locator('.tabs button[data-tab="block"]').click();
    await p.locator('#allowInput').fill('vidu-hoctap.com');
    await p.locator('#allowAdd').click();
    await until(async () => (await p.locator('#allowList').textContent()).includes('vidu-hoctap.com'), { label: 'domain xuất hiện' });
    const q = await newPage();
    await q.goto('http://vidu-hoctap.com/bai-1', { waitUntil: 'domcontentloaded' });
    assert(!BLOCKED.test(q.url()), 'Domain vừa thêm phải vào được ngay');
    await q.close(); await p.close();
  });

  await test('Dashboard: 4 tab đều hiển thị, biểu đồ và thống kê vẽ được', async () => {
    await addTask({ title: 'Việc A' });
    const p = await newPage();
    await p.goto(h.url('src/dashboard.html'), { waitUntil: 'domcontentloaded' });
    for (const tab of ['tasks', 'block', 'stats', 'settings']) {
      await p.locator(`.tabs button[data-tab="${tab}"]`).click();
      await p.locator(`#panel-${tab}`).waitFor({ state: 'visible', timeout: 5000 });
    }
    await p.locator('.tabs button[data-tab="stats"]').click();
    eq(await p.locator('.chart-col').count(), 14, 'Biểu đồ phải có 14 cột');
    assert(await p.locator('.stat').count() >= 6, 'Phải có đủ ô thống kê');
    await p.close();
  });

  await test('Dashboard: xoá việc cần xác nhận hai lần', async () => {
    await addTask({ title: 'Việc sẽ xoá' });
    const p = await newPage();
    await p.goto(h.url('src/dashboard.html'), { waitUntil: 'domcontentloaded' });
    const del = p.locator('#pendingList .task').first().locator('button[title="Xoá việc"]');
    await del.click();
    await until(async () => (await del.textContent()).includes('Chắc chưa'), { label: 'nút chuyển sang xác nhận' });
    eq((await h.call('get')).state.tasks.length, 1, 'Bấm một lần chưa được xoá');
    await del.click();
    await until(async () => (await h.call('get')).state.tasks.length === 0, { label: 'việc bị xoá' });
    await p.close();
  });

  await test('Popup hoạt động: hiện trạng thái và tick xong việc', async () => {
    await addTask({ title: 'Việc trong popup' });
    const p = await newPage();
    await p.goto(h.url('src/popup.html'), { waitUntil: 'domcontentloaded' });
    await until(async () => (await p.locator('#banner').textContent()).includes('bắt buộc'), { label: 'banner khoá' });
    await p.getByText('Việc trong popup').first().waitFor({ state: 'visible', timeout: 8000 });
    await p.locator('.check').first().click();
    await until(async () => !(await gate()).active, { label: 'cổng mở sau khi tick' });
    await p.close();
  });

  await test('Đổi chế độ chặn từ dashboard được lưu lại', async () => {
    const p = await newPage();
    await p.goto(h.url('src/dashboard.html'), { waitUntil: 'domcontentloaded' });
    await p.locator('.tabs button[data-tab="block"]').click();
    await p.locator('#modeBlock').check();
    await until(async () => (await h.call('get')).state.settings.mode === 'blocklist', { label: 'chế độ đã đổi' });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.locator('.tabs button[data-tab="block"]').click();
    assert(await p.locator('#modeBlock').isChecked(), 'Sau khi tải lại vẫn phải nhớ chế độ');
    await p.close();
  });

  await test('Xuất / nhập dữ liệu giữ nguyên việc và cài đặt', async () => {
    await addTask({ title: 'Việc cần sao lưu' });
    const { json } = await h.call('exportState');
    await h.call('resetAll');
    eq((await h.call('get')).state.tasks.length, 0, 'Sau khi xoá phải trống');
    const r = await h.call('importState', { json });
    eq(r.ok, true, 'Nhập phải thành công');
    eq((await h.call('get')).state.tasks[0].title, 'Việc cần sao lưu', 'Việc phải quay lại');
    const bad = await h.call('importState', { json: '{{{' });
    eq(bad.ok, false, 'JSON hỏng phải bị từ chối');
  });

  /* ---------- Bền bỉ ---------- */
  console.log('\n▸ Độ bền');

  await test('Dữ liệu nằm trong chrome.storage, không phụ thuộc bộ nhớ tạm', async () => {
    await addTask({ title: 'Việc bền bỉ' });
    // đọc thẳng từ storage, không qua lớp trung gian nào
    const raw = await h.sw.evaluate(() => chrome.storage.local.get('focusgate.state').then((r) => r['focusgate.state']));
    eq(raw.tasks[0].title, 'Việc bền bỉ', 'Việc phải nằm trong chrome.storage.local');
    eq(raw.tasks[0].enforce, true, 'Cờ bắt buộc phải được lưu');
    // trang mới mở đọc qua đường truyền message thật
    const p = await newPage();
    await p.goto(h.url('src/dashboard.html'), { waitUntil: 'domcontentloaded' });
    await p.getByText('Việc bền bỉ').first().waitFor({ state: 'visible', timeout: 8000 });
    await p.close();
  });

  await test('Luật chặn được dọn sạch khi cổng mở', async () => {
    await addTask({ title: 'Việc A' });
    const withRules = await h.sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules().then((r) => r.length));
    assert(withRules > 0, 'Khi khoá phải có luật');
    const id = (await h.call('get')).state.tasks[0].id;
    await h.call('completeTask', { id });
    await until(async () => (await h.sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules().then((r) => r.length))) === 0,
      { label: 'luật bị xoá hết' });
  });

  await test('Trang nội bộ của extension không bao giờ bị chặn', async () => {
    await addTask({ title: 'Việc A' });
    for (const page of ['src/dashboard.html', 'src/popup.html', 'src/blocked.html']) {
      const p = await newPage();
      await p.goto(h.url(page), { waitUntil: 'domcontentloaded' });
      assert(p.url().includes(page), page + ' phải mở được bình thường');
      await p.close();
    }
  });

  await test('Danh sách đen mặc định phủ các trang hay gây nghiện', async () => {
    await addTask({ title: 'Việc A' });
    for (const url of ['http://tiktok.com/', 'http://instagram.com/', 'http://reddit.com/r/all', 'http://shopee.vn/', 'http://netflix.com/']) {
      const p = await newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded' });
      await p.waitForURL(BLOCKED, { timeout: 8000 }).catch(() => { throw new Error(url + ' lẽ ra phải bị chặn'); });
      await p.close();
    }
  });

  /* ---------- Tổng kết ---------- */
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n${'─'.repeat(52)}\n  ${pass}/${results.length} bài kiểm thử đạt${fail ? `  ·  ${fail} LỖI` : ''}\n`);
  if (fail) {
    for (const r of results.filter((x) => !x.ok)) console.log(`  ✗ ${r.name}\n     ${r.error}`);
  }
  await h.close();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error('\nLỗi nghiêm trọng:', e);
  if (h) await h.close();
  process.exit(1);
});
