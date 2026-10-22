import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, makeTask, hydrate, rolloverRepeats, blockingTasks, todayKey } from '../src/state.js';
import {
  evaluateGate, checkUrl, canUseEmergency, pickPhrase, phraseMatches,
  applyEmergency, cancelUnlock, completeTask, uncompleteTask, addFocusTime, summary, emergencyUsedToday
} from '../src/gate.js';

const NOW = new Date('2026-09-15T20:00:00').getTime();
const base = () => {
  const s = defaultState(NOW);
  s.settings.mode = 'allowlist';
  s.settings.allowlist = ['google.com'];
  return s;
};

test('không có việc gì -> cổng mở, mọi trang vào được', () => {
  const s = base();
  const g = evaluateGate(s, NOW);
  assert.equal(g.active, false);
  assert.equal(checkUrl(s, 'https://facebook.com', NOW).allowed, true);
});

test('có task bắt buộc chưa xong -> cổng khoá, chặn trang ngoài danh sách trắng', () => {
  const s = base();
  s.tasks = [makeTask({ title: 'Làm bài tập Giải tích', enforce: true }, NOW)];
  const g = evaluateGate(s, NOW);
  assert.equal(g.active, true);
  assert.equal(g.primary, 'task');
  assert.equal(g.tasks.length, 1);
  assert.equal(checkUrl(s, 'https://facebook.com', NOW).allowed, false);
  assert.equal(checkUrl(s, 'https://google.com/search?q=x', NOW).allowed, true);
});

test('task KHÔNG bắt buộc thì không khoá cổng', () => {
  const s = base();
  s.tasks = [makeTask({ title: 'Việc nhẹ', enforce: false }, NOW)];
  assert.equal(evaluateGate(s, NOW).active, false);
});

test('task hẹn giờ trong tương lai chưa khoá cổng, tới giờ mới khoá', () => {
  const s = base();
  s.tasks = [makeTask({ title: 'Ôn thi', enforce: true, remindAt: NOW + 3600_000 }, NOW)];
  assert.equal(evaluateGate(s, NOW).active, false, 'chưa tới giờ');
  assert.equal(evaluateGate(s, NOW + 3600_001).active, true, 'đã tới giờ');
});

test('task quá hạn tự leo thang thành bắt buộc (escalateOverdue)', () => {
  const s = base();
  s.tasks = [makeTask({ title: 'Nộp báo cáo', enforce: false, dueAt: NOW - 1000 }, NOW)];
  assert.equal(evaluateGate(s, NOW).active, true);
  s.settings.escalateOverdue = false;
  assert.equal(evaluateGate(s, NOW).active, false, 'tắt leo thang thì không khoá');
});

test('khung giờ theo lịch khoá cổng dù không có task', () => {
  const s = base();
  s.settings.schedules = [{ id: 'x', days: [2], start: '19:00', end: '22:00', enabled: true }];
  const g = evaluateGate(s, NOW);
  assert.equal(g.active, true);
  assert.equal(g.reasons.some((r) => r.type === 'schedule'), true);
  assert.ok(g.reasons.find((r) => r.type === 'schedule').endsAt > NOW);
});

test('phiên Pomodoro đang chạy khoá cổng; hết giờ thì mở', () => {
  const s = base();
  s.session = { phase: 'focus', paused: false, endsAt: NOW + 60_000, startedAt: NOW, durationMs: 60_000, cycle: 1 };
  assert.equal(evaluateGate(s, NOW).active, true);
  assert.equal(evaluateGate(s, NOW + 61_000).active, false);
  s.session.paused = true;
  assert.equal(evaluateGate(s, NOW).active, false, 'tạm dừng thì không khoá');
});

test('pha nghỉ của Pomodoro không khoá cổng', () => {
  const s = base();
  s.session = { phase: 'break', paused: false, endsAt: NOW + 60_000, cycle: 1 };
  assert.equal(evaluateGate(s, NOW).active, false);
});

test('hoàn thành hết task -> cổng mở lại ngay', () => {
  let s = base();
  s.tasks = [makeTask({ id: 'a', title: 'A', enforce: true }, NOW), makeTask({ id: 'b', title: 'B', enforce: true }, NOW)];
  assert.equal(evaluateGate(s, NOW).active, true);
  s = completeTask(s, 'a', NOW);
  assert.equal(evaluateGate(s, NOW).active, true, 'còn 1 việc');
  s = completeTask(s, 'b', NOW);
  assert.equal(evaluateGate(s, NOW).active, false, 'xong hết -> mở');
  assert.equal(checkUrl(s, 'https://youtube.com', NOW).allowed, true);
});

test('bỏ tick hoàn thành -> khoá lại', () => {
  let s = base();
  s.tasks = [makeTask({ id: 'a', title: 'A', enforce: true }, NOW)];
  s = completeTask(s, 'a', NOW);
  assert.equal(evaluateGate(s, NOW).active, false);
  s = uncompleteTask(s, 'a');
  assert.equal(evaluateGate(s, NOW).active, true);
});

test('hoàn thành cộng điểm + tăng streak, hoàn thành 2 lần không cộng đúp', () => {
  let s = base();
  s.tasks = [makeTask({ id: 'a', title: 'A', enforce: true }, NOW)];
  s = completeTask(s, 'a', NOW);
  assert.equal(s.stats.points, 30, '10 điểm task + 20 điểm dọn sạch');
  assert.equal(s.stats.streak, 1);
  const again = completeTask(s, 'a', NOW);
  assert.equal(again.stats.points, 30, 'không cộng lần hai');
});

test('streak nối tiếp khi làm xong 2 ngày liền, đứt khi bỏ ngày', () => {
  let s = base();
  s.tasks = [makeTask({ id: 'a', title: 'A', enforce: true }, NOW)];
  s = completeTask(s, 'a', NOW);
  assert.equal(s.stats.streak, 1);

  const day2 = NOW + 86400_000;
  s = { ...s, tasks: [makeTask({ id: 'b', title: 'B', enforce: true }, day2)] };
  s = completeTask(s, 'b', day2);
  assert.equal(s.stats.streak, 2);

  const day4 = NOW + 3 * 86400_000;
  s = { ...s, tasks: [makeTask({ id: 'c', title: 'C', enforce: true }, day4)] };
  s = completeTask(s, 'c', day4);
  assert.equal(s.stats.streak, 1, 'bỏ 1 ngày -> streak reset về 1');
  assert.equal(s.stats.bestStreak, 2);
});

test('thoát khẩn cấp: phải gõ đúng câu, mở tạm, xoá streak, trừ điểm', () => {
  let s = base();
  s.tasks = [makeTask({ id: 'a', title: 'A', enforce: true }, NOW)];
  s.stats.streak = 7; s.stats.points = 200;

  const phrase = pickPhrase(s, NOW);
  assert.ok(phrase.length >= 100, 'câu cam kết phải đủ dài để tạo ma sát');
  assert.equal(phraseMatches('sai bét', phrase), false);
  assert.equal(phraseMatches('  ' + phrase.toUpperCase() + ' ', phrase), true, 'bỏ qua hoa/thường & khoảng trắng');

  assert.equal(canUseEmergency(s, NOW).ok, true);
  s = applyEmergency(s, NOW);
  assert.equal(evaluateGate(s, NOW).active, false, 'đã mở tạm');
  assert.equal(checkUrl(s, 'https://facebook.com', NOW).allowed, true);
  assert.equal(s.stats.streak, 0, 'mất streak');
  assert.equal(s.stats.points, 150, 'trừ 50 điểm');
  assert.equal(emergencyUsedToday(s, NOW), 1);

  const after = NOW + 11 * 60_000;
  assert.equal(evaluateGate(s, after).active, true, 'hết 10 phút thì khoá lại');
});

test('thoát khẩn cấp: giới hạn số lượt/ngày và chế độ cứng tuyệt đối', () => {
  let s = base();
  s.tasks = [makeTask({ id: 'a', title: 'A', enforce: true }, NOW)];
  s = applyEmergency(s, NOW);
  s = applyEmergency(s, NOW);
  assert.equal(canUseEmergency(s, NOW).ok, false, 'hết 2 lượt');

  const hard = base();
  hard.settings.strictness = 'hard';
  assert.equal(canUseEmergency(hard, NOW).ok, false);
  const off = base();
  off.settings.emergency.enabled = false;
  assert.equal(canUseEmergency(off, NOW).ok, false);
});

test('nút "quay lại làm việc" huỷ cửa sổ mở tạm ngay', () => {
  let s = base();
  s.tasks = [makeTask({ id: 'a', title: 'A', enforce: true }, NOW)];
  s = applyEmergency(s, NOW);
  assert.equal(evaluateGate(s, NOW).active, false);
  s = cancelUnlock(s);
  assert.equal(evaluateGate(s, NOW).active, true);
});

test('tab công việc của task đang mở luôn vào được', () => {
  const s = base();
  s.tasks = [makeTask({ title: 'Thiết kế', enforce: true, tabs: [{ url: 'https://www.figma.com/file/1' }] }, NOW)];
  assert.equal(checkUrl(s, 'https://figma.com/file/1', NOW).allowed, true);
  assert.equal(checkUrl(s, 'https://facebook.com', NOW).allowed, false);
});

test('cộng thời gian tập trung -> điểm theo mỗi 5 phút', () => {
  let s = base();
  s.tasks = [makeTask({ id: 'a', title: 'A' }, NOW)];
  s = addFocusTime(s, 299, 'a', NOW);
  assert.equal(s.stats.points, 0);
  s = addFocusTime(s, 1, 'a', NOW);
  assert.equal(s.stats.points, 1, 'tròn 300s = 1 điểm');
  s = addFocusTime(s, 600, 'a', NOW);
  assert.equal(s.stats.points, 3);
  assert.equal(s.tasks[0].focusSec, 900);
  assert.equal(addFocusTime(s, -5, 'a', NOW).stats.points, 3, 'số âm bị bỏ qua');
});

test('summary tổng hợp đúng', () => {
  let s = base();
  s.tasks = [
    makeTask({ id: 'a', title: 'A', enforce: true }, NOW),
    makeTask({ id: 'b', title: 'B', enforce: false, dueAt: NOW - 1 }, NOW)
  ];
  s = addFocusTime(s, 1800, 'a', NOW);
  const sum = summary(s, NOW);
  assert.equal(sum.pending, 2);
  assert.equal(sum.overdue, 1);
  assert.equal(sum.focusMin, 30);
  assert.equal(sum.blocking, 2, 'b quá hạn nên cũng chặn');
});

test('hydrate: state cũ/thiếu trường vẫn dùng được, không mất dữ liệu', () => {
  const old = { tasks: [{ id: 'x', title: 'Cũ' }], settings: { mode: 'blocklist' }, stats: { points: 99 } };
  const s = hydrate(old, NOW);
  assert.equal(s.settings.mode, 'blocklist');
  assert.ok(Array.isArray(s.settings.allowlist) && s.settings.allowlist.length > 0, 'bù danh sách trắng mặc định');
  assert.equal(s.settings.pomodoro.focusMin, 25);
  assert.equal(s.stats.points, 99);
  assert.equal(s.tasks[0].title, 'Cũ');
  assert.equal(s.tasks[0].enforce, true);
  assert.doesNotThrow(() => hydrate(null, NOW));
  assert.doesNotThrow(() => hydrate('rác', NOW));
});

test('rolloverRepeats: task lặp hằng ngày sống lại sang ngày mới', () => {
  let s = base();
  s.tasks = [
    makeTask({ id: 'd', title: 'Ôn từ vựng', enforce: true, repeat: 'daily', status: 'done', completedAt: NOW }, NOW),
    makeTask({ id: 'n', title: 'Việc một lần', status: 'done', completedAt: NOW, repeat: 'none' }, NOW)
  ];
  s.lastRolloverDay = todayKey(new Date(NOW));

  const same = rolloverRepeats(s, NOW);
  assert.equal(same.reset, 0, 'cùng ngày không reset');

  const tomorrow = NOW + 86400_000;
  const next = rolloverRepeats(s, tomorrow);
  assert.equal(next.reset, 1);
  assert.equal(next.state.tasks.find((t) => t.id === 'd').status, 'pending');
  assert.equal(next.state.tasks.find((t) => t.id === 'n').status, 'done');
  assert.equal(blockingTasks(next.state, tomorrow).length, 1);
});

test('rolloverRepeats: weekdays không sống lại vào cuối tuần', () => {
  const s = base();
  s.tasks = [makeTask({ id: 'w', title: 'Học', repeat: 'weekdays', status: 'done', completedAt: NOW }, NOW)];
  s.lastRolloverDay = todayKey(new Date(NOW));
  const saturday = new Date('2026-09-19T08:00:00').getTime(); // thứ Bảy
  assert.equal(rolloverRepeats(s, saturday).reset, 0);
  const monday = new Date('2026-09-21T08:00:00').getTime();   // thứ Hai
  assert.equal(rolloverRepeats(s, monday).reset, 1);
});
