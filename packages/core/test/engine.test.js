import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState, makeTask, completeTask, uncompleteTask, summary, rolloverRepeats, isOverdue,
  evaluateGate, matchesPattern, parseUrl, startSession, stopSession, endSession, pauseSession,
  tickState, nextWakeAt, guardChange, emergencyCooldownLeft, applyEmergency, daysBetween
} from '../src/index.js';

const D = (s) => new Date(s).getTime();
const withTasks = (now, ...tasks) => ({ ...defaultState(now), tasks: tasks.map((t) => makeTask(t, now)) });

/* ---------------- Hồi quy cho các lỗi đã sửa ---------------- */

test('matcher: "linkedin.com/feed" không khớp nhầm "/feedback"', () => {
  assert.equal(matchesPattern(parseUrl('https://linkedin.com/feedback'), 'linkedin.com/feed'), false);
  assert.equal(matchesPattern(parseUrl('https://linkedin.com/feed/abc'), 'linkedin.com/feed'), true);
});

test('điểm: tick/bỏ tick liên tục không cày được điểm', () => {
  const now = D('2026-10-20T09:00');
  let s = withTasks(now, { id: 'a', title: 'A' });
  s = completeTask(s, 'a', now);
  const afterFirst = s.stats.points;
  assert.equal(afterFirst, 30, '10 điểm việc + 20 điểm dọn sạch');
  for (let i = 0; i < 5; i++) { s = uncompleteTask(s, 'a'); s = completeTask(s, 'a', now); }
  assert.equal(s.stats.points, afterFirst, 'không được cộng thêm');
  assert.equal(s.stats.days['2026-10-20'].completed, 1, 'số việc xong không bị đếm trùng');
});

test('điểm: bỏ tick trả lại đúng điểm của việc', () => {
  const now = D('2026-10-20T09:00');
  let s = withTasks(now, { id: 'a', title: 'A' }, { id: 'b', title: 'B' });
  s = completeTask(s, 'a', now);
  assert.equal(s.stats.points, 10);
  s = uncompleteTask(s, 'a');
  assert.equal(s.stats.points, 0);
  assert.equal(s.stats.days['2026-10-20'].completed, 0);
});

test('streak: bỏ bê nhiều ngày thì hiển thị về 0', () => {
  let s = withTasks(D('2026-10-20T08:00'), { id: 'a', title: 'A' });
  s = completeTask(s, 'a', D('2026-10-20T09:00'));
  assert.equal(summary(s, D('2026-10-20T20:00')).streak, 1);
  assert.equal(summary(s, D('2026-10-21T20:00')).streak, 1, 'hôm sau vẫn còn cơ hội giữ chuỗi');
  assert.equal(summary(s, D('2026-10-23T20:00')).streak, 0, 'đứt chuỗi');
});

test('lặp hằng ngày: sống lại kèm hạn chót dời sang hôm nay, không khoá oan', () => {
  let s = withTasks(D('2026-10-20T08:00'),
    { id: 'd', title: 'Ôn bài', repeat: 'daily', enforce: false, remindAt: D('2026-10-20T19:00'), dueAt: D('2026-10-20T21:00') });
  s = completeTask(s, 'd', D('2026-10-20T20:00'));
  s = rolloverRepeats(s, D('2026-10-21T07:00')).state;
  const t = s.tasks[0];
  assert.equal(t.status, 'pending');
  assert.equal(t.dueAt, D('2026-10-21T21:00'));
  assert.equal(t.remindAt, D('2026-10-21T19:00'));
  assert.equal(isOverdue(t, D('2026-10-21T07:00')), false);
  assert.equal(evaluateGate(s, D('2026-10-21T07:00')).active, false);
});

test('lặp hằng tuần: mở máy trễ vẫn sống lại, hạn giữ đúng thứ trong tuần', () => {
  let s = withTasks(D('2026-10-19T08:00'),
    { id: 'w', title: 'Báo cáo', repeat: 'weekly', dueAt: D('2026-10-19T17:00') });   // thứ Hai
  s = completeTask(s, 'w', D('2026-10-19T10:00'));
  const mid = rolloverRepeats(s, D('2026-10-23T08:00')).state;                         // chưa đủ tuần
  assert.equal(mid.tasks[0].status, 'done');
  s = rolloverRepeats(s, D('2026-10-28T08:00')).state;                                 // thứ Tư tuần sau nữa
  assert.equal(s.tasks[0].status, 'pending');
  assert.equal(new Date(s.tasks[0].dueAt).getDay(), 1, 'vẫn là thứ Hai');
  assert.ok(s.tasks[0].dueAt > D('2026-10-28T08:00'), 'hạn nằm ở tương lai');
});

test('daysBetween: đếm theo ngày lịch', () => {
  assert.equal(daysBetween(D('2026-10-20T23:59'), D('2026-10-21T00:01')), 1);
  assert.equal(daysBetween(D('2026-10-20T00:01'), D('2026-10-20T23:59')), 0);
});

test('Pomodoro: dừng phiên không làm mất chu kỳ → tới lượt nghỉ dài', () => {
  let s = defaultState(1e6);
  for (let i = 0; i < 4; i++) { s = startSession(s, {}, 1e6 + i); s = stopSession(s, 1e6 + i); }
  s = startSession(s, {}, 1e6 + 10);
  assert.equal(s.session.cycle, 5);
});

test('Pomodoro: nghỉ quá một tiếng thì đếm chu kỳ lại từ đầu', () => {
  let s = startSession(defaultState(0), {}, 0);
  s = stopSession(s, 1000);
  s = startSession(s, {}, 1000 + 61 * 60000);
  assert.equal(s.session.cycle, 1);
});

test('endSession: dừng sớm vẫn ghi nhận thời gian tập trung', () => {
  const now = D('2026-10-20T09:00');
  let s = withTasks(now, { id: 'a', title: 'A' });
  s = startSession(s, { taskId: 'a' }, now);
  s = pauseSession(s, now + 10 * 60000);
  s = endSession(s, now + 20 * 60000);
  assert.equal(s.session, null);
  assert.equal(s.tasks[0].focusSec, 600, 'chỉ tính 10 phút trước khi tạm dừng');
  assert.equal(s.stats.days['2026-10-20'].focusSec, 600);
});

/* ---------------- tickState ---------------- */

test('tickState: không có gì đổi thì giữ nguyên tham chiếu state', () => {
  const now = D('2026-10-20T09:00');
  const s = defaultState(now);
  assert.equal(tickState(s, now + 1000, now).state, s);
});

test('tickState: hết cửa sổ mở tạm thì khoá lại và phát sự kiện', () => {
  const now = D('2026-10-20T09:00');
  const s = { ...withTasks(now, { title: 'A' }), unlock: { until: now - 1, usedAt: now - 600000 } };
  const r = tickState(s, now);
  assert.equal(r.state.unlock, null);
  assert.deepEqual(r.events.map((e) => e.type), ['unlock-expired']);
});

test('tickState: hết phiên tập trung → cộng giờ, báo đúng số phút nghỉ, tự chạy tiếp nếu bật', () => {
  const now = D('2026-10-20T09:00');
  let s = defaultState(now);
  s = { ...s, settings: { ...s.settings, pomodoro: { ...s.settings.pomodoro, breakMin: 7, autoStartNext: true } } };
  s = startSession(s, {}, now);
  const r = tickState(s, now + 25 * 60000 + 1);
  assert.equal(r.events[0].type, 'focus-ended');
  assert.equal(r.events[0].minutes, 7);
  assert.equal(r.state.session.phase, 'break');
  assert.equal(r.state.stats.days['2026-10-20'].focusSec, 1500);
});

test('tickState: lời nhắc chỉ báo đúng một lần', () => {
  const now = D('2026-10-20T09:00');
  const s = withTasks(now, { title: 'Học', remindAt: now + 30000 });
  const first = tickState(s, now + 40000, now);
  assert.equal(first.events.filter((e) => e.type === 'reminder').length, 1);
  const second = tickState(first.state, now + 100000, now + 40000);
  assert.equal(second.events.filter((e) => e.type === 'reminder').length, 0);
});

/* ---------------- nextWakeAt ---------------- */

test('nextWakeAt: chọn mốc sớm nhất trong tương lai', () => {
  const now = D('2026-10-20T09:00');
  const s = { ...withTasks(now, { title: 'A', remindAt: now + 5 * 60000 }), unlock: { until: now + 2 * 60000 } };
  assert.equal(nextWakeAt(s, now), now + 2 * 60000);
});

test('nextWakeAt: khung giờ theo lịch cũng là mốc', () => {
  const now = D('2026-10-20T18:58');
  const s = defaultState(now);
  s.settings.schedules = [{ id: 'x', start: '19:00', end: '22:00', days: [], enabled: true }];
  assert.equal(nextWakeAt(s, now), D('2026-10-20T19:00'));
});

/* ---------------- guardChange ---------------- */

const locked = () => withTasks(Date.now(), { id: 'a', title: 'Bài tập', enforce: true });

test('guard: cổng mở thì làm gì cũng được', () => {
  const s = defaultState();
  assert.equal(guardChange(s, { ...s, settings: { ...s.settings, mode: 'blocklist' } }), null);
});

test('guard: không xoá được việc bắt buộc khi đang khoá, nhưng tick xong thì được', () => {
  const s = locked();
  assert.match(guardChange(s, { ...s, tasks: [] }), /Bài tập/);
  assert.match(guardChange(s, { ...s, tasks: [{ ...s.tasks[0], enforce: false }] }), /Bài tập/);
  assert.equal(guardChange(s, completeTask(s, 'a')), null);
});

test('guard: thêm việc, sửa tên việc vẫn thoải mái', () => {
  const s = locked();
  assert.equal(guardChange(s, { ...s, tasks: [...s.tasks, makeTask({ title: 'B' })] }), null);
  assert.equal(guardChange(s, { ...s, tasks: [{ ...s.tasks[0], title: 'Bài tập Giải tích' }] }), null);
});

test('guard: không đổi sang danh sách đen, không mở trang giải trí qua danh sách trắng', () => {
  const s = locked();
  assert.ok(guardChange(s, { ...s, settings: { ...s.settings, mode: 'blocklist' } }));
  assert.ok(guardChange(s, { ...s, settings: { ...s.settings, allowlist: [...s.settings.allowlist, 'm.facebook.com'] } }));
  assert.ok(guardChange(s, { ...s, settings: { ...s.settings, allowlist: [...s.settings.allowlist, 'youtube.com'] } }));
  assert.equal(guardChange(s, { ...s, settings: { ...s.settings, allowlist: [...s.settings.allowlist, 'vidu-hoctap.com'] } }), null);
});

test('guard: không lén thêm facebook vào tab công việc', () => {
  const s = locked();
  const next = { ...s, tasks: [{ ...s.tasks[0], tabs: [{ url: 'https://facebook.com/', title: 'fb' }] }] };
  assert.ok(guardChange(s, next));
});

test('guard: không nới lối thoát khẩn cấp, không reset dữ liệu', () => {
  const s = locked();
  const em = (patch) => ({ ...s, settings: { ...s.settings, emergency: { ...s.settings.emergency, ...patch } } });
  assert.ok(guardChange(s, em({ maxPerDay: 5 })));
  assert.ok(guardChange(s, em({ cooldownSec: 1 })));
  assert.equal(guardChange(s, em({ cooldownSec: 60 })), null, 'siết chặt hơn thì được');
  assert.ok(guardChange(s, defaultState()), 'xoá sạch dữ liệu = gỡ việc bắt buộc');
});

test('guard: không gỡ app khỏi danh sách chặn, không tắt tự khởi động (desktop)', () => {
  const s = locked();
  const set = (patch) => ({ ...s, settings: { ...s.settings, ...patch } });
  assert.match(guardChange(s, set({ blockedApps: s.settings.blockedApps.filter((a) => a !== 'Discord') })), /Discord/);
  assert.ok(guardChange(s, set({ launchAtLogin: false })));
  assert.equal(guardChange(s, set({ blockedApps: [...s.settings.blockedApps, 'Steam Helper'] })), null);
});

test('guard: không tắt khung giờ đang chạy', () => {
  const s = defaultState();
  s.settings.schedules = [{ id: 'x', start: '00:00', end: '23:59', days: [], enabled: true }];
  const off = { ...s, settings: { ...s.settings, schedules: [{ ...s.settings.schedules[0], enabled: false }] } };
  assert.ok(guardChange(s, off));
});

test('guard: đang mở tạm hoặc chế độ mềm thì không chặn', () => {
  const s = applyEmergency(locked());
  assert.equal(guardChange(s, { ...s, tasks: [] }), null);
  const soft = locked(); soft.settings.strictness = 'soft';
  assert.equal(guardChange(soft, { ...soft, tasks: [] }), null);
});

test('emergencyCooldownLeft: chưa mở hộp thoại thì phải chờ đủ', () => {
  const s = defaultState();
  assert.equal(emergencyCooldownLeft(s, null, 1000), 30);
  assert.equal(emergencyCooldownLeft(s, 0, 10000), 20);
  assert.equal(emergencyCooldownLeft(s, 0, 30000), 0);
});
