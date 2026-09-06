/* =========================================================
   games/pong/script.js —— 乒乓球 Pong
   单人 vs AI / 双人同屏 · 纯原生 JS + Canvas
   requestAnimationFrame + 帧时间差驱动
   ========================================================= */
(() => {
  'use strict';

  /* ---------------- 常量 ---------------- */
  const W = 640;                 // 画布逻辑尺寸
  const H = 420;
  const PW = 12;                 // 球拍宽
  const PH = 94;                 // 球拍高
  const PR = 9;                  // 球拍圆角
  const BALL_R = 7;
  const PADDLE_SPEED = 480;      // 手控拍最大速度 px/s
  const BALL_SPEED0 = 335;       // 发球速度
  const BALL_SPEED_MAX = 690;    // 球速上限
  const BALL_ACC = 9;            // 每次击球加速量
  const MAX_BOUNCE = Math.PI / 3; // 拍面反弹角上限 ±60°
  const WIN_SCORE = 5;

  const COL = {
    bg0: '#0a1526',
    bg1: '#0d1c31',
    ball: '#ffffff',
    left: '#3aa0ff',
    aiRight: '#ff5d6c',
    p2Right: '#34d399',
    net: 'rgba(255,255,255,0.14)',
    confetti: ['#3aa0ff', '#34d399', '#ffb23e', '#ff5d6c', '#ffffff']
  };

  /* ---------------- DOM ---------------- */
  const canvas = document.getElementById('pong');
  const ctx = canvas.getContext('2d');
  const scoreText = document.getElementById('scoreText');
  const bestEl = document.getElementById('bestStreak');
  const modeLabelEl = document.getElementById('modeLabel');
  const hintEl = document.getElementById('hint');
  const bannerEl = document.getElementById('banner');
  const countdownEl = document.getElementById('countdown');
  const cdNum = document.getElementById('cdNum');
  const cdHint = document.getElementById('cdHint');
  const resetBtn = document.getElementById('resetBtn');
  const againBtn = document.getElementById('againBtn');
  const modal = document.getElementById('resultModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalSub = document.getElementById('modalSub');
  const tagLeft = document.getElementById('tagLeft');
  const tagRight = document.getElementById('tagRight');
  const modeBtns = Array.prototype.slice.call(document.querySelectorAll('.mode-btn'));

  /* ---------------- 状态 ---------------- */
  const S = {
    mode: 'ai',            // 'ai' | 'pvp'
    state: 'countdown',    // countdown | play | pause | over
    scores: [0, 0],
    points: 0,
    nextDir: 1,
    flash: { side: -1, t: 0 },
    paddleGlow: [0, 0]
  };
  const P = [
    { x: 24, y: (H - PH) / 2 },
    { x: W - 24 - PW, y: (H - PH) / 2 }
  ];
  const B = { x: W / 2, y: H / 2, vx: 0, vy: 0, visible: false };
  const FX = { parts: [], rings: [], trail: [] };

  let rightColor = COL.aiRight;

  /* 连胜 / 最高连胜(localStorage 'pong-best') */
  let best = 0;
  let currentStreak = 0;
  let lastWin = null;
  try {
    best = parseInt(localStorage.getItem('pong-best') || '0', 10) || 0;
  } catch (e) {
    best = 0;
  }

  /* 输入 */
  const KEYS = Object.create(null);          // 键盘
  const pointers = new Map();                // 指针 id -> {side,y,movedAt}

  /* 延迟调度（rAF 泵 + 代际取消，重开可作废旧回调） */
  let gen = 0;
  const sched = [];
  function later(ms, fn) {
    const g = gen;
    sched.push({ at: performance.now() + ms, fn: function () { if (g === gen) fn(); } });
  }
  function pumpSched() {
    const now = performance.now();
    for (let i = sched.length - 1; i >= 0; i--) {
      if (sched[i].at <= now) {
        const f = sched[i].fn;
        sched.splice(i, 1);
        f();
      }
    }
  }

  /* AI 参数 */
  let aiReactAt = 0;
  let aiTarget = H / 2;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  function sideColor(side) { return side === 0 ? COL.left : rightColor; }

  /* ---------------- 模式 / UI ---------------- */
  function applyModeUI() {
    const m = S.mode;
    rightColor = m === 'ai' ? COL.aiRight : COL.p2Right;
    modeBtns.forEach(function (b) {
      const on = b.dataset.mode === m;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    modeLabelEl.textContent = m === 'ai' ? '🤖 单人·对战AI' : '👥 双人·同屏';
    tagLeft.textContent = m === 'ai' ? '你' : '玩家1';
    tagRight.textContent = m === 'ai' ? 'AI' : '玩家2';
    tagLeft.style.color = COL.left;
    tagLeft.style.borderColor = COL.left + '66';
    tagLeft.style.background = COL.left + '26';
    tagRight.style.color = rightColor;
    tagRight.style.borderColor = rightColor + '66';
    tagRight.style.background = rightColor + '26';
    hintEl.innerHTML = m === 'ai'
      ? '你控制左拍：<b>W/S</b> 或 <b>↑/↓</b> · 触屏：在画面上按住拖动 · AI 会随比分变强 · 按 <b>R</b> 重开'
      : '<b>玩家1</b>：左拍 <b>W/S</b>　·　<b>玩家2</b>：右拍 <b>↑/↓</b> · 触屏分左右半屏拖动 · 按 <b>R</b> 重开';
  }

  function setMode(m) {
    if (S.mode === m) return;
    S.mode = m;
    applyModeUI();
    newMatch(); // 切换即重置本局
  }

  function updateHud(bump) {
    scoreText.textContent = S.scores[0] + ' : ' + S.scores[1];
    if (bump) {
      scoreText.classList.remove('bump');
      void scoreText.offsetWidth;
      scoreText.classList.add('bump');
    }
    bestEl.textContent = best + ' 局';
  }

  function showBanner(text, color) {
    bannerEl.textContent = text;
    bannerEl.style.color = color;
    bannerEl.style.textShadow = '0 0 18px ' + color + ', 0 2px 10px rgba(0,0,0,0.65)';
    bannerEl.classList.remove('on');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('on');
  }

  function showModal() {
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }
  function hideModal() {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  /* ---------------- 回合流程 ---------------- */
  function newMatch() {
    gen++;
    S.scores = [0, 0];
    S.points = 0;
    S.nextDir = Math.random() < 0.5 ? -1 : 1;
    S.flash = { side: -1, t: 0 };
    S.paddleGlow = [0, 0];
    FX.parts.length = 0;
    FX.rings.length = 0;
    FX.trail.length = 0;
    aiReactAt = 0;
    aiTarget = H / 2;
    hideModal();
    updateHud(false);
    startServe();
  }

  function startServe() {
    S.state = 'countdown';
    B.visible = false;
    B.x = W / 2; B.y = H / 2; B.vx = 0; B.vy = 0;
    P[0].y = (H - PH) / 2;
    P[1].y = (H - PH) / 2;
    cdHint.textContent = S.points === 0 ? '开局准备…' : '发球准备…';
    countdownEl.classList.add('on');
    ['3', '2', '1'].forEach(function (n, i) {
      later(i * 640, function () {
        cdNum.textContent = n;
        cdNum.classList.remove('pop');
        void cdNum.offsetWidth;
        cdNum.classList.add('pop');
      });
    });
    later(3 * 640, function () {
      countdownEl.classList.remove('on');
      serve();
    });
  }

  function serve() {
    if (S.state !== 'countdown') return;
    S.state = 'play';
    const sign = Math.random() < 0.5 ? -1 : 1;
    const a = sign * rand(0.16, 0.4);
    B.x = W / 2;
    B.y = H / 2;
    B.vx = Math.cos(a) * BALL_SPEED0 * S.nextDir;
    B.vy = Math.sin(a) * BALL_SPEED0;
    B.visible = true;
    FX.trail.length = 0;
  }

  function onScore(scorer) {
    S.scores[scorer]++;
    S.points++;
    const concede = scorer === 0 ? 1 : 0;
    S.nextDir = concede === 0 ? -1 : 1;      // 发向刚失分的一方
    S.flash = { side: scorer, t: 1 };
    S.paddleGlow = [0, 0];
    B.visible = false;
    S.state = 'pause';
    updateHud(true);

    const c = sideColor(scorer);
    const txt = S.mode === 'ai'
      ? (scorer === 0 ? '⚡ 你得分！' : '⚡ AI 得分！')
      : (scorer === 0 ? '⚡ 蓝方得分！' : '⚡ 绿方得分！');
    showBanner(txt, c);
    ringAt(W / 2, H / 2, c);

    if (S.scores[scorer] >= WIN_SCORE) {
      later(1150, function () { endMatch(scorer); });
    } else {
      later(950, function () { startServe(); });
    }
  }

  function recordStreak(winner) {
    if (S.mode === 'ai') {
      if (winner === 0) {
        currentStreak = lastWin === 'human' ? currentStreak + 1 : 1;
        lastWin = 'human';
      } else {
        currentStreak = 0;
        lastWin = 'ai';
      }
    } else {
      const key = winner === 0 ? 'left' : 'right';
      currentStreak = lastWin === key ? currentStreak + 1 : 1;
      lastWin = key;
    }
    if (currentStreak > best) {
      best = currentStreak;
      try { localStorage.setItem('pong-best', String(best)); } catch (e) { /* 忽略 */ }
    }
  }

  function endMatch(winner) {
    if (S.state === 'over') return;
    S.state = 'over';
    recordStreak(winner);
    const l = S.scores[0];
    const r = S.scores[1];
    let title, sub;
    if (S.mode === 'ai') {
      if (winner === 0) {
        title = '🎉 你赢了！';
        sub = '比分 ' + l + ' : ' + r + (currentStreak >= 2 ? '，已连胜 ' + currentStreak + ' 局' : '') + '，再接再厉！';
      } else {
        title = '😅 AI 获胜';
        sub = '比分 ' + l + ' : ' + r + '，下次赢回来！';
      }
    } else {
      title = winner === 0 ? '🏆 蓝方获胜！' : '🏆 绿方获胜！';
      sub = '比分 ' + l + ' : ' + r + (currentStreak >= 2
        ? ' · ' + (winner === 0 ? '蓝方' : '绿方') + ' 连胜 ' + currentStreak + ' 局'
        : '');
    }
    sub += best > 0 ? ' · 最高连胜 ' + best + ' 局' : ' · 赢下一局创造纪录吧！';
    modalTitle.textContent = title;
    modalSub.textContent = sub;
    updateHud(false);
    showModal();
    if (S.mode === 'ai' && winner === 0) confettiBurst();
  }

  /* ---------------- 特效 ---------------- */
  function ringAt(x, y, color) {
    FX.rings.push({ x: x, y: y, r: 8, vr: 340, ttl: 0.45, life: 0, color: color });
  }
  function hitFx(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 300);
      FX.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        ttl: rand(0.25, 0.6), life: 0,
        size: rand(1.6, 3.8),
        color: i % 3 === 0 ? COL.ball : color,
        g: 0
      });
    }
    ringAt(x, y, color);
  }
  function wallSpark(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
      const sp = rand(50, 190);
      FX.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp,
        ttl: rand(0.18, 0.42), life: 0,
        size: rand(1.2, 2.6),
        color: 'rgba(255,255,255,0.9)',
        g: 0
      });
    }
  }
  function confettiBurst() {
    for (let i = 0; i < 90; i++) {
      FX.parts.push({
        x: rand(W * 0.2, W * 0.8), y: -6 - rand(0, 70),
        vx: rand(-180, 180), vy: rand(60, 300),
        ttl: rand(0.9, 1.9), life: 0,
        size: rand(2, 5),
        color: COL.confetti[(Math.random() * COL.confetti.length) | 0],
        g: 420, conf: true, rot: rand(0, Math.PI * 2), vr: rand(-9, 9)
      });
    }
  }
  function updateFx(dt) {
    const ps = FX.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.ttl) { ps.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.conf) { p.rot += p.vr * dt; p.vx *= Math.max(0, 1 - 1.1 * dt); }
    }
    const rs = FX.rings;
    for (let i = rs.length - 1; i >= 0; i--) {
      const q = rs[i];
      q.life += dt;
      if (q.life >= q.ttl) { rs.splice(i, 1); continue; }
      q.r += q.vr * dt;
    }
    if (S.flash.t > 0) S.flash.t = Math.max(0, S.flash.t - dt * 2.4);
    S.paddleGlow[0] = Math.max(0, S.paddleGlow[0] - dt * 3.2);
    S.paddleGlow[1] = Math.max(0, S.paddleGlow[1] - dt * 3.2);
  }

  /* ---------------- 球拍控制 ---------------- */
  function updatePaddles(dt) {
    if (S.mode === 'ai') updateAI(dt);
    for (let side = 0; side < 2; side++) {
      if (S.mode === 'ai' && side === 1) continue;

      // 键盘方向
      const k = side === 0
        ? { up: KEYS.KeyW || (S.mode === 'ai' ? KEYS.ArrowUp : false), down: KEYS.KeyS || (S.mode === 'ai' ? KEYS.ArrowDown : false) }
        : { up: KEYS.ArrowUp, down: KEYS.ArrowDown };
      let dir = 0;
      if (k.up) dir -= 1;
      if (k.down) dir += 1;

      // 指针(触屏/鼠标)拖动
      let tgt = null;
      let bestT = -1;
      pointers.forEach(function (pt) {
        if (pt.side === side && pt.movedAt > bestT) { bestT = pt.movedAt; tgt = pt.y; }
      });
      if (tgt !== null) {
        const cy = P[side].y + PH / 2;
        P[side].y += (tgt - cy) * Math.min(1, dt * 16);
      } else if (dir !== 0) {
        P[side].y += dir * PADDLE_SPEED * dt;
      }
      P[side].y = clamp(P[side].y, 0, H - PH);
    }
  }

  /* AI：带误差 + 反应延迟的追踪，难度随比分上升 */
  function updateAI(dt) {
    const total = S.scores[0] + S.scores[1];
    let diff = 0.3 + total * 0.075;
    if (S.scores[1] > S.scores[0]) diff += 0.05;
    diff = Math.min(0.95, diff);

    const now = performance.now();
    const chase = S.state === 'play' && B.visible && B.vx > 0;
    if (!chase) {
      aiTarget = H / 2;
    } else if (now >= aiReactAt) {
      const err = (115 * (1 - diff) + 7) * rand(-1, 1);
      aiTarget = clamp(B.y + err, PH / 2 + 4, H - PH / 2 - 4);
      const react = (175 - 130 * diff) * rand(0.55, 1.4);
      aiReactAt = now + react;
    }
    const cy = P[1].y + PH / 2;
    const step = Math.min(Math.abs(aiTarget - cy), (335 + 135 * diff) * dt);
    P[1].y += aiTarget >= cy ? step : -step;
    P[1].y = clamp(P[1].y, 0, H - PH);
  }

  /* ---------------- 球：帧差驱动 + 防穿透子步进 ---------------- */
  function reflect(side) {
    const off = clamp((B.y - (P[side].y + PH / 2)) / (PH / 2 + BALL_R), -1, 1);
    const a = off * MAX_BOUNCE;
    const mag = Math.min(Math.hypot(B.vx, B.vy) + BALL_ACC, BALL_SPEED_MAX);
    const dir = side === 0 ? 1 : -1;
    B.vx = Math.cos(a) * mag * dir;
    B.vy = Math.sin(a) * mag;
    S.paddleGlow[side] = 1;
    hitFx(B.x, B.y, sideColor(side));
  }

  function stepBall(dt) {
    if (!B.visible || S.state !== 'play') return;
    const dist = Math.hypot(B.vx, B.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / 12));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      B.x += B.vx * sdt;
      B.y += B.vy * sdt;

      // 上下墙反弹
      if (B.y - BALL_R < 0 && B.vy < 0) {
        B.y = BALL_R; B.vy = -B.vy; wallSpark(B.x, 0);
      } else if (B.y + BALL_R > H && B.vy > 0) {
        B.y = H - BALL_R; B.vy = -B.vy; wallSpark(B.x, H);
      }

      // 左拍碰撞（击打位置决定反弹角）
      if (B.vx < 0 &&
          B.x - BALL_R <= P[0].x + PW && B.x + BALL_R >= P[0].x - 2 &&
          B.y >= P[0].y - BALL_R && B.y <= P[0].y + PH + BALL_R) {
        B.x = P[0].x + PW + BALL_R;
        reflect(0);
      } else if (B.vx > 0 &&
          B.x + BALL_R >= P[1].x && B.x - BALL_R <= P[1].x + PW + 2 &&
          B.y >= P[1].y - BALL_R && B.y <= P[1].y + PH + BALL_R) {
        B.x = P[1].x - BALL_R;
        reflect(1);
      }

      // 出界 → 对方得分
      if (B.x + BALL_R < -4) { onScore(1); return; }
      if (B.x - BALL_R > W + 4) { onScore(0); return; }
    }
    FX.trail.unshift({ x: B.x, y: B.y });
    if (FX.trail.length > 13) FX.trail.pop();
  }

  /* ---------------- 主更新 ---------------- */
  function update(dt) {
    updateFx(dt);
    if (S.state !== 'over') updatePaddles(dt);
    if (S.state === 'play') stepBall(dt);
  }

  /* ---------------- 渲染 ---------------- */
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, COL.bg0);
  bgGrad.addColorStop(1, COL.bg1);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPaddle(side) {
    const p = P[side];
    const color = sideColor(side);
    ctx.save();
    if (S.paddleGlow[side] > 0.01) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16 * S.paddleGlow[side];
    }
    ctx.fillStyle = color;
    roundRect(p.x, p.y, PW, PH, PR);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    roundRect(p.x, p.y, PW, PH, PR);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    roundRect(p.x + 2, p.y + 3, PW - 4, 4, 2);
    ctx.fill();
  }

  function hexA(a) {
    return Math.max(0, Math.min(1, a)) * 255 | 0;
  }
  function hexAlpha(a) {
    const n = hexA(a);
    return n.toString(16).padStart(2, '0');
  }

  function render() {
    // 背景
    ctx.globalAlpha = 1;
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 中线虚线 + 中圈
    ctx.save();
    ctx.strokeStyle = COL.net;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 外框
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    // 得分侧边缘闪光
    if (S.flash.t > 0 && (S.flash.side === 0 || S.flash.side === 1)) {
      const side = S.flash.side;
      const color = sideColor(side);
      const a = Math.max(0, S.flash.t) * 0.42;
      ctx.save();
      const grad = side === 0
        ? ctx.createLinearGradient(0, 0, 110, 0)
        : ctx.createLinearGradient(W, 0, W - 110, 0);
      grad.addColorStop(0, color + hexAlpha(a));
      grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      if (side === 0) ctx.fillRect(0, 0, 110, H);
      else ctx.fillRect(W - 110, 0, 110, H);
      ctx.restore();
    }

    // 球拍
    drawPaddle(0);
    drawPaddle(1);

    // 球拖尾
    for (let i = FX.trail.length - 1; i >= 0; i--) {
      const t = FX.trail[i];
      const f = 1 - i / FX.trail.length;
      ctx.globalAlpha = f * 0.35;
      ctx.fillStyle = COL.ball;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_R * (0.5 + f * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 扩散环（击球脉冲）
    for (let i = 0; i < FX.rings.length; i++) {
      const q = FX.rings[i];
      const f = Math.max(0, 1 - q.life / q.ttl);
      ctx.globalAlpha = f * 0.8;
      ctx.strokeStyle = q.color;
      ctx.lineWidth = 2 + 2 * f;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 粒子 / 彩带
    for (let i = 0; i < FX.parts.length; i++) {
      const p = FX.parts[i];
      const f = Math.max(0, 1 - p.life / p.ttl);
      ctx.globalAlpha = f;
      ctx.fillStyle = p.color;
      if (p.conf) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * f), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 球（外发光）
    if (B.visible) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = COL.ball;
      ctx.beginPath();
      ctx.arc(B.x, B.y, BALL_R * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'rgba(255,255,255,0.85)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = COL.ball;
      ctx.beginPath();
      ctx.arc(B.x, B.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 结束后（模态框关闭时）画布提示
    if (S.state === 'over') {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 17px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏓 比赛结束 · 按 R 或点「再来一局」重开', W / 2, H - 26);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
  }

  /* ---------------- 输入绑定 ---------------- */
  window.addEventListener('keydown', function (e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
      e.preventDefault();
    }
    KEYS[e.code] = true;
    if (e.code === 'KeyR' && !e.repeat) newMatch();
    if (e.code === 'Escape' && modal.classList.contains('show')) hideModal();
  });
  window.addEventListener('keyup', function (e) { KEYS[e.code] = false; });
  window.addEventListener('blur', function () {
    for (const k in KEYS) KEYS[k] = false;
  });

  function pointerToLogical(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height)
    };
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    const pt = pointerToLogical(e);
    pointers.set(e.pointerId, {
      side: S.mode === 'ai' ? 0 : (pt.x < W / 2 ? 0 : 1),
      y: clamp(pt.y - 8, PH / 2, H - PH / 2),
      movedAt: performance.now()
    });
  });
  canvas.addEventListener('pointermove', function (e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const pt = pointerToLogical(e);
    p.y = clamp(pt.y - 8, PH / 2, H - PH / 2);
    p.movedAt = performance.now();
  });
  function endPointer(e) { pointers.delete(e.pointerId); }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  /* ---------------- 按钮 ---------------- */
  resetBtn.addEventListener('click', function () { newMatch(); });
  againBtn.addEventListener('click', function () { newMatch(); });
  modeBtns.forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) hideModal();
  });
  bannerEl.addEventListener('animationend', function () { bannerEl.classList.remove('on'); });

  /* ---------------- 主循环 ---------------- */
  let lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;      // 切后台回来不跳变
    if (dt < 0) dt = 0;
    pumpSched();
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  /* ---------------- 启动 ---------------- */
  applyModeUI();
  updateHud(false);
  requestAnimationFrame(frame);
  newMatch();
})();
