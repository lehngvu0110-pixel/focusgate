/** FocusGate Desktop — lưu trữ state ra đĩa (không phụ thuộc Electron để test được). */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as FG from '../vendor/core/index.js';

export class Store {
  constructor(file) {
    this.file = file;
    this.listeners = new Set();
    this.state = this.#read();
  }

  #read() {
    try {
      if (existsSync(this.file)) return FG.hydrate(JSON.parse(readFileSync(this.file, 'utf8')));
    } catch (e) {
      console.error('[FocusGate] Không đọc được tệp state, dùng mặc định:', e.message);
    }
    const s = FG.defaultState();
    s.updatedAt = Date.now();
    return s;
  }

  #write() {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    renameSync(tmp, this.file);          // ghi nguyên tử, tránh hỏng tệp khi tắt máy đột ngột
  }

  get() { return this.state; }

  /** Áp một phép biến đổi lên state rồi lưu + phát tín hiệu. */
  update(fn, { bump = true } = {}) {
    const next = fn(this.state) || this.state;
    this.state = bump ? { ...next, updatedAt: Date.now() } : next;
    this.#write();
    this.emit();
    return this.state;
  }

  /** Thay toàn bộ state (dùng khi đồng bộ từ extension). */
  replace(state) {
    this.state = FG.hydrate(state);
    this.state.updatedAt = state?.updatedAt || Date.now();
    this.#write();
    this.emit();
    return this.state;
  }

  onChange(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  emit() { for (const cb of this.listeners) { try { cb(this.state); } catch (e) { console.error(e); } } }

  /* --- các phép biến đổi hay dùng --- */
  gate(now = Date.now()) { return FG.evaluateGate(this.state, now); }
  summary(now = Date.now()) { return FG.summary(this.state, now); }
  addTask(input) { return this.update((s) => ({ ...s, tasks: [...s.tasks, FG.makeTask(input)] })); }
  completeTask(id) { return this.update((s) => FG.completeTask(s, id)); }
  uncompleteTask(id) { return this.update((s) => FG.uncompleteTask(s, id)); }
  deleteTask(id) { return this.update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })); }
  updateSettings(patch) { return this.update((s) => ({ ...s, settings: { ...s.settings, ...patch } })); }
  cancelUnlock() { return this.update((s) => FG.cancelUnlock(s)); }

  emergency(typed, now = Date.now()) {
    const can = FG.canUseEmergency(this.state, now);
    if (!can.ok) return { ok: false, error: can.reason };
    if (!FG.phraseMatches(typed, FG.pickPhrase(this.state, now))) {
      return { ok: false, error: 'Câu cam kết chưa đúng. Gõ lại chính xác từng chữ.' };
    }
    this.update((s) => FG.applyEmergency(s, now));
    return { ok: true };
  }

  /** Dọn dẹp theo thời gian: task lặp lại, hết cửa sổ mở tạm, hết phiên pomodoro. */
  tick(now = Date.now()) {
    const events = [];
    this.update((s0) => {
      let s = FG.rolloverRepeats(s0, now).state;
      if (s.unlock && s.unlock.until <= now) { s = { ...s, unlock: null }; events.push('unlock-expired'); }
      if (s.session && FG.isSessionOver(s.session, now)) {
        if (s.session.phase === 'focus') s = FG.addFocusTime(s, Math.round(s.session.durationMs / 1000), s.session.taskId, now);
        events.push('session-ended');
        s = FG.stopSession(s);
      }
      return s;
    }, { bump: events.length > 0 });
    return events;
  }
}

export function defaultStoreFile(userDataDir) {
  return join(userDataDir, 'focusgate-state.json');
}
