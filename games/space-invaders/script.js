'use strict';

/* ============================================================
 * 太空入侵者（Space Invaders 单机版）
 * 原生 Canvas + JS，无外部资源。
 * 玩法：击落整列外星人过关；外星阵列整体左右平移、触边下降；
 *       顶排 30 分、中排 20 分、底排 10 分，UFO 50~300 分随机。
 * ============================================================ */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;   // 640
const H = canvas.height;  // 700（固定逻辑尺寸，CSS 等比缩放）

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------- 常量配置 ---------- */
const ROWS = 5;                       // 外星人行数
const PITCH_X = 42;                   // 列间距
const PITCH_Y = 34;                   // 行间距
const ALIEN_W = 30;                   // 外星人命中框宽
const ALIEN_H = 28;                   // 外星人命中框高
const ARMY_TOP = 118;                 // 阵列初始顶部 Y
const DROP = 26;                      // 触边每次下降量
const X_MIN = 8;                      // 阵列左右边界
const X_MAX = W - 8;
const WIN_LEVEL = 5;                  // 通关关卡数
const PLAYER_SPEED = 340;
const FIRE_CD = 0.3;                  // 射击冷却
const MAX_PLAYER_BULLETS = 3;
const BULLET_SPEED = 760;
const SHIP_Y = 650;                   // 飞船中心 Y
const INVADE_Y = 650;                 // 外星人底边越过此线 → 入侵失败
const BEST_KEY = 'invaders-best';

const ROW_SCORE = [30, 30, 20, 20, 10];            // 自上而下每行分值
const ROW_EMOJI = ['👾', '👾', '👽', '👽', '🦑'];  // 每行外星人形态
const ROW_COLOR = ['#b18cff', '#b18cff', '#7ef0c8', '#7ef0c8', '#ffc24d'];

const EMOJI_FONT = '27px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const UFO_FONT = '30px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const TEXT_FONT = 'bold 15px "Segoe UI","Microsoft YaHei",sans-serif';

const READY_STEPS = ['3', '2', '1', '出发!'];
const READY_STEP_DUR = 0.55;

/* ---------- 运行状态 ---------- */
let state = 'menu';          // menu | ready | play | hurt | clearFx | modal
let score = 0;
let level = 1;
let lives = 3;
let best = 0;
let bestAtStart = 0;

let army = null;             // 外星阵列
let ship = { x: W / 2 };
let playerBullets = [];
let alienBullets = [];
let particles = [];
let floats = [];

let ufo = null;
let ufoWait = 6;

let fireCd = 0;              // 射击冷却计时
let invT = 0;                // 复活无敌时间
let hurtT = 0;               // 受击定格时长
let levelT = 0;              // 本关进行时间（难度斜坡）
let alienFireT = 1.4;
let readyT = 0;
let readyStep = 0;
let swayT = 0;
let tGlobal = 0;             // 全局时间（用于辉光/闪烁）
let clearT = 0;
let celebT = 0;

let fireHeld = false;        // 键盘按住空格
let touchFireHeld = false;   // 长按自动开火
let tapQueue = 0;            // 点按射击队列
let keys = { left: false, right: false };
let btnTouch = { left: false, right: false, fire: false };

const shake = { t: 0, dur: 1, amp: 0 };
let flashA = 0;              // 受击红闪

/* ---------- 触屏指针状态 ---------- */
let ptrId = null;
let ptrStartX = 0, ptrStartLX = 0, ptrLastLX = 0, ptrStartT = 0, ptrMoved = false, ptrHoldT = 0, ptrGrab = 0;

/* ============================================================
 * DOM / HUD
 * ============================================================ */
function bump(el) {
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function refreshHud() {
  $('hud-score').textContent = String(score);
  $('hud-best').textContent = String(best);
  $('hud-level').textContent = String(level);
  $('hud-lives').textContent = String(lives);
}

function addScore(v) {
  score += v;
  $('hud-score').textContent = String(score);
  if (score > best) {
    best = score;
    $('hud-best').textContent = String(best);
    bump($('hud-best'));
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* 隐私模式忽略 */ }
  }
}

function setLives(n) {
  lives = Math.max(0, n);
  $('hud-lives').textContent = String(lives);
  bump($('hud-lives'));
}

function loadBest() {
  try {
    const v = parseInt(localStorage.getItem(BEST_KEY), 10);
    best = Number.isFinite(v) && v > 0 ? v : 0;
  } catch (e) { best = 0; }
}

/* ============================================================
 * 外星阵列
 * ============================================================ */
function colsFor(lv) {
  return Math.min(11, 8 + lv);   // 关卡越高阵列越满（最终 11 列）
}

function buildArmy(cols) {
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        row: r, col: c, alive: true,
        score: ROW_SCORE[r], emoji: ROW_EMOJI[r], color: ROW_COLOR[r]
      });
    }
  }
  const span = (cols - 1) * PITCH_X + ALIEN_W;
  const x = clamp((W - span) / 2, X_MIN, W - span - X_MIN);
  return { cols, cells, x, y: ARMY_TOP, dir: 1, initCount: cols * ROWS };
}

function armyAlive() {
  let n = 0;
  for (const c of army.cells) if (c.alive) n++;
  return n;
}

function cellRect(cell) {
  const x = army.x + cell.col * PITCH_X + (PITCH_X - ALIEN_W) / 2;
  const y = army.y + cell.row * PITCH_Y;
  return { x, y, w: ALIEN_W, h: ALIEN_H, cx: x + ALIEN_W / 2, cy: y + ALIEN_H / 2 };
}

function marchSpeed(aliveN) {
  const ratio = aliveN / army.initCount;
  const thin = 1 + 0.9 * (1 - ratio);               // 越少动得越快
  const timeF = 1 + Math.min(0.85, levelT * 0.014); // 本关持续加速
  return (95 + 14 * (level - 1)) * thin * timeF;
}

function updateArmy(dt) {
  const aliveN = armyAlive();
  if (aliveN === 0) return;
  const pad = (PITCH_X - ALIEN_W) / 2;
  let minCol = 1e9, maxCol = -1e9;
  for (const c of army.cells) {
    if (c.alive) {
      if (c.col < minCol) minCol = c.col;
      if (c.col > maxCol) maxCol = c.col;
    }
  }
  const extRight = maxCol * PITCH_X + pad + ALIEN_W;
  const extLeft = minCol * PITCH_X + pad;

  swayT += dt * (0.9 + 1.6 * (1 - aliveN / army.initCount));
  army.x += army.dir * marchSpeed(aliveN) * dt;

  if (army.dir > 0) {
    if (army.x + extRight > X_MAX) {
      army.x = X_MAX - extRight;
      army.y += DROP;
      army.dir = -1;
    }
  } else {
    if (army.x + extLeft < X_MIN) {
      army.x = X_MIN - extLeft;
      army.y += DROP;
      army.dir = 1;
    }
  }
}

/* 随机挑一个还活着的“最底排”外星人开火 */
function pickShooter() {
  const cols = army.cols;
  const aliveCols = [];
  for (let c = 0; c < cols; c++) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (army.cells[r * cols + c].alive) { aliveCols.push(c); break; }
    }
  }
  if (!aliveCols.length) return null;
  const c = aliveCols[Math.floor(Math.random() * aliveCols.length)];
  for (let r = ROWS - 1; r >= 0; r--) {
    const cell = army.cells[r * cols + c];
    if (cell.alive) return cell;
  }
  return null;
}

function alienBulletCap() { return Math.min(5, 2 + level); }

function updateAlienFire(dt) {
  alienFireT -= dt;
  if (alienFireT > 0) return;
  if (alienBullets.length >= alienBulletCap()) { alienFireT = 0.3; return; }
  const shooter = pickShooter();
  if (!shooter) { alienFireT = 0.6; return; }
  const r = cellRect(shooter);
  alienBullets.push({ x: r.cx, y: r.y + r.h + 4, speed: 120 + 16 * (level - 1) + rand(0, 40) });
  const ratio = armyAlive() / army.initCount;
  const scale = (1 + 0.11 * (level - 1)) * (1 + 0.9 * (1 - ratio));
  alienFireT = (1.45 + Math.random() * 1.5) / scale;
}

/* ============================================================
 * UFO（顶部飞掠）
 * ============================================================ */
function spawnUFO() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  ufo = { x: dir > 0 ? -64 : W + 64, y: 52, dir, speed: rand(95, 150) };
}

function updateUFO(dt) {
  if (ufo) {
    ufo.x += ufo.dir * ufo.speed * dt;
    if (ufo.x < -80 || ufo.x > W + 80) {
      ufo = null;
      ufoWait = Math.max(4.5, rand(8, 17) - (level - 1) * 0.7);
    }
  } else {
    ufoWait -= dt;
    if (ufoWait <= 0) spawnUFO();
  }
}

function hitUFO(bullet) {
  const bx = bullet.x, by = bullet.y;
  if (ufo && Math.abs(bx - ufo.x) < 26 && Math.abs(by - ufo.y) < 20) {
    const v = 50 * randInt(1, 6);          // 50 ~ 300 随机
    addScore(v);
    addText(ufo.x, ufo.y - 22, '+' + v, '#ffb23e', 19);
    explode(ufo.x, ufo.y, ['#ffb23e', '#34d399', '#ffffff', '#3aa0ff'], 1.5);
    shake.amp = Math.max(shake.amp, 4); shake.t = shake.dur = 0.22;
    ufo = null;
    ufoWait = Math.max(4.5, rand(9, 18) - (level - 1) * 0.7);
    return true;
  }
  return false;
}

/* ============================================================
 * 特效：粒子 / 飘字 / 震屏 / 红闪
 * ============================================================ */
function explode(x, y, colors, power) {
  if (particles.length > 420) return;
  const n = 10 + Math.floor(power * 8);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = (40 + Math.random() * 130) * power;
    const life = 0.35 + Math.random() * 0.45;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life, max: life,
      size: 1.6 + Math.random() * 2.3,
      color: colors[(Math.random() * colors.length) | 0],
      grav: 150
    });
  }
}

function addText(x, y, txt, color, size) {
  floats.push({ x, y, vy: -36, txt, color: color || '#fff', life: 1, size: size || 15 });
}

function updateFx(dt) {
  // 粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  // 飘字
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt * 0.9;
    if (f.life <= 0) { floats.splice(i, 1); continue; }
    f.y += f.vy * dt;
  }
  // 震屏
  if (shake.t > 0) shake.t = Math.max(0, shake.t - dt);
  // 红闪
  if (flashA > 0) flashA = Math.max(0, flashA - dt * 1.6);
}

/* ============================================================
 * 流程：开局 / 关卡 / 结束
 * ============================================================ */
function setOverlays() {
  $('ov-menu').classList.toggle('show', state === 'menu');
  $('ov-ready').classList.toggle('show', state === 'ready');
}

function showReadyStep(i) {
  const el = $('ready-big');
  el.textContent = READY_STEPS[i];
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function beginRun() {
  score = 0;
  level = 1;
  lives = 3;
  levelT = 0;
  bestAtStart = best;
  hideModal();
  beginLevel(1);
}

function beginLevel(n) {
  level = n;
  levelT = 0;
  army = buildArmy(colsFor(level));
  alienFireT = 1.4;
  swayT = 0;
  invT = 0;
  hurtT = 0;
  ship.x = W / 2;
  playerBullets.length = 0;
  alienBullets.length = 0;
  ufo = null;
  ufoWait = rand(5, 9);
  flashA = 0;
  shake.t = 0;
  $('ready-sub').textContent = '第 ' + level + ' 关 · 阵列 ' + army.cols + ' × ' + ROWS;
  refreshHud();
  readyT = 0;
  readyStep = 0;
  showReadyStep(0);
  state = 'ready';
  setOverlays();
}

function startPlay() {
  state = 'play';
  setOverlays();
}

/* 玩家受击 */
function playerHit() {
  setLives(lives - 1);
  explode(ship.x, SHIP_Y, ['#ff5d6c', '#ffb23e', '#ffffff', '#3aa0ff'], 1.6);
  flashA = 1;
  shake.amp = 9; shake.t = shake.dur = 0.5;
  playerBullets.length = 0;
  alienBullets.length = 0;
  fireHeld = false;
  touchFireHeld = false;
  tapQueue = 0;
  alienFireT = 1.2;
  state = 'hurt';
  hurtT = 1.0;
}

/* 清空一关 */
function levelCleared() {
  const bonus = 100 * level;
  addScore(bonus);
  addText(W / 2, 320, '过关奖励 +' + bonus, '#34d399', 22);
  explode(W / 2, 260, ['#34d399', '#3aa0ff', '#ffffff'], 1.8);
  alienBullets.length = 0;
  playerBullets.length = 0;
  ufo = null;
  clearT = 1.15;
  celebT = 0;
  state = 'clearFx';
}

/* ---------- 模态框 ---------- */
let modalPrimary = null;

function showModal(title, cls, lines, primaryLabel, primaryFn) {
  const m = $('modal');
  const t = $('modal-title');
  t.textContent = title;
  t.className = 'modal-title' + (cls ? ' ' + cls : '');

  const sub = $('modal-sub');
  sub.textContent = '';
  for (const ln of lines) {
    const p = document.createElement('p');
    p.textContent = ln;
    sub.appendChild(p);
  }

  const box = $('modal-actions');
  box.textContent = '';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.textContent = primaryLabel;
  box.appendChild(btn);

  const link = document.createElement('a');
  link.className = 'btn secondary';
  link.href = '../../index.html';
  link.textContent = '返回列表';
  box.appendChild(link);

  modalPrimary = primaryFn;
  btn.addEventListener('click', () => {
    hideModal();
    if (primaryFn) primaryFn();
  });
  m.classList.add('show');
  try { btn.focus({ preventScroll: true }); } catch (err) { btn.focus(); }
}

function hideModal() {
  const m = $('modal');
  if (m) m.classList.remove('show');
  modalPrimary = null;
}

function recordLine() {
  return score > bestAtStart
    ? '🎉 刷新最高分：' + best
    : '最高纪录：' + best;
}

function loseGame(reason) {
  state = 'modal';
  setOverlays();
  showModal('💀 游戏结束', 'lose', [
    reason,
    '得分 ' + score + '　·　到达第 ' + level + ' 关',
    recordLine()
  ], '再来一局', beginRun);
}

function winGame() {
  state = 'modal';
  setOverlays();
  showModal('🏆 通关胜利', 'win', [
    '你消灭了全部 ' + WIN_LEVEL + ' 关的外星入侵者！',
    '最终得分 ' + score,
    recordLine()
  ], '再来一局', beginRun);
}

function clearModal() {
  state = 'modal';
  setOverlays();
  showModal('✅ 第 ' + level + ' 关 通过', 'clear', [
    '外星阵列清空，下一关更快更满！',
    '得分 ' + score + '　·　生命 ×' + lives
  ], '下一关 ▶', () => beginLevel(level + 1));
}

/* ============================================================
 * 输入：键盘 / 触屏 / 鼠标
 * ============================================================ */
window.addEventListener('keydown', (e) => {
  const k = e.code;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyR', 'Enter'].includes(k)) {
    e.preventDefault();
  }
  switch (k) {
    case 'ArrowLeft': case 'KeyA': keys.left = true; break;
    case 'ArrowRight': case 'KeyD': keys.right = true; break;
    case 'Space':
      if (!e.repeat) {
        fireHeld = true;
        if (state === 'menu') beginRun();
      }
      break;
    case 'Enter':
      if (e.repeat) break;
      if (state === 'menu') beginRun();
      else if (state === 'modal' && modalPrimary) { const fn = modalPrimary; hideModal(); fn(); }
      break;
    case 'KeyR':
      if (e.repeat) break;
      beginRun();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.code;
  if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD'].includes(k)) e.preventDefault();
  if (k === 'ArrowLeft' || k === 'KeyA') keys.left = false;
  else if (k === 'ArrowRight' || k === 'KeyD') keys.right = false;
  else if (k === 'Space') fireHeld = false;
});

window.addEventListener('blur', () => {
  keys.left = keys.right = false;
  fireHeld = false;
  btnTouch.left = btnTouch.right = btnTouch.fire = false;
});

function canvasToLocal(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) * (W / r.width),
    y: (clientY - r.top) * (H / r.height)
  };
}

/* 射击：有冷却与弹量上限 */
function tryFire() {
  if (state !== 'play' || fireCd > 0 || playerBullets.length >= MAX_PLAYER_BULLETS) return false;
  fireCd = FIRE_CD;
  playerBullets.push({ x: ship.x, y: SHIP_Y - 28 });
  // 枪口火花
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: ship.x + rand(-4, 4), y: SHIP_Y - 26,
      vx: rand(-30, 30), vy: rand(-160, -60),
      life: 0.12, max: 0.12, size: 2, color: i % 2 ? '#9be8ff' : '#ffffff', grav: 0
    });
  }
  return true;
}

canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'play' || ptrId !== null) return;
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 部分浏览器不支持，忽略 */ }
  const p = canvasToLocal(e.clientX, e.clientY);
  ptrId = e.pointerId;
  ptrStartX = ptrLastLX = p.x;
  ptrStartT = performance.now();
  ptrMoved = false;
  ptrHoldT = 0;
  ptrGrab = ship.x - p.x;
  touchFireHeld = false;
});

canvas.addEventListener('pointermove', (e) => {
  if (ptrId !== e.pointerId || state !== 'play') return;
  const p = canvasToLocal(e.clientX, e.clientY);
  if (!ptrMoved && Math.abs(p.x - ptrStartX) > 7) ptrMoved = true;
  if (ptrMoved) {
    ship.x = clamp(p.x + ptrGrab, 16, W - 16);
  }
  ptrLastLX = p.x;
});

canvas.addEventListener('pointerup', (e) => {
  if (ptrId !== e.pointerId) return;
  const dur = (performance.now() - ptrStartT) / 1000;
  if (!ptrMoved && dur < 0.35) tapQueue = Math.min(tapQueue + 1, 4);
  touchFireHeld = false;
  ptrId = null;
});

canvas.addEventListener('pointercancel', () => {
  ptrId = null;
  touchFireHeld = false;
});

/* 触屏物理按钮 */
function bindBtn(id, onDown, onUp) {
  const el = $(id);
  const down = (e) => { e.preventDefault(); onDown(); };
  const up = () => onUp();
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindBtn('tc-left', () => { btnTouch.left = true; }, () => { btnTouch.left = false; });
bindBtn('tc-right', () => { btnTouch.right = true; }, () => { btnTouch.right = false; });
bindBtn('tc-fire', () => { btnTouch.fire = true; touchFireHeld = true; }, () => { btnTouch.fire = false; touchFireHeld = false; });

$('btn-start').addEventListener('click', () => beginRun());

/* 首次触屏时显示实体按键（供混合设备） */
window.addEventListener('touchstart', () => {
  $('touch-controls').classList.add('on');
}, { once: true, passive: true });

$('stage').addEventListener('contextmenu', (e) => e.preventDefault());

/* ============================================================
 * 逐帧更新
 * ============================================================ */
function updateReady(dt) {
  readyT += dt;
  const idx = Math.floor(readyT / READY_STEP_DUR);
  if (idx < READY_STEPS.length && idx !== readyStep) {
    readyStep = idx;
    showReadyStep(idx);
  }
  if (readyT >= READY_STEPS.length * READY_STEP_DUR) startPlay();
}

function updatePlay(dt) {
  levelT += dt;
  if (invT > 0) invT -= dt;

  /* 移动 */
  const dx = ((keys.right || btnTouch.right) ? 1 : 0) - ((keys.left || btnTouch.left) ? 1 : 0);
  if (dx !== 0) ship.x = clamp(ship.x + dx * PLAYER_SPEED * dt, 16, W - 16);

  /* 射击 */
  fireCd -= dt;
  if ((fireHeld || touchFireHeld || btnTouch.fire) && tryFire()) { /* 自动连发 */ }
  while (tapQueue > 0) {
    if (tryFire()) tapQueue--;
    else break;
  }

  /* 外星人移动 / 入侵判定 */
  updateArmy(dt);
  for (const c of army.cells) {
    if (!c.alive) continue;
    const r = cellRect(c);
    if (r.y + r.h >= INVADE_Y) {
      loseGame('🚨 外星人突破了防线，地球沦陷…');
      return;
    }
  }

  /* 外星人开火 */
  updateAlienFire(dt);

  /* 外星子弹 */
  for (let i = alienBullets.length - 1; i >= 0; i--) {
    const b = alienBullets[i];
    b.y += b.speed * dt;
    if (b.y > H + 30) { alienBullets.splice(i, 1); continue; }
    if (invT <= 0 &&
        Math.abs(b.x - ship.x) < 13 &&
        b.y > SHIP_Y - 18 && b.y < SHIP_Y + 18) {
      alienBullets.splice(i, 1);
      playerHit();
      return;
    }
  }

  /* 玩家子弹 */
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    b.y -= BULLET_SPEED * dt;
    if (b.y < -20) { playerBullets.splice(i, 1); continue; }

    if (hitUFO(b)) { playerBullets.splice(i, 1); continue; }

    /* 命中外星人（自上而下先撞到谁，取最低的命中格） */
    let hitCell = null;
    for (const cell of army.cells) {
      if (!cell.alive) continue;
      const r = cellRect(cell);
      if (Math.abs(b.x - r.cx) < (r.w / 2 + 3) && b.y >= r.y - 8 && b.y <= r.y + r.h + 2) {
        if (!hitCell || cell.row > hitCell.row) hitCell = cell;
      }
    }
    if (hitCell) {
      hitCell.alive = false;
      const r = cellRect(hitCell);
      explode(r.cx, r.cy, [hitCell.color, '#ffffff'], 1);
      addText(r.cx, r.cy - 12, '+' + hitCell.score, hitCell.color, 15);
      addScore(hitCell.score);
      shake.amp = Math.max(shake.amp, 1.6); shake.t = shake.dur = 0.09;
      playerBullets.splice(i, 1);
      if (armyAlive() === 0) {
        levelCleared();
        return;
      }
    }
  }

  updateUFO(dt);
}

function updateHurt(dt) {
  hurtT -= dt;
  if (hurtT <= 0) {
    if (lives <= 0) {
      loseGame('💥 你的飞船被击毁了…');
    } else {
      invT = 1.5;                    // 复活无敌
      ship.x = W / 2;
      state = 'play';
      setOverlays();
    }
  }
}

function updateClear(dt) {
  clearT -= dt;
  celebT += dt;
  // 随机礼花庆祝
  if (particles.length < 300 && Math.random() < dt * 5) {
    explode(rand(80, W - 80), rand(180, 420), ['#34d399', '#3aa0ff', '#ffb23e', '#ffffff'], 0.7);
  }
  if (clearT <= 0) {
    if (level >= WIN_LEVEL) winGame();
    else clearModal();
  }
}

function updateStars(dt) {
  for (const s of stars) {
    s.y += s.sp * dt;
    if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
  }
}

/* ============================================================
 * 绘制
 * ============================================================ */
const stars = [];
(function initStars() {
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() < 0.85 ? 1 : 1.8,
      sp: rand(2, 7),
      tw: Math.random() * TAU
    });
  }
})();

function drawBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04060f');
  g.addColorStop(0.55, '#071022');
  g.addColorStop(1, '#0a1730');
  ctx.fillStyle = g;
  ctx.fillRect(-18, -18, W + 36, H + 36);

  // 底部地平线微光
  const rg = ctx.createRadialGradient(W / 2, H + 30, 10, W / 2, H + 30, H * 0.5);
  rg.addColorStop(0, 'rgba(58,160,255,0.12)');
  rg.addColorStop(1, 'rgba(58,160,255,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(-18, -18, W + 36, H + 36);
}

function drawStars() {
  for (const s of stars) {
    const a = 0.28 + 0.5 * (0.5 + 0.5 * Math.sin(tGlobal * 2.4 + s.tw));
    ctx.fillStyle = 'rgba(210,230,255,' + a.toFixed(3) + ')';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
}

function drawUFO() {
  if (!ufo) return;
  const bob = Math.sin(tGlobal * 3) * 2.5;
  const y = ufo.y + bob;
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = '#ffb23e';
  ctx.beginPath();
  ctx.ellipse(ufo.x, y + 8, 26, 12, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = UFO_FONT;
  ctx.fillText('🛸', ufo.x, y);
}

function drawArmy() {
  if (!army) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rot = Math.sin(swayT * TAU) * 0.1 + (army.dir || 1) * 0.03;
  for (const cell of army.cells) {
    if (!cell.alive) continue;
    const r = cellRect(cell);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = cell.color;
    ctx.beginPath();
    ctx.ellipse(r.cx, r.cy + 3, 17, 13, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(r.cx, r.cy + 3);
    ctx.rotate(rot);
    ctx.font = EMOJI_FONT;
    ctx.fillText(cell.emoji, 0, -1);
    ctx.restore();
  }
}

function drawShip() {
  const x = ship.x;
  ctx.save();
  ctx.translate(x, SHIP_Y);

  if (invT > 0) {
    // 无敌：闪烁 + 护盾光环
    if (Math.floor(invT * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    const pa = 0.22 + 0.16 * Math.sin(tGlobal * 18);
    ctx.strokeStyle = 'rgba(90,220,255,' + pa.toFixed(3) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 2, 26, 0, TAU);
    ctx.stroke();
  }

  ctx.shadowColor = 'rgba(52,211,153,0.8)';
  ctx.shadowBlur = 12;

  // 炮管
  ctx.fillStyle = '#eafff5';
  ctx.fillRect(-3, -24, 6, 13);
  ctx.shadowBlur = 0;

  // 机身
  const body = ctx.createLinearGradient(0, -20, 0, 16);
  body.addColorStop(0, '#8ef7d3');
  body.addColorStop(1, '#0d9c74');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(10, -4);
  ctx.lineTo(15, 10);
  ctx.lineTo(0, 15);
  ctx.lineTo(-15, 10);
  ctx.lineTo(-10, -4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 机翼亮点
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-9, 4, 3, 6);
  ctx.fillRect(6, 4, 3, 6);

  // 座舱
  ctx.fillStyle = '#0b3d54';
  ctx.beginPath();
  ctx.ellipse(0, -2, 3.4, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#9be8ff';
  ctx.beginPath();
  ctx.ellipse(0, -4, 1.6, 2.4, 0, 0, TAU);
  ctx.fill();

  // 喷焰
  const fl = 4 + Math.sin(tGlobal * 34) * 2;
  ctx.fillStyle = 'rgba(58,160,255,0.65)';
  ctx.beginPath();
  ctx.moveTo(-4, 14);
  ctx.lineTo(0, 14 + fl);
  ctx.lineTo(4, 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBullets() {
  // 玩家光束
  for (const b of playerBullets) {
    ctx.save();
    ctx.shadowColor = 'rgba(91,203,255,0.9)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#bfeeff';
    ctx.fillRect(b.x - 2, b.y - 16, 4, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(b.x - 0.8, b.y - 12, 1.6, 9);
    ctx.restore();
  }
  // 外星炮弹
  for (const b of alienBullets) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,140,60,0.22)';
    ctx.fillRect(b.x - 1.6, b.y + 3, 3.2, 10);
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffb23e';
    ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
    ctx.fillStyle = '#fff2d0';
    ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloats() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of floats) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.font = 'bold ' + f.size + 'px "Segoe UI","Microsoft YaHei",sans-serif';
    ctx.fillStyle = f.color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(f.txt, f.x, f.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

/* ============================================================
 * 主循环
 * ============================================================ */
function drawScene() {
  ctx.clearRect(0, 0, W, H);
  const amp = shake.t > 0 ? shake.amp * (shake.t / shake.dur) : 0;
  let ox = 0, oy = 0;
  if (amp > 0.05) { ox = (Math.random() * 2 - 1) * amp; oy = (Math.random() * 2 - 1) * amp * 0.55; }

  ctx.save();
  ctx.translate(ox, oy);
  drawBg();
  drawStars();
  drawUFO();
  drawArmy();
  drawShip();
  drawBullets();
  drawParticles();
  drawFloats();
  ctx.restore();

  if (flashA > 0) {
    ctx.fillStyle = 'rgba(255,64,80,' + (flashA * 0.3).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;
  tGlobal += dt;

  // 主循环内的指针长按 → 自动开火（触屏点住不放）
  if (ptrId !== null && state === 'play') {
    ptrHoldT += dt;
    if (ptrHoldT > 0.38 && !ptrMoved) touchFireHeld = true;
  }

  updateStars(dt);
  updateFx(dt);
  if (state !== 'play') swayT += dt * 0.8;   // 待机/倒计时时轻柔摆动

  if (state === 'ready') updateReady(dt);
  else if (state === 'play') updatePlay(dt);
  else if (state === 'hurt') updateHurt(dt);
  else if (state === 'clearFx') updateClear(dt);

  drawScene();
}

/* ---------- 启动 ---------- */
loadBest();
bestAtStart = best;
army = buildArmy(11);        // 菜单背后的完整 5×11 演示阵列
refreshHud();
requestAnimationFrame(frame);
