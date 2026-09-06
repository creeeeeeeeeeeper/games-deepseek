'use strict';

(() => {
  // ===== 常量 =====
  const TOTAL_TIME = 30;              // 每局时长（秒）
  const HOLE_COUNT = 9;               // 3×3 洞口
  const COMBO_X2 = 5;                 // 连击 ≥5 → 得分 ×2
  const COMBO_X3 = 10;                // 连击 ≥10 → 得分 ×3（上限）
  const BEST_KEY = 'whack-best';      // localStorage 最高分键
  const COUNTDOWN_STEP = 0.7;         // 3-2-1 每步时长（秒）
  const COUNTDOWN_TOTAL = COUNTDOWN_STEP * 3 + 0.55;

  // ===== DOM 引用 =====
  const board = document.getElementById('board');
  const overlay = document.getElementById('overlay');
  const overlayText = document.getElementById('overlay-text');
  const hudScore = document.getElementById('hud-score');
  const hudCombo = document.getElementById('hud-combo');
  const hudMult = document.getElementById('hud-mult');
  const hudBest = document.getElementById('hud-best');
  const hudTime = document.getElementById('hud-time');
  const hudTimeWrap = document.getElementById('hud-time-wrap');
  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const btnAgain = document.getElementById('btn-again');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalSub = document.getElementById('modal-sub');
  const rScore = document.getElementById('r-score');
  const rBest = document.getElementById('r-best');
  const rBestItem = document.getElementById('r-best-item');
  const rCombo = document.getElementById('r-combo');
  const toast = document.getElementById('toast');
  const hammer = document.getElementById('hammer');
  const hammerInner = document.getElementById('hammer-inner');

  // ===== 状态 =====
  const state = {
    phase: 'idle',        // idle | countdown | playing | over
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    best: 0,              // 展示用最高分（本局可能实时刷新）
    storedBest: 0,        // 已持久化的最高分
    timeLeft: TOTAL_TIME,
    countdownT: 0,
    countdownStep: -1,
    spawnT: 0,
    lastTs: 0,
  };

  const holes = [];

  // ===== 工具 =====
  function rand(min, max) { return min + Math.random() * (max - min); }
  function currentMult(c) { return c >= COMBO_X3 ? 3 : c >= COMBO_X2 ? 2 : 1; }
  function retrigger(el, cls) {
    el.classList.remove('pop', 'break');
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ===== 构建 3×3 洞口 =====
  const HOLE_HTML = [
    '<div class="pit"></div>',
    '<div class="hole-mask">',
    '  <div class="mole">',
    '    <div class="ear ear-l"></div><div class="ear ear-r"></div>',
    '    <div class="eye eye-l"></div><div class="eye eye-r"></div>',
    '    <div class="snout"><div class="nose"></div><div class="mouth"></div></div>',
    '    <div class="paw paw-l"></div><div class="paw paw-r"></div>',
    '    <div class="dizzy">😵</div>',
    '  </div>',
    '</div>',
    '<div class="rim"></div>',
  ].join('');

  for (let i = 0; i < HOLE_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'hole';
    el.dataset.index = String(i);
    el.innerHTML = HOLE_HTML;
    board.appendChild(el);
    holes.push({ el: el, mole: el.querySelector('.mole'), state: 'hidden', t: 0, stay: 0 });
  }

  // ===== 洞口状态机：hidden → up → (hit) → leaving → hidden =====
  function setHoleState(h, s) {
    h.state = s;
    h.t = 0;
    h.mole.classList.remove('up', 'down', 'hit');
    if (s === 'up') h.mole.classList.add('up');
    else if (s === 'leaving') h.mole.classList.add('down');
    else if (s === 'hit') h.mole.classList.add('up', 'hit');
  }

  function updateHoles(dt) {
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      if (h.state === 'hidden') continue;
      h.t += dt;
      if (h.state === 'up' && h.t >= h.stay) setHoleState(h, 'leaving');
      else if (h.state === 'leaving' && h.t >= 0.2) setHoleState(h, 'hidden');
      else if (h.state === 'hit' && h.t >= 0.32) setHoleState(h, 'leaving');
    }
  }

  // 地鼠冒头：停留 0.6~1.4 秒，随时间推移越来越快
  function spawnMole(diff) {
    const free = [];
    for (let i = 0; i < holes.length; i++) {
      if (holes[i].state === 'hidden') free.push(holes[i]);
    }
    if (!free.length) return;
    const h = free[Math.floor(Math.random() * free.length)];
    const minStay = 0.6 + 0.3 * (1 - diff);
    const maxStay = 1.4 - 0.5 * diff;
    h.stay = rand(minStay, maxStay);
    setHoleState(h, 'up');
  }

  // ===== HUD =====
  function updateScoreHud() {
    hudScore.textContent = state.score;
    retrigger(hudScore, 'pop');
    if (state.score > state.best) {
      state.best = state.score;
      hudBest.textContent = state.best;
      hudBest.classList.add('best-new');
    }
  }

  function updateComboHud(broke) {
    hudCombo.textContent = state.combo;
    const m = currentMult(state.combo);
    hudMult.textContent = '×' + m;
    hudMult.classList.toggle('x2', m === 2);
    hudMult.classList.toggle('x3', m === 3);
    retrigger(hudCombo, broke ? 'break' : 'pop');
  }

  function updateTimeHud() {
    hudTime.textContent = Math.max(0, state.timeLeft).toFixed(1);
    const urgent = state.phase === 'playing' && state.timeLeft <= 10;
    hudTimeWrap.classList.toggle('danger', urgent);
    board.classList.toggle('urgent', urgent);
  }

  let toastTimer = 0;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }

  // ===== 特效（结束后自动清理） =====
  function makeFx(parent, className) {
    const d = document.createElement('div');
    d.className = className;
    d.dataset.fx = '1';
    parent.appendChild(d);
    return d;
  }

  function spawnHitFx(holeEl, gain) {
    makeFx(holeEl, 'fx-score g' + gain).textContent = '+' + gain;
    makeFx(holeEl, 'fx-ring');
    for (let i = 0; i < 6; i++) {
      const st = makeFx(holeEl, 'fx-star');
      st.textContent = '✦';
      const ang = rand(0, Math.PI * 2);
      const dist = rand(34, 62);
      st.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      st.style.setProperty('--dy', (Math.sin(ang) * dist - 20).toFixed(1) + 'px');
      st.style.setProperty('--rot', Math.floor(Math.random() * 360) + 'deg');
    }
  }

  function spawnMissFx(x, y) {
    const m = makeFx(board, 'fx-miss');
    m.textContent = '落空';
    m.style.left = x + 'px';
    m.style.top = y + 'px';
  }

  board.addEventListener('animationend', function (e) {
    const t = e.target;
    if (t && t.dataset && t.dataset.fx) t.remove();
  });

  function clearFx() {
    const list = board.querySelectorAll('[data-fx]');
    for (let i = 0; i < list.length; i++) list[i].remove();
  }

  // ===== 命中 / 落空 =====
  function hitMole(h) {
    state.combo += 1;
    state.hits += 1;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    const mult = currentMult(state.combo);
    state.score += mult;
    setHoleState(h, 'hit');
    updateScoreHud();
    updateComboHud(false);
    spawnHitFx(h.el, mult);
    if (state.combo === COMBO_X2) showToast('🔥 连击 ×2，火力升级！');
    else if (state.combo === COMBO_X3) showToast('⚡ 连击 ×3，火力全开！');
  }

  function missAt(e) {
    if (state.combo > 0) {
      state.combo = 0;
      updateComboHud(true);
    }
    const rect = board.getBoundingClientRect();
    spawnMissFx(e.clientX - rect.left, e.clientY - rect.top);
  }

  board.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (state.phase !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    const moleEl = target.closest('.mole');
    const holeEl = target.closest('.hole');
    if (moleEl && holeEl) {
      const h = holes[Number(holeEl.dataset.index)];
      if (h && (h.state === 'up' || h.state === 'leaving')) {
        hitMole(h);
        return;
      }
      if (h && h.state === 'hit') return; // 已被击中的眩晕地鼠：连点不惩罚
    }
    missAt(e);
  });

  board.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ===== 回合流程 =====
  function startRound() {
    modal.classList.remove('show');
    clearFx();
    for (let i = 0; i < holes.length; i++) setHoleState(holes[i], 'hidden');
    state.phase = 'countdown';
    state.countdownT = 0;
    state.countdownStep = -1;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.hits = 0;
    state.timeLeft = TOTAL_TIME;
    state.spawnT = 0.2;
    hudScore.textContent = '0';
    hudCombo.textContent = '0';
    hudMult.textContent = '×1';
    hudMult.classList.remove('x2', 'x3');
    hudBest.classList.remove('best-new');
    hudBest.textContent = state.best;
    updateTimeHud();
    overlay.classList.remove('hidden', 'idle');
    overlayText.classList.remove('count', 'go');
    btnStart.textContent = '重新开始';
  }

  function updateCountdown(dt) {
    state.countdownT += dt;
    const steps = ['3', '2', '1', '敲!'];
    const idx = Math.min(Math.floor(state.countdownT / COUNTDOWN_STEP), steps.length - 1);
    if (idx !== state.countdownStep) {
      state.countdownStep = idx;
      overlayText.classList.remove('count', 'go');
      void overlayText.offsetWidth;
      overlayText.textContent = steps[idx];
      overlayText.classList.add('count');
      if (idx === 3) overlayText.classList.add('go');
    }
    if (state.countdownT >= COUNTDOWN_TOTAL) {
      overlay.classList.add('hidden');
      state.phase = 'playing';
      state.spawnT = 0.15;
    }
  }

  function endGame() {
    state.phase = 'over';
    updateTimeHud();
    const isNewBest = state.score > state.storedBest;
    if (isNewBest) {
      state.storedBest = state.score;
      try {
        localStorage.setItem(BEST_KEY, String(state.storedBest));
      } catch (err) { /* 存储不可用时忽略 */ }
    }
    modalTitle.textContent = isNewBest ? '🏆 新纪录！' : '⏱ 时间到！';
    modalSub.textContent = '共敲中 ' + state.hits + ' 只地鼠';
    rScore.textContent = state.score;
    rBest.textContent = state.storedBest;
    rBestItem.classList.toggle('is-new', isNewBest);
    rCombo.textContent = state.maxCombo;
    modal.classList.add('show');
    btnStart.textContent = '再来一局';
    hammer.classList.remove('show');
  }

  function updatePlaying(dt) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      updateTimeHud();
      endGame();
      return;
    }
    updateTimeHud();
    const diff = 1 - state.timeLeft / TOTAL_TIME; // 难度 0 → 1
    state.spawnT -= dt;
    if (state.spawnT <= 0) {
      spawnMole(diff);
      // 后半程概率同时冒出第二只
      if (diff > 0.4 && Math.random() < 0.2 + diff * 0.25) spawnMole(diff);
      state.spawnT = rand(0.5, 0.9) * (1 - 0.45 * diff);
    }
  }

  // ===== 主循环：requestAnimationFrame + 帧时间差 =====
  function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min((ts - state.lastTs) / 1000, 0.05);
    state.lastTs = ts;
    if (state.phase === 'countdown') updateCountdown(dt);
    else if (state.phase === 'playing') updatePlaying(dt);
    if (state.phase !== 'idle') updateHoles(dt);
    requestAnimationFrame(loop);
  }

  // ===== 小锤：跟随指针 + 敲击旋转 =====
  function overGameCard(e) {
    return e.target instanceof Element && !!e.target.closest('.game-card');
  }

  function moveHammer(e) {
    hammer.style.transform = 'translate(' + (e.clientX + 34) + 'px, ' + (e.clientY - 40) + 'px)';
  }

  function swingHammer() {
    hammerInner.classList.remove('swing');
    void hammerInner.offsetWidth;
    hammerInner.classList.add('swing');
  }

  window.addEventListener('pointermove', function (e) {
    moveHammer(e);
    hammer.classList.toggle('show', overGameCard(e));
  }, { passive: true });

  window.addEventListener('pointerdown', function (e) {
    moveHammer(e);
    const onCard = overGameCard(e);
    hammer.classList.toggle('show', onCard);
    if (onCard) swingHammer();
  });

  window.addEventListener('pointerup', function (e) {
    if (e.pointerType === 'touch') hammer.classList.remove('show');
  });
  window.addEventListener('pointercancel', function () { hammer.classList.remove('show'); });
  window.addEventListener('blur', function () { hammer.classList.remove('show'); });
  document.documentElement.addEventListener('mouseleave', function () { hammer.classList.remove('show'); });

  // ===== 入口 =====
  btnStart.addEventListener('click', startRound);
  btnRestart.addEventListener('click', startRound);
  btnAgain.addEventListener('click', startRound);

  overlay.addEventListener('click', function () {
    if (state.phase === 'idle') startRound();
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      startRound();
    }
  });

  // 初始化最高分
  try {
    const saved = parseInt(localStorage.getItem(BEST_KEY), 10);
    state.storedBest = Number.isFinite(saved) ? Math.max(0, saved) : 0;
  } catch (err) {
    state.storedBest = 0;
  }
  state.best = state.storedBest;
  hudBest.textContent = state.best;

  requestAnimationFrame(loop);
})();
