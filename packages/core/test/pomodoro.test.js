import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/state.js';
import { startSession, pauseSession, resumeSession, stopSession, sessionRemainingMs, nextPhase, isSessionOver } from '../src/pomodoro.js';

const NOW = 1_000_000;
const base = () => defaultState(NOW);

test('bắt đầu phiên tập trung 25 phút', () => {
  const s = startSession(base(), { taskId: 'a' }, NOW);
  assert.equal(s.session.phase, 'focus');
  assert.equal(s.session.endsAt - NOW, 25 * 60000);
  assert.equal(s.session.cycle, 1);
  assert.equal(s.session.taskId, 'a');
});

test('tạm dừng giữ nguyên thời gian còn lại, tiếp tục thì chạy tiếp', () => {
  let s = startSession(base(), {}, NOW);
  const t10 = NOW + 10 * 60000;
  s = pauseSession(s, t10);
  assert.equal(sessionRemainingMs(s.session, t10 + 5 * 60000), 15 * 60000, 'tạm dừng 5 phút vẫn còn 15 phút');
  s = resumeSession(s, t10 + 5 * 60000);
  assert.equal(sessionRemainingMs(s.session, t10 + 5 * 60000), 15 * 60000);
  assert.equal(s.session.paused, false);
});

test('tạm dừng/tiếp tục hai lần vẫn đúng', () => {
  let s = startSession(base(), {}, NOW);
  s = pauseSession(s, NOW + 5 * 60000);
  s = resumeSession(s, NOW + 60 * 60000);
  s = pauseSession(s, NOW + 65 * 60000);
  assert.equal(sessionRemainingMs(s.session, NOW + 99 * 60000), 15 * 60000);
});

test('pause khi không có phiên / resume khi đang chạy: không đổi gì', () => {
  const s = base();
  assert.equal(pauseSession(s, NOW).session, null);
  const run = startSession(s, {}, NOW);
  assert.equal(resumeSession(run, NOW).session.startedAt, NOW);
});

test('phiên hết giờ', () => {
  const s = startSession(base(), {}, NOW);
  assert.equal(isSessionOver(s.session, NOW + 24 * 60000), false);
  assert.equal(isSessionOver(s.session, NOW + 25 * 60000), true);
  assert.equal(isSessionOver(pauseSession(s, NOW).session, NOW + 99 * 60000), false, 'đang tạm dừng thì chưa hết');
});

test('chu kỳ: 4 phiên tập trung thì tới nghỉ dài', () => {
  let s = base();
  for (let i = 1; i <= 3; i++) {
    s = startSession(s, {}, NOW);
    assert.equal(nextPhase(s), 'break', `phiên ${s.session.cycle} -> nghỉ ngắn`);
    s = { ...s, session: { ...s.session, phase: 'break' } };
  }
  s = startSession(s, {}, NOW);
  assert.equal(s.session.cycle, 4);
  assert.equal(nextPhase(s), 'longBreak');
});

test('sau pha nghỉ luôn quay lại tập trung; dừng phiên xoá sạch', () => {
  let s = startSession(base(), { phase: 'break' }, NOW);
  assert.equal(nextPhase(s), 'focus');
  assert.equal(stopSession(s).session, null);
  assert.equal(sessionRemainingMs(null, NOW), 0);
});

test('thời lượng theo cấu hình người dùng', () => {
  const s = base();
  s.settings.pomodoro = { focusMin: 50, breakMin: 10, longBreakMin: 30, cyclesPerLongBreak: 2 };
  assert.equal(startSession(s, {}, NOW).session.durationMs, 50 * 60000);
  assert.equal(startSession(s, { phase: 'break' }, NOW).session.durationMs, 10 * 60000);
  assert.equal(startSession(s, { phase: 'longBreak' }, NOW).session.durationMs, 30 * 60000);
});
