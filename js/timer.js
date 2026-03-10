// 回合计时器
const Timer = {
  _interval: null,
  _deadline: null,
  TURN_DURATION: 120, // 2分钟

  start(turnStartedAt, onTimeout) {
    this.stop();

    // turnStartedAt 是 Firestore Timestamp
    const startMs = turnStartedAt?.toMillis?.() || Date.now();
    this._deadline = startMs + this.TURN_DURATION * 1000;

    this._interval = setInterval(() => {
      const remaining = Math.max(0, this._deadline - Date.now());
      this._updateDisplay(remaining);

      if (remaining <= 0) {
        this.stop();
        if (onTimeout) onTimeout();
      }
    }, 250);

    // 立即更新一次
    const remaining = Math.max(0, this._deadline - Date.now());
    this._updateDisplay(remaining);
  },

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  },

  _updateDisplay(remainingMs) {
    const el = document.getElementById('timer-display');
    const secs = Math.ceil(remainingMs / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;

    if (secs <= 15) {
      el.classList.add('urgent');
    } else {
      el.classList.remove('urgent');
    }
  }
};
