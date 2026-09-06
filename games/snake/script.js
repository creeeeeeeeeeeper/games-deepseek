'use strict';
/* ============================================================
   贪吃蛇 · 经典单机单人版
   - 20×20 逻辑网格，480×480 固定逻辑画布（CSS 等比缩放显示）
   - requestAnimationFrame + 帧时间差驱动，固定步长计时
   - 平滑爬行：身体沿蛇头轨迹按时间延迟跟随（弯道圆滑、无拉扯）
   - 吃食物：得分 +10、每 5 个食物提速一档、粒子迸发 + 长度脉冲
   - 撞墙 / 撞自己：棋盘震动 + 红色闪烁提示
   ============================================================ */
(() => {
  /* ---------------- 常量 ---------------- */
  const COLS = 20, ROWS = 20;
  const CELL = 24;
  const SIZE = COLS * CELL;            // 480 逻辑尺寸
  const TAU = Math.PI * 2;
  const BASE_T = 150, MIN_T = 58;      // 基础步长(ms) / 最快步长(ms)
  const TIER_FOODS = 5;                // 每 5 个食物提速一档
  const BEST_KEY = 'snake-best';
  const COUNTDOWN_MS = 990;            // 开局 3-2-1 倒计时时长
  const DYING_MS = 760;                // 失败动画时长

  const DIRS = {
    up:    { x: 0, y: -1 },
    down:  { x: 0, y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const DEFAULT_DIR = DIRS.right;

  /* ---------------- DOM ---------------- */
  const $ = (id) => document.getElementById(id);
  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  const wrap = $('boardWrap');
  const hudScore = $('hudScore'), hudBest = $('hudBest');
  const hudLen = $('hudLen'), hudTier = $('hudTier');
  const pauseBtn = $('pauseBtn'), restartBtn = $('restartBtn');
  const modal = $('resultModal'), modalTitle = $('modalTitle');
  const modalSub = $('modalSub'), modalMsg = $('modalMsg');
  const againBtn = $('againBtn');

  /* ---------------- 调色板（与深色主题协调） ---------------- */
  const BG_A = '#0b1220', BG_B = '#101b30';            // 棋盘两色
  const GRID_LINE = 'rgba(148,163,184,0.08)';
  const HEAD_RGB = [74, 238, 138];                     // 蛇头亮绿
  const TAIL_RGB = [10, 108, 62];                      // 蛇尾深绿
  const UNDERLAY = 'rgba(8,84,50,0.9)';
  const FOOD_HI = '#fff3c0';                         // 食物高光
  const TEXT = '#e8eef7', MUTED = '#8fa3bd';
  const OVERLAY = 'rgba(5,9,18,0.52)';
  const FONT = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

  /* ---------------- 游戏状态 ---------------- */
  const S = {
    state: 'idle',        // idle | ready | run | paused | dying | over | win
    dir: { ...DEFAULT_DIR },
    pending: null,
    cells: [],            // [{x,y}] cells[0] 为蛇头
    food: null,
    trail: [],            // 蛇头轨迹路点 {x,y(px),t(相对运行起点 ms)}
    acc: 0,               // 距下一次 tick 已累计的 ms
    lastTick: 0,          // 最近一次 tick 的相对时间(ms)
    T: BASE_T,            // 当前步长(ms)
    score: 0,
    eats: 0,
    tier: 1,
    pulse: 0,             // 吃到食物后蛇身脉冲(0~1，衰减)
    winGlow: 0,           // 胜利绿光(0~1，衰减)
    particles: [],
    floats: [],
    readyStart: 0,
    dyingStart: 0,
    initialBest: 0,
    best: 0,
    newBest: false
  };

  const MOVING_STATES = { run: 1, paused: 1, dying: 1 };

  /* ---------------- 工具 ---------------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const centerX = (c) => c.x * CELL + CELL / 2;
  const centerY = (c) => c.y * CELL + CELL / 2;
  const rgbStr = (arr) => `rgb(${arr[0] | 0},${arr[1] | 0},${arr[2] | 0})`;

  function bodyColor(t) {
    const r = Math.round(lerp(HEAD_RGB[0], TAIL_RGB[0], t));
    const g = Math.round(lerp(HEAD_RGB[1], TAIL_RGB[1], t));
    const b = Math.round(lerp(HEAD_RGB[2], TAIL_RGB[2], t));
    return `rgb(${r},${g},${b})`;
  }

  function saveBest() {
    try { localStorage.setItem(BEST_KEY, String(S.best)); } catch (e) { /* 隐私模式等忽略 */ }
  }

  function loadBest() {
    try {
      const v = parseInt(localStorage.getItem(BEST_KEY), 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  }

  /* ---------------- HUD ---------------- */
  function syncHud() {
    hudScore.textContent = String(S.score);
    hudBest.textContent = String(S.best);
    hudLen.textContent = String(S.cells.length);
    hudTier.textContent = String(S.tier);
  }

  function popScore() {
    hudScore.classList.remove('pop');
    void hudScore.offsetWidth;          // 强制重排以重启动画
    hudScore.classList.add('pop');
  }

  function syncButtons() {
    const canPause = S.state === 'run' || S.state === 'paused';
    pauseBtn.disabled = !canPause;
    pauseBtn.textContent = S.state === 'paused' ? '▶ 继续' : '⏸ 暂停';
  }

  /* ---------------- 生成食物 ---------------- */
  function spawnFood() {
    const occupied = new Set();
    for (const c of S.cells) occupied.add(c.x * COLS + c.y);
    const free = [];
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!occupied.has(x * COLS + y)) free.push({ x, y });
      }
    }
    if (!free.length) return null;
    return free[(Math.random() * free.length) | 0];
  }

  /* ---------------- 粒子 / 飘字 ---------------- */
  function burstParticles(px, py) {
    const colors = ['#ffd86b', '#6df5a8', '#ffb23e', '#ffffff'];
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * TAU;
      const sp = 50 + Math.random() * 130;
      S.particles.push({
        x: px, y: py,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.35 + Math.random() * 0.45,
        max: 0.8,
        size: 1.6 + Math.random() * 2.2,
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  }

  function addFloat(px, py, text, color) {
    S.floats.push({ x: px, y: py, text, color, life: 0.85, max: 0.85 });
  }

  function updateFx(dt) {
    if (S.state === 'paused') return;
    S.pulse = Math.max(0, S.pulse - dt * 0.0035);
    S.winGlow = Math.max(0, S.winGlow - dt * 0.002);
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.life -= dt / 1000;
      if (p.life <= 0) { S.particles.splice(i, 1); continue; }
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
    }
    for (let i = S.floats.length - 1; i >= 0; i--) {
      const f = S.floats[i];
      f.life -= dt / 1000;
      f.y -= dt * 0.05;
      if (f.life <= 0) S.floats.splice(i, 1);
    }
  }

  /* ---------------- 轨迹查询（身体平滑跟随） ---------------- */
  function trailPoint(target) {
    const W = S.trail;
    if (!W.length) return null;
    if (target <= W[0].t) return W[0];
    if (target >= W[W.length - 1].t) return W[W.length - 1];
    let lo = 0, hi = W.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (W[mid].t < target) lo = mid; else hi = mid;
    }
    const a = W[lo], b = W[hi];
    const f = (target - a.t) / (b.t - a.t || 1);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  /* ---------------- 开局 / 重置 ---------------- */
  function buildSnake(dir) {
    const cells = [];
    const head = { x: 10, y: 10 };
    for (let i = 0; i < 3; i++) {
      cells.push({ x: head.x - dir.x * i, y: head.y - dir.y * i });
    }
    return cells;
  }

  function resetGame(dir) {
    clearShake();
    S.dir = { x: dir.x, y: dir.y };
    S.pending = null;
    S.cells = buildSnake(dir);
    S.trail = [];
    S.acc = 0;
    S.lastTick = 0;
    S.T = BASE_T;
    S.score = 0;
    S.eats = 0;
    S.tier = 1;
    S.pulse = 0;
    S.winGlow = 0;
    S.particles = [];
    S.floats = [];
    S.newBest = false;
    S.food = spawnFood();
    syncHud();
  }

  function beginRun() {
    S.state = 'run';
    S.acc = 0;
    S.lastTick = 0;
    S.trail = [];
    // 播种初始轨迹：身体各段是蛇头在 -(j·T) 时刻的位置
    const T = S.T;
    for (let j = S.cells.length - 1; j >= 0; j--) {
      const c = S.cells[j];
      S.trail.push({ x: centerX(c), y: centerY(c), t: -j * T });
    }
    syncButtons();
  }

  function startCountdown() {
    S.state = 'ready';
    S.readyStart = performance.now();
    syncButtons();
  }

  function startGame(dir) {
    resetGame(dir);
    startCountdown();
  }

  function restartGame() {
    hideModal();
    startGame(DEFAULT_DIR);
    const el = document.activeElement;
    if (el && typeof el.blur === 'function') el.blur();   // 防止 Space 误触已隐藏按钮
  }

  /* ---------------- 主步进逻辑 ---------------- */
  function step() {
    if (S.pending) {
      const d = S.pending;
      if (!(d.x === -S.dir.x && d.y === -S.dir.y)) S.dir = d;   // 不允许直接反向
      S.pending = null;
    }
    const h = S.cells[0];
    const nx = h.x + S.dir.x;
    const ny = h.y + S.dir.y;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { die(); return; }   // 撞墙

    const ate = !!S.food && S.food.x === nx && S.food.y === ny;
    // 吃到食物时尾巴原地不动，因此尾巴也视为不可穿越
    const checkLen = S.cells.length - (ate ? 0 : 1);
    for (let i = 0; i < checkLen; i++) {
      const c = S.cells[i];
      if (c.x === nx && c.y === ny) { die(); return; }                     // 撞自己
    }

    S.cells.unshift({ x: nx, y: ny });
    if (!ate) S.cells.pop(); else eatAt({ x: nx, y: ny });

    // 记录轨迹路点（供身体平滑跟随）
    S.trail.push({ x: nx * CELL + CELL / 2, y: ny * CELL + CELL / 2, t: S.lastTick });
    while (S.trail.length > S.cells.length + 14) S.trail.shift();
  }

  function eatAt(head) {
    S.score += 10;
    S.eats += 1;
    S.tier = Math.floor(S.eats / TIER_FOODS) + 1;
    S.T = Math.max(MIN_T, BASE_T - (S.tier - 1) * 11);      // 提速一档
    S.acc = Math.min(S.acc, S.T);
    S.pulse = 1;

    if (S.score > S.best) {
      S.best = S.score;
      S.newBest = S.best > S.initialBest;
      saveBest();
    }
    syncHud();
    popScore();

    const px = centerX(head), py = centerY(head);
    burstParticles(px, py);
    addFloat(px, py - 8, '+10', '#ffd86b');

    // 通关或生成新食物
    if (S.cells.length >= COLS * ROWS) { winGame(); return; }
    const f = spawnFood();
    if (!f) { winGame(); return; }
    S.food = f;
  }

  function die() {
    if (S.state !== 'run') return;
    S.state = 'dying';
    S.dyingStart = performance.now();
    shakeBoard();
    syncButtons();
  }

  function finishOver() {
    if (S.state !== 'dying') return;
    S.state = 'over';
    saveBest();
    openResult(false);
    syncButtons();
  }

  function winGame() {
    S.state = 'win';
    S.winGlow = 1;
    saveBest();
    openResult(true);
    syncButtons();
  }

  /* ---------------- 震动 ---------------- */
  let shakeTimer = 0;
  function shakeBoard() {
    clearShake();
    wrap.classList.add('shake');
    shakeTimer = setTimeout(() => wrap.classList.remove('shake'), 560);
  }
  function clearShake() {
    if (shakeTimer) { clearTimeout(shakeTimer); shakeTimer = 0; }
    wrap.classList.remove('shake');
  }

  /* ---------------- 结算弹窗 ---------------- */
  function openResult(isWin) {
    if (isWin) {
      modalTitle.textContent = '🏆 通关啦！';
      modalMsg.textContent = '小蛇占满了整块棋盘，完美通关！';
      modalMsg.className = 'msg win';
    } else {
      modalTitle.textContent = '游戏结束';
      modalMsg.textContent = S.newBest ? '🎉 刷新本机最高分！' : '再接再厉，冲击更高分！';
      modalMsg.className = 'msg ' + (S.newBest ? 'win' : 'lose');
    }
    modalSub.textContent = '得分 ' + S.score + ' ｜ 最高 ' + S.best +
      ' ｜ 长度 ' + S.cells.length + ' ｜ 速度 ' + S.tier + ' 档';
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    againBtn.focus({ preventScroll: true });
  }

  function hideModal() {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  /* ---------------- 输入：键盘 ---------------- */
  const KEYMAP = {
    ArrowUp: DIRS.up, KeyW: DIRS.up,
    ArrowDown: DIRS.down, KeyS: DIRS.down,
    ArrowLeft: DIRS.left, KeyA: DIRS.left,
    ArrowRight: DIRS.right, KeyD: DIRS.right
  };

  function inputDir(d) {
    if (S.state === 'idle') { startGame(d); return; }
    if (S.state === 'run') {
      if (d.x === -S.dir.x && d.y === -S.dir.y) return;   // 禁止直接反向
      if (d.x === S.dir.x && d.y === S.dir.y) return;
      S.pending = d;                                      // 缓存转向，下一格生效
    }
  }

  function togglePause() {
    if (S.state === 'run') S.state = 'paused';
    else if (S.state === 'paused') S.state = 'run';
    syncButtons();
  }

  window.addEventListener('keydown', (e) => {
    const k = e.code;
    if (k in KEYMAP) {
      e.preventDefault();
      if (!e.repeat) inputDir(KEYMAP[k]);
    } else if (k === 'Space' || k === 'KeyP') {
      e.preventDefault();
      if (!e.repeat) togglePause();
    } else if (k === 'KeyR') {
      e.preventDefault();
      if (!e.repeat) restartGame();
    }
  });

  /* ---------------- 输入：触屏 / 鼠标滑动 ---------------- */
  let downX = 0, downY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    downX = e.clientX; downY = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    const dx = e.clientX - downX, dy = e.clientY - downY;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    let d = null;
    if (adx > 14 || ady > 14) {
      d = adx > ady ? (dx > 0 ? DIRS.right : DIRS.left)
                    : (dy > 0 ? DIRS.down : DIRS.up);
    }
    if (S.state === 'idle') startGame(d || DEFAULT_DIR);
    else if (S.state === 'run' && d) inputDir(d);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------------- 按钮 ---------------- */
  restartBtn.addEventListener('click', restartGame);
  pauseBtn.addEventListener('click', togglePause);
  againBtn.addEventListener('click', restartGame);

  /* ---------------- 失焦自动暂停 ---------------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.state === 'run') togglePause();
  });

  /* ---------------- 绘制 ---------------- */
  function scrimRect(alpha) {
    ctx.fillStyle = OVERLAY;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalAlpha = 1;
  }

  function drawBoard() {
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? BG_A : BG_B;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
  }

  function drawFood(now) {
    const f = S.food;
    if (!f) return;
    const fx = centerX(f), fy = centerY(f);
    const glow = Math.sin(now * 0.006) * 1.6;            // 脉冲光效
    const r = 8 + glow + (S.pulse > 0 ? S.pulse * 3 : 0);
    const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, 28);
    g.addColorStop(0, 'rgba(255,200,90,0.5)');
    g.addColorStop(1, 'rgba(255,178,62,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(fx, fy, 28, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffc65c';
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = FOOD_HI;
    ctx.beginPath();
    ctx.arc(fx - 2.5, fy - 2.5, r * 0.38, 0, TAU);
    ctx.fill();
  }

  function drawSnake() {
    const n = S.cells.length;
    if (!n) return;
    const moving = !!MOVING_STATES[S.state];
    const head = S.cells[0];

    // 头部渲染位置（两格之间线性插值）
    let hx, hy;
    if (moving) {
      const p = S.T > 0 ? clamp(S.acc / S.T, 0, 1) : 0;
      hx = (head.x + S.dir.x * p) * CELL + CELL / 2;
      hy = (head.y + S.dir.y * p) * CELL + CELL / 2;
    } else {
      hx = centerX(head);
      hy = centerY(head);
    }

    // 身体各段位置
    const pts = [];
    if (moving) {
      const simNow = S.lastTick + S.acc;
      for (let i = 1; i < n; i++) {
        const p = trailPoint(simNow - i * S.T);
        if (p) pts.push(p);
      }
    } else {
      for (let i = 1; i < n; i++) {
        const c = S.cells[i];
        pts.push({ x: centerX(c), y: centerY(c) });
      }
    }

    const scale = 1 + 0.16 * S.pulse;

    // 底层连续管身（圆角连接，保证弯道无缝隙）
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = UNDERLAY;
    ctx.lineWidth = 23 * scale;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // 渐变小圆角分段
    const denom = Math.max(1, pts.length - 1);
    for (let i = 0; i < pts.length; i++) {
      const t = i / denom;
      ctx.fillStyle = bodyColor(t);
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, (11.2 - 3.4 * t) * scale, 0, TAU);
      ctx.fill();
    }

    // 蛇头（带眼睛）
    ctx.fillStyle = rgbStr(HEAD_RGB);
    ctx.beginPath();
    ctx.arc(hx, hy, 12.4 * scale, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const dx = S.dir.x, dy = S.dir.y;
    const px = -dy, py = dx;                       // 垂直向量
    const ex = hx + dx * 2.4, ey = hy + dy * 2.4;
    const off = 4.5 * scale;
    const er = 3.4 * scale;
    ctx.fillStyle = '#f4f8ff';
    ctx.beginPath(); ctx.arc(ex + px * off, ey + py * off, er, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ex - px * off, ey - py * off, er, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0d1526';
    const pr = 1.7 * scale;
    ctx.beginPath(); ctx.arc(ex + px * off + dx * 1.3, ey + py * off + dy * 1.3, pr, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ex - px * off + dx * 1.3, ey - py * off + dy * 1.3, pr, 0, TAU); ctx.fill();
  }

  function drawParticles() {
    for (const p of S.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of S.floats) {
      ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
      ctx.font = `700 17px ${FONT}`;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function centerText(text, y, font, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, SIZE / 2, y);
  }

  function drawIdle(now) {
    scrimRect(1);
    const breathe = 0.72 + 0.28 * Math.sin(now * 0.004);
    ctx.globalAlpha = breathe;
    centerText('按任意方向键开始', SIZE / 2 - 34, `700 30px ${FONT}`, TEXT);
    ctx.globalAlpha = 1;
    centerText('↑ ↓ ← → / W A S D 移动', SIZE / 2 + 14, `500 16px ${FONT}`, '#c9d6e8');
    centerText('或在棋盘上滑动开始', SIZE / 2 + 42, `400 14px ${FONT}`, MUTED);
  }

  function drawReady(now) {
    scrimRect(1);
    const el = now - S.readyStart;
    if (el >= COUNTDOWN_MS) { beginRun(); return; }
    const num = 3 - ((el / (COUNTDOWN_MS / 3)) | 0);
    const age = el - (3 - num) * (COUNTDOWN_MS / 3);
    const scale = 1 + 0.5 * Math.max(0, 1 - age / 160);
    ctx.font = `700 ${Math.round(84 * scale)}px ${FONT}`;
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), SIZE / 2, SIZE / 2 - 8);
    centerText('准备…', SIZE / 2 + 52, `500 17px ${FONT}`, '#c9d6e8');
  }

  function drawPaused() {
    scrimRect(1);
    centerText('已暂停', SIZE / 2 - 22, `700 32px ${FONT}`, TEXT);
    centerText('Space / P 或点击「继续」', SIZE / 2 + 24, `500 15px ${FONT}`, '#c9d6e8');
  }

  function drawDyingFlash(now) {
    const k = now - S.dyingStart;
    const w = Math.max(0, Math.sin(k * 0.045));
    ctx.fillStyle = 'rgba(255,93,108,1)';
    ctx.globalAlpha = 0.5 * w * w;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalAlpha = 1;
  }

  function drawWinGlow() {
    if (S.winGlow <= 0) return;
    ctx.fillStyle = '#34d399';
    ctx.globalAlpha = S.winGlow * 0.22;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalAlpha = 1;
  }

  /* ---------------- 主循环（rAF + 帧时间差） ---------------- */
  function tickWorld(dt) {
    S.acc += dt;
    let guard = 0;
    while (S.acc >= S.T && S.state === 'run' && guard < 6) {
      S.acc -= S.T;
      S.lastTick += S.T;
      step();
      guard++;
    }
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp(now - (last || now), 0, 100);
    last = now;

    if (S.state === 'run') tickWorld(dt);
    if (S.state === 'dying' && now - S.dyingStart >= DYING_MS) finishOver();
    if (S.state === 'ready' && now - S.readyStart >= COUNTDOWN_MS) beginRun();

    updateFx(S.state === 'paused' ? 0 : dt);

    // ---- 绘制 ----
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawBoard();
    drawFood(now);
    drawSnake();
    drawParticles();
    drawFloats();

    if (S.state === 'idle') drawIdle(now);
    else if (S.state === 'ready') drawReady(now);
    else if (S.state === 'paused') drawPaused();
    else if (S.state === 'dying') drawDyingFlash(now);

    drawWinGlow();
  }

  /* ---------------- 初始化 ---------------- */
  S.initialBest = loadBest();
  S.best = S.initialBest;
  resetGame(DEFAULT_DIR);       // idle：开场显示「按任意方向键开始」
  syncButtons();
  hideModal();
  requestAnimationFrame(frame);
})();
