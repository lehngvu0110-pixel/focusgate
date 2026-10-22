/** FocusGate — Pomodoro */

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
      cycle: phase === 'focus' ? (state.session?.cycle || 0) + 1 : (state.session?.cycle || 0)
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

export function stopSession(state) {
  return { ...state, session: null };
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
