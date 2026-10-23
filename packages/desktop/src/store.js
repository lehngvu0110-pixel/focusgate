/** FocusGate Desktop — lưu trữ state ra đĩa (không phụ thuộc Electron để test được). */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as FG from '../vendor/core/index.js';

export class Store {
  constructor(file) {
    this.file = file;
    this.listeners = new Set();
    this.emergencyArmedAt = null;
    this.lastTick = null;
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

  /**
   * Áp một phép biến đổi lên state rồi lưu + phát tín hiệu.
   *  - fn trả về đúng state cũ thì không ghi đĩa, không phát tín hiệu.
   *  - guard: thao tác của người dùng không được nới lỏng cổng đang khoá (ném lỗi kèm lý do).
   */
  update(fn, { bump = true, guard = false } = {}) {
    const prev = this.state;
    const next = fn(prev) || prev;
    if (next === prev) return prev;
    if (guard) {
      const why = FG.guardChange(prev, next);
      if (why) throw new Error(why);
    }
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
  deleteTask(id, opts) { return this.update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }), opts); }
  updateSettings(patch, opts) { return this.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }), opts); }
  cancelUnlock() { return this.update((s) => FG.cancelUnlock(s)); }

  /** Mở hộp thoại thoát khẩn cấp: bắt đầu đếm ngược (kiểm lại khi xác nhận). */
  emergencyInfo(now = Date.now()) {
    const s = this.state;
    const can = FG.canUseEmergency(s, now);
    if (can.ok) this.emergencyArmedAt = now;
    return {
      ...can,
      phrase: FG.pickPhrase(s, now),
      cooldownSec: s.settings.emergency?.cooldownSec ?? 30,
      unlockMinutes: s.settings.emergency?.unlockMinutes ?? 10
    };
  }

  emergency(typed, now = Date.now()) {
    const can = FG.canUseEmergency(this.state, now);
    if (!can.ok) return { ok: false, error: can.reason };
    const left = FG.emergencyCooldownLeft(this.state, this.emergencyArmedAt, now);
    if (left > 0) return { ok: false, error: `Còn phải chờ ${left} giây nữa.` };
    if (!FG.phraseMatches(typed, FG.pickPhrase(this.state, now))) {
      return { ok: false, error: 'Câu cam kết chưa đúng. Gõ lại chính xác từng chữ.' };
    }
    this.update((s) => FG.applyEmergency(s, now));
    this.emergencyArmedAt = null;
    return { ok: true };
  }

  /**
   * Dọn dẹp theo thời gian (dùng chung logic với extension): task lặp lại, hết cửa sổ mở tạm,
   * hết phiên Pomodoro, tới giờ nhắc. Không có gì đổi thì không ghi đĩa.
   * @returns {Array<{type:string}>} các sự kiện vừa xảy ra
   */
  tick(now = Date.now()) {
    const { state, events } = FG.tickState(this.state, now, this.lastTick);
    this.lastTick = now;
    if (state !== this.state) this.update(() => state, { bump: events.length > 0 });
    return events;
  }
}

export function defaultStoreFile(userDataDir) {
  return join(userDataDir, 'focusgate-state.json');
}
