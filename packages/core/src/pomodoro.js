/** FocusGate — Pomodoro */

import { addFocusTime } from './gate.js';

/** Nghỉ quá lâu (phút) thì đếm lại chu kỳ từ đầu. */
const CYCLE_RESET_MIN = 60;

/** Số chu kỳ tập trung đã xong gần đây (nối tiếp được qua lần dừng phiên). */
function previousCycle(state, now) {
  if (state.session) return state.session.cycle || 0;
  const last = state.pomodoroCycle;
  if (!last || !Number.isFinite(last.at) || now - last.at > CYCLE_RESET_MIN * 60000) return 0;
  return last.cycle || 0;
}

export function startSession(state, { taskId = null, phase = 'focus' } = {}, now = Date.now()) {
  const p = state.settings?.pomodoro || { focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesPerLongBreak: 4 };
  const minutes = phase === 'focus' ? p.focusMin : phase === 'longBreak' ? p.longBreakMin : p.breakMin;
  return {
    ...state,
    session: {
      id: 's_' + now.toString(36),
      phase,
      taskId,
      startedAt: now,
      endsAt: now + minutes * 60000,
      durationMs: minutes * 60000,
      paused: false,
      pausedAt: null,
      elapsedBeforePause: 0,
      cycle: phase === 'focus' ? previousCycle(state, now) + 1 : previousCycle(state, now)
    }
  };
}

export function pauseSession(state, now = Date.now()) {
  const s = state.session;
  if (!s || s.paused) return state;
  return {
    ...state,
    session: { ...s, paused: true, pausedAt: now, elapsedBeforePause: (s.elapsedBeforePause || 0) + (now - s.startedAt) }
  };
}

export function resumeSession(state, now = Date.now()) {
  const s = state.session;
  if (!s || !s.paused) return state;
  const remaining = s.durationMs - (s.elapsedBeforePause || 0);
  return { ...state, session: { ...s, paused: false, pausedAt: null, startedAt: now, endsAt: now + remaining } };
}

/** Dừng phiên, nhớ lại số chu kỳ để lần sau biết khi nào tới lượt nghỉ dài. */
export function stopSession(state, now = Date.now()) {
  const s = state.session;
  if (!s) return state;
  return { ...state, session: null, pomodoroCycle: { cycle: s.cycle || 0, at: now } };
}

/** Thời gian tập trung đã trôi qua của phiên (ms). */
export function sessionElapsedMs(session, now = Date.now()) {
  if (!session) return 0;
  const running = session.paused ? 0 : Math.max(0, now - session.startedAt);
  return Math.min(session.durationMs, (session.elapsedBeforePause || 0) + running);
}

/** Người dùng tự dừng phiên: vẫn ghi nhận phần thời gian tập trung đã làm (nếu đủ 30 giây). */
export function endSession(state, now = Date.now()) {
  const s = state.session;
  if (!s) return state;
  let out = state;
  if (s.phase === 'focus') {
    const sec = Math.round(sessionElapsedMs(s, now) / 1000);
    if (sec > 30) out = addFocusTime(out, sec, s.taskId, now);
  }
  return stopSession(out, now);
}

export function sessionRemainingMs(session, now = Date.now()) {
  if (!session) return 0;
  if (session.paused) return Math.max(0, session.durationMs - (session.elapsedBeforePause || 0));
  return Math.max(0, session.endsAt - now);
}

/** Pha kế tiếp sau khi hết giờ. */
export function nextPhase(state) {
  const s = state.session;
  const p = state.settings?.pomodoro || { cyclesPerLongBreak: 4 };
  if (!s) return 'focus';
  if (s.phase !== 'focus') return 'focus';
  const cycles = p.cyclesPerLongBreak || 4;
  return s.cycle > 0 && s.cycle % cycles === 0 ? 'longBreak' : 'break';
}

export function isSessionOver(session, now = Date.now()) {
  return !!session && !session.paused && session.endsAt <= now;
}
