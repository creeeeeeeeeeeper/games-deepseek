(() => {
  'use strict';

  /* ================= 配置 ================= */
  const COLS = 4;
  const BOARD_W = 480;                  // 棋盘逻辑宽
  const BOARD_H = 640;                  // 棋盘逻辑高
  const COL_W = BOARD_W / COLS;         // 单轨道宽 120
  const TILE_H = 120;                   // 黑块高度
  const TILE_PAD = 7;                   // 黑块在轨道内的横向留白
  const ROW_PITCH = 174;                // 相邻两行黑块的纵向间距
  const ZONE_H = 150;                   // 判定区高度
  const HZ_TOP = BOARD_H - ZONE_H;      // 判定区上沿 y = 490
  const MISS_Y = BOARD_H - 24;          // 黑块顶部越过该 y 即判定溜出（616）
  const NOTES = [523.25, 587.33, 659.25, 698.46]; // C5 D5 E5 F5 简单音阶
  const KEY_MAP = { a: 0, s: 1, d: 2, f: 3 };
  const BEST_KEY = 'piano-best';
  const MUTE_KEY = 'piano-muted';
  const LEVEL_EVERY = 12;               // 每多少分提升一档速度
  const MAX_LEVEL = 9;
  const BASE_SPEED = 250;               // Lv.1 下落速度（px/s）
  const SPEED_STEP = 30;                // 每档加速度
  const HIT_FX_MS = 430;                // 被消除黑块的淡出时长
  const FAIL_HOLD_MS = 950;             // 失败后定格多久再弹结算框

  /* ================= DOM ================= */
  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const trackEl = $('track');
  const fxEl = $('fx');
  const overlayEl = $('overlay');
  const countdownEl = $('countdown');
  const cdNumEl = $('cdNum');
  const milestoneEl = $('milestone');
  const msgEl = $('msg');
  const modalEl = $('overModal');
  const boardOuterEl = $('boardOuter');
  const scalerEl = $('scaler');
  const hudScore = $('hudScore');
  const hudBest = $('hudBest');
  const hudCombo = $('hudCombo');
  const hudMaxCombo = $('hudMaxCombo');
  const hudSpeed = $('hudSpeed');
  const speedFillEl = $('speedFill');
  const statScore = $('statScore');
  const statBest = $('statBest');
  const statCombo = $('statCombo');
  const statSpeed = $('statSpeed');
  const overTitleEl = $('overTitle');
  const overSubEl = $('overSub');
  const startBtn = $('startBtn');
  const againBtn = $('againBtn');
  const restartBtn = $('restartBtn');
  const muteBtn = $('muteBtn');

  const keyBtns = new Map();
  const keyHints = new Map();
  const colEls = new Map();
  document.querySelectorAll('.pt-key').forEach((el) => keyBtns.set(el.dataset.col, el));
  document.querySelectorAll('.pt-keyhint').forEach((el) => keyHints.set(el.dataset.col, el));
  document.querySelectorAll('.pt-col').forEach((el) => colEls.set(el.dataset.col, el));

  /* ================= 状态 ================= */
  let state = 'idle';        // idle | countdown | playing | failing | over
  let rows = [];             // 未消除的黑块（下标 0 = 最上方，末尾 = 最靠下）
  let fxRows = [];           // 已消除、等待淡出的黑块
  let trash = [];            // 延迟清理的特效元素
  let lastCols = [];         // 近期生成列，用于避免同一列连续 3 次
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let level = 1;
  let best = 0;
  let muted = false;
  let newRecord = false;
  let failReason = '';
  let spawnY = 0;            // 下一个生成槽位的 y（随场地下落）
  let cdTime = 0;
  let cdLabel = '';
  let failAt = 0;
  let lastT = performance.now();

  const speedNow = () => BASE_SPEED + (level - 1) * SPEED_STEP;

  /* ================= 本地存储（安全封装） ================= */
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* 忽略 */ } }
  };

  /* ================= WebAudio 合成音效 ================= */
  let ac = null;
  let master = null;

  function ensureAudio() {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.5;
        master.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) {
      ac = null;
      master = null;
    }
  }

  function tone(freq, opts) {
    if (muted || !ac) return;
    const o = opts || {};
    const dur = o.dur || 0.25;
    const type = o.type || 'triangle';
    const vol = o.vol == null ? 0.4 : o.vol;
    const delay = o.delay || 0;
    try {
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) { /* 忽略 */ }
  }

  // 消除：四列对应四个音高（附加一倍频泛音增加亮度）
  function playTileNote(col) {
    ensureAudio();
    tone(NOTES[col], { dur: 0.3, vol: 0.5 });
    tone(NOTES[col] * 2, { dur: 0.2, vol: 0.12, type: 'sine' });
  }
  // 失败：低沉下坠的双锯齿波
  function playFail() {
    ensureAudio();
    tone(196, { dur: 0.55, vol: 0.4, type: 'sawtooth', slide: 70 });
    tone(98, { dur: 0.6, vol: 0.3, type: 'sawtooth', slide: 46 });
  }
  // 连击里程碑：上行琶音
  function playMilestone() {
    ensureAudio();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { delay: i * 0.07, dur: 0.18, vol: 0.3 }));
  }
  // 升档：轻快双音
  function playLevelUp() {
    ensureAudio();
    tone(880, { dur: 0.12, vol: 0.2 });
    tone(1174.66, { delay: 0.09, dur: 0.16, vol: 0.2 });
  }
  // 倒计时哔声（GO 音更高）
  function playCountdown(go) {
    ensureAudio();
    tone(go ? 1046.5 : 660, { dur: go ? 0.22 : 0.09, vol: 0.18, type: 'square' });
  }

  /* ================= 工具 ================= */
  function retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // 强制回流以重启动画
    el.classList.add(cls);
  }

  function setMsg(text, cls) {
    msgEl.textContent = text;
    msgEl.classList.remove('win', 'lose');
    if (cls) msgEl.classList.add(cls);
    retrigger(msgEl, 'pt-pop');
  }

  /* ================= HUD ================= */
  function updateHUD() {
    hudScore.textContent = score;
    hudBest.textContent = Math.max(best, score);
    hudBest.classList.toggle('beating', score > 0 && score > best);
    hudCombo.textContent = combo;
    hudMaxCombo.textContent = maxCombo;
    hudSpeed.textContent = 'Lv.' + level;
    const maxed = level >= MAX_LEVEL;
    speedFillEl.classList.toggle('maxed', maxed);
    speedFillEl.style.width = (maxed ? 100 : ((score % LEVEL_EVERY) / LEVEL_EVERY) * 100) + '%';
  }

  /* ================= 黑块生成 ================= */
  function pickCol() {
    let c = Math.floor(Math.random() * COLS);
    const n = lastCols.length;
    if (n >= 2 && lastCols[n - 1] === c && lastCols[n - 2] === c) {
      c = (c + 1 + Math.floor(Math.random() * (COLS - 1))) % COLS;
    }
    lastCols.push(c);
    if (lastCols.length > 4) lastCols.shift();
    return c;
  }

  function spawnRow(y) {
    const col = pickCol();
    const rowEl = document.createElement('div');
    rowEl.className = 'pt-row';
    rowEl.style.left = (col * COL_W + TILE_PAD) + 'px';
    rowEl.style.width = (COL_W - TILE_PAD * 2) + 'px';
    rowEl.style.height = TILE_H + 'px';
    rowEl.style.transform = 'translateY(' + y + 'px)';
    const tileEl = document.createElement('div');
    tileEl.className = 'pt-tile';
    rowEl.appendChild(tileEl);
    trackEl.appendChild(rowEl);
    rows.unshift({ el: rowEl, y, col }); // 新块插到头部，末尾始终是最靠下的
  }

  /* ================= 特效 ================= */
  function spawnFloat(row, text) {
    const el = document.createElement('div');
    el.className = 'pt-float';
    el.textContent = text;
    el.style.left = (row.col * COL_W + COL_W / 2) + 'px';
    el.style.top = (row.y + TILE_H / 2) + 'px';
    fxEl.appendChild(el);
    trash.push({ el, at: performance.now() + 780 });
  }

  function spawnParticles(row) {
    const now = performance.now();
    const cx = row.col * COL_W + COL_W / 2;
    const cy = row.y + TILE_H / 2;
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('i');
      p.className = 'pt-p';
      const a = Math.random() * Math.PI * 2;
      const d = 42 + Math.random() * 52;
      p.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(a) * d - 18).toFixed(1) + 'px');
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.background = i % 2 ? 'var(--accent-2, #34d399)' : 'var(--accent, #3aa0ff)';
      p.style.animationDelay = Math.floor(Math.random() * 60) + 'ms';
      fxEl.appendChild(p);
      trash.push({ el: p, at: now + 820 });
    }
  }

  function showMilestone() {
    milestoneEl.textContent = combo + ' 连击 · 奖励 +5 分！';
    retrigger(milestoneEl, 'show');
  }

  function keyPop(col) {
    const k = keyBtns.get(String(col));
    if (k) retrigger(k, 'pressed');
    const h = keyHints.get(String(col));
    if (h) retrigger(h, 'active');
  }

  /* ================= 核心玩法 ================= */
  // 按下某列：消除该列在判定区内最靠下的黑块；判定区内没有该列黑块则失败
  function press(col) {
    if (state !== 'playing') return;
    let target = null;
    let lowestInWindow = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.y + TILE_H <= HZ_TOP) break; // 该块及以上都不在判定区
      if (!lowestInWindow) lowestInWindow = r;
      if (r.col === col) { target = r; break; }
    }
    if (target) hit(target);
    else if (lowestInWindow) fail('wrong', lowestInWindow, col);
    else fail('empty', null, col);
  }

  function hit(row) {
    const idx = rows.indexOf(row);
    if (idx >= 0) rows.splice(idx, 1);
    row.el.classList.add('hit');
    fxRows.push({ el: row.el, y: row.y, dieAt: performance.now() + HIT_FX_MS });

    combo += 1;
    if (combo > maxCombo) maxCombo = combo;
    score += 1;
    const milestone = combo % 10 === 0; // 每 10 连击额外 +5
    if (milestone) score += 5;

    const lv = Math.min(MAX_LEVEL, 1 + Math.floor(score / LEVEL_EVERY));
    if (lv > level) {
      level = lv;
      playLevelUp();
      retrigger(speedFillEl, 'bump');
    }

    playTileNote(row.col);
    spawnFloat(row, '+1');
    spawnParticles(row);
    const cel = colEls.get(String(row.col));
    if (cel) retrigger(cel, 'goodflash');

    if (milestone) {
      playMilestone();
      showMilestone();
      setMsg('🎉 ' + combo + ' 连击！奖励 +5 分', 'win');
    }
    updateHUD();
  }

  function fail(reason, row, col) {
    if (state !== 'playing') return;
    state = 'failing';
    failReason = reason;
    failAt = performance.now();

    if (row) {
      row.el.classList.add('fail');
      const cel = colEls.get(String(row.col));
      if (cel) retrigger(cel, 'badflash');
    }
    if (reason !== 'miss') {
      const cel = colEls.get(String(col));
      if (cel) retrigger(cel, 'badflash');
    }
    retrigger(boardEl, 'shake');
    playFail();

    newRecord = score > best && score > 0;
    if (newRecord) {
      best = score;
      store.set(BEST_KEY, String(best));
    }
    setMsg(reason === 'miss' ? '💨 黑块溜走了…' : '❌ 打错位置了…', 'lose');
    updateHUD();
  }

  function showOver() {
    state = 'over';
    statScore.textContent = score;
    statBest.textContent = best;
    statCombo.textContent = maxCombo;
    statSpeed.textContent = 'Lv.' + level;
    const box = statBest.closest('.pt-stat');
    if (box) box.classList.toggle('newrec', newRecord);
    const titles = {
      miss: '💨 黑块溜走了！',
      wrong: '❌ 打错列了！',
      empty: '⚪ 打到了空位！'
    };
    overTitleEl.textContent = titles[failReason] || '游戏结束';
    overSubEl.textContent = newRecord
      ? '🎉 新纪录诞生！你就是今晚最闪亮的节奏之星！'
      : '差一点点就破纪录了 —— 最高 ' + best + ' 分，再来一把！';
    modalEl.classList.add('show');
  }

  /* ================= 每帧更新 ================= */
  function updateGame(dt) {
    const dy = speedNow() * dt;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      r.y += dy;
      r.el.style.transform = 'translateY(' + r.y + 'px)';
    }
    for (let i = 0; i < fxRows.length; i++) {
      const r = fxRows[i];
      r.y += dy;
      r.el.style.transform = 'translateY(' + r.y + 'px)';
    }

    // 生成槽位随场地下落，跌出安全线就补一个新块（与消除无关，稳定节奏）
    spawnY += dy;
    while (spawnY > -ROW_PITCH) {
      spawnRow(spawnY - ROW_PITCH);
      spawnY -= ROW_PITCH;
    }

    // 溜出底部判定失败
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].y > MISS_Y) {
        fail('miss', rows[i], rows[i].col);
        return;
      }
    }
  }

  function updateCountdown(dt) {
    cdTime -= dt;
    let label;
    if (cdTime > 2.3) label = '3';
    else if (cdTime > 1.4) label = '2';
    else if (cdTime > 0.5) label = '1';
    else label = 'GO!';
    if (label !== cdLabel) {
      cdLabel = label;
      cdNumEl.textContent = label;
      cdNumEl.classList.toggle('go', label === 'GO!');
      retrigger(cdNumEl, 'pop');
      playCountdown(label === 'GO!');
    }
    if (cdTime <= 0) {
      countdownEl.classList.remove('on');
      startPlay();
    }
  }

  function sweep(now) {
    for (let i = trash.length - 1; i >= 0; i--) {
      if (now >= trash[i].at) {
        trash[i].el.remove();
        trash.splice(i, 1);
      }
    }
    for (let i = fxRows.length - 1; i >= 0; i--) {
      if (now >= fxRows[i].dieAt) {
        fxRows[i].el.remove();
        fxRows.splice(i, 1);
      }
    }
  }

  function frame(t) {
    requestAnimationFrame(frame);
    let dt = (t - lastT) / 1000;
    lastT = t;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.05) dt = 0.05; // 切后台回来不跳帧
    if (state === 'countdown') updateCountdown(dt);
    else if (state === 'playing') updateGame(dt);
    else if (state === 'failing' && t - failAt >= FAIL_HOLD_MS) showOver();
    sweep(t);
  }

  /* ================= 流程控制 ================= */
  function resetGame() {
    rows.length = 0;
    fxRows.length = 0;
    trash.length = 0;
    lastCols.length = 0;
    trackEl.innerHTML = '';
    fxEl.innerHTML = '';
    colEls.forEach((el) => el.classList.remove('goodflash', 'badflash'));
    milestoneEl.classList.remove('show');
    boardEl.classList.remove('shake');
    score = 0;
    combo = 0;
    maxCombo = 0;
    level = 1;
    newRecord = false;
    failReason = '';
    spawnY = ROW_PITCH - TILE_H - 8; // 首块恰好从棋盘上方入场
    updateHUD();
  }

  function beginCountdown() {
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) {
      document.activeElement.blur(); // 防止空格键误触发聚焦按钮
    }
    resetGame();
    overlayEl.classList.remove('on');
    modalEl.classList.remove('show');
    countdownEl.classList.add('on');
    cdTime = 3.2;
    cdLabel = '';
    state = 'countdown';
    setMsg('准备…', '');
  }

  function startPlay() {
    state = 'playing';
    setMsg('跟上节奏，一个黑块都别放过！', '');
  }

  /* ================= 静音开关 ================= */
  function toggleMute() {
    muted = !muted;
    store.set(MUTE_KEY, muted ? '1' : '0');
    muteBtn.textContent = muted ? '🔇 已静音' : '🔊 音效开';
    if (!muted) {
      ensureAudio();
      tone(783.99, { dur: 0.12, vol: 0.22 });
    }
  }

  /* ================= 等比缩放（固定 480×640 逻辑尺寸） ================= */
  function fitBoard() {
    const w = boardOuterEl.clientWidth;
    if (!w) return;
    const s = w >= BOARD_W ? 1 : w / BOARD_W;
    scalerEl.style.transform = 'translateX(-50%) scale(' + s + ')';
    boardOuterEl.style.height = Math.round(BOARD_H * s) + 'px';
  }

  /* ================= 事件绑定 ================= */
  startBtn.addEventListener('click', () => { ensureAudio(); beginCountdown(); });
  againBtn.addEventListener('click', beginCountdown);
  restartBtn.addEventListener('click', beginCountdown);
  muteBtn.addEventListener('click', toggleMute);

  boardEl.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return; // 仅主键
    if (state !== 'playing') return;
    e.preventDefault();
    const rect = boardEl.getBoundingClientRect();
    if (!rect.width) return;
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(((e.clientX - rect.left) / rect.width) * COLS)));
    keyPop(col);
    press(col);
  });

  keyBtns.forEach((btn, colStr) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const col = Number(colStr);
      keyPop(col);
      press(col);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(KEY_MAP, k)) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      keyPop(KEY_MAP[k]);
      press(KEY_MAP[k]);
    } else if (k === 'r') {
      e.preventDefault();
      beginCountdown();
    } else if (k === 'm') {
      toggleMute();
    } else if (k === 'enter' || k === ' ') {
      if (state === 'idle' || state === 'over') {
        e.preventDefault();
        beginCountdown();
      }
    }
  });

  window.addEventListener('resize', fitBoard);

  /* ================= 初始化 ================= */
  best = parseInt(store.get(BEST_KEY) || '0', 10) || 0;
  muted = store.get(MUTE_KEY) === '1';
  muteBtn.textContent = muted ? '🔇 已静音' : '🔊 音效开';
  updateHUD();
  setMsg('点击「开始游戏」，接住落进判定区的黑块！', '');
  fitBoard();
  requestAnimationFrame(fitBoard); // 布局稳定后再校一次
  requestAnimationFrame(frame);
})();
