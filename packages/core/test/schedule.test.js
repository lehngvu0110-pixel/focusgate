import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHHMM, isScheduleActive, activeSchedule, scheduleEndsAt } from '../src/schedule.js';

const at = (iso) => new Date(iso);

test('parseHHMM', () => {
  assert.equal(parseHHMM('00:00'), 0);
  assert.equal(parseHHMM('19:30'), 1170);
  assert.equal(parseHHMM('23:59'), 1439);
  assert.equal(parseHHMM('24:00'), null);
  assert.equal(parseHHMM('9:05'), 545);
  assert.equal(parseHHMM('abc'), null);
  assert.equal(parseHHMM(null), null);
});

test('khung giờ thường trong ngày', () => {
  const s = { days: [1, 2, 3, 4, 5], start: '19:00', end: '22:00', enabled: true };
  // 2026-09-15 là thứ Ba
  assert.equal(isScheduleActive(s, at('2026-09-15T19:00:00')), true);
  assert.equal(isScheduleActive(s, at('2026-09-15T21:59:00')), true);
  assert.equal(isScheduleActive(s, at('2026-09-15T22:00:00')), false, 'mốc kết thúc không tính');
  assert.equal(isScheduleActive(s, at('2026-09-15T18:59:00')), false);
  // 2026-09-13 là Chủ nhật -> không nằm trong days
  assert.equal(isScheduleActive(s, at('2026-09-13T20:00:00')), false);
});

test('khung giờ qua nửa đêm', () => {
  const s = { days: [1], start: '22:00', end: '01:00', enabled: true }; // thứ Hai
  assert.equal(isScheduleActive(s, at('2026-09-14T22:30:00')), true, 'tối thứ Hai');
  assert.equal(isScheduleActive(s, at('2026-09-15T00:30:00')), true, 'rạng sáng thứ Ba vẫn thuộc ca thứ Hai');
  assert.equal(isScheduleActive(s, at('2026-09-15T01:00:00')), false, 'đã hết ca');
  assert.equal(isScheduleActive(s, at('2026-09-15T22:30:00')), false, 'tối thứ Ba không có ca');
});

test('khung giờ bị tắt hoặc sai dữ liệu', () => {
  assert.equal(isScheduleActive({ start: '19:00', end: '22:00', enabled: false }, at('2026-09-15T20:00:00')), false);
  assert.equal(isScheduleActive({ start: '19:00', end: '19:00', enabled: true }, at('2026-09-15T19:00:00')), false);
  assert.equal(isScheduleActive({ start: 'x', end: 'y', enabled: true }, at('2026-09-15T19:00:00')), false);
  assert.equal(isScheduleActive(null, at('2026-09-15T19:00:00')), false);
});

test('days rỗng = mọi ngày', () => {
  const s = { days: [], start: '08:00', end: '10:00', enabled: true };
  assert.equal(isScheduleActive(s, at('2026-09-13T09:00:00')), true);
});

test('activeSchedule trả về khung đầu tiên khớp', () => {
  const list = [
    { id: 'a', days: [1], start: '08:00', end: '09:00', enabled: true },
    { id: 'b', days: [2], start: '19:00', end: '22:00', enabled: true }
  ];
  assert.equal(activeSchedule(list, at('2026-09-15T20:00:00'))?.id, 'b');
  assert.equal(activeSchedule(list, at('2026-09-15T12:00:00')), null);
  assert.equal(activeSchedule([], at('2026-09-15T12:00:00')), null);
});

test('scheduleEndsAt: đúng mốc kết thúc, nhảy sang hôm sau nếu qua nửa đêm', () => {
  const now = at('2026-09-15T20:00:00');
  assert.equal(new Date(scheduleEndsAt({ start: '19:00', end: '22:00' }, now)).getHours(), 22);
  const overnight = at('2026-09-15T23:00:00');
  const end = new Date(scheduleEndsAt({ start: '22:00', end: '01:00' }, overnight));
  assert.equal(end.getHours(), 1);
  assert.equal(end.getDate(), 16, 'phải là 1h sáng hôm sau');
});
