/* ===== 打砖块 · 单机单人 =====
 * 原生 JS + Canvas，逻辑尺寸固定 720×520，requestAnimationFrame + 帧时间差驱动。
 */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  var W = 720, H = 520;
  var BEST_KEY = 'breakout-best';
  var ROW_POINTS = [50, 40, 30, 20, 10];                       // 自上而下砖块分值
  var ROW_COLORS = [                                            // [底色, 高光色]
    ['#ff5d6c', '#ffa0a8'],
    ['#ff9f43', '#ffd0a0'],
    ['#ffd93d', '#fff0a6'],
    ['#34d399', '#a6f2d4'],
    ['#3aa0ff', '#a6d4ff']
  ];
  var CONFETTI = ['#ff5d6c', '#ff9f43', '#ffd93d', '#34d399', '#3aa0ff', '#ffffff'];
  var INTRO_LEN = 0.95, DEATH_LEN = 0.85, CLEAR_DELAY = 0.6, DIE_DELAY = 0.7;
  var BALL_R = 7, PADDLE_H = 14;
  var PADDLE_Y = H - 44;

  /* ---------- DOM ---------- */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };
  var hudScore = $('hudScore'), hudLevel = $('hudLevel'),
      hudLives = $('hudLives'), hudBest = $('hudBest');
  var modal = $('modal'), mTitle = $('modalTitle'),
      mSub = $('modalSub'), btnA = $('btnA'), btnB = $('btnB');

  /* ---------- 运行状态 ---------- */
  var score = 0, level = 1, lives = 3;
  var runState = 'intro';      // intro | ready | play | cleared | dying | over
  var introT = 0, introDen = INTRO_LEN, introMain = '准备…', introSub = '';
  var clearT = 0, dyingT = 0;
  var shakeMag = 0, deathFlash = 0;
  var best = 0, runStartBest = 0, bestBeaten = false;
  var last = 0;

  /* ---------- 游戏对象 ---------- */
  var paddle = { x: W / 2, w: 118, h: PADDLE_H, y: PADDLE_Y,
                 tilt: 0, tiltT: 0, squash: 1, squashV: 0, flash: 0 };
  var ball = { x: 0, y: 0, r: BALL_R, vx: 0, vy: 0 };
  var bricks = [], aliveCount = 0;
  var particles = [], pops = [], trail = [];
  var keys = { left: false, right: false };
  var btnLeft = false, btnRight = false;
  var paddleTarget = null;
  var pointer = { active: false, downX: 0, downY: 0, downT: 0, type: '' };

  /* ---------- 工具 ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function loadBest() {
    try {
      var v = parseInt(localStorage.getItem(BEST_KEY), 10);
      return isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  }
  function persistBest() {
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* 忽略 */ }
  }
  function rr(x, y, w, h, r) {
    var rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
  function padTop() { return paddle.y - paddle.h / 2; }
  function levelSpeed(lv) { return Math.min(800, 345 * Math.pow(1.085, lv - 1)); }

  function updateHud() {
    hudScore.textContent = String(score);
    hudLevel.textContent = String(level);
    hudLives.textContent = String(lives);
    hudBest.textContent = String(best);
  }

  /* ---------- 轻量音效（WebAudio 合成，无外部资源） ---------- */
  var actx = null;
  function ac() {
    if (!actx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) actx = new AC();
      } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  function tone(freq, dur, type, vol, slide, delay) {
    var a = ac(); if (!a) return;
    try {
      var t0 = a.currentTime + (delay || 0);
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
      g.gain.setValueAtTime(vol == null ? 0.05 : vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) { /* 忽略 */ }
  }
  var sndBrick = function (row) { tone(560 + row * 90, 0.09, 'square', 0.04); };
  var sndPaddle = function () { tone(230, 0.1, 'triangle', 0.07); };
  var sndWall = function () { tone(320, 0.05, 'sine', 0.03); };
  var sndLaunch = function () { tone(300, 0.13, 'triangle', 0.08); };
  var sndLose = function () { tone(280, 0.45, 'sawtooth', 0.07, -200); };
  var sndWin = function () {
    var notes = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < notes.length; i++) tone(notes[i], 0.16, 'triangle', 0.06, 0, i * 0.09);
  };

  /* ---------- 砖块布局（每关随机化） ---------- */
  function buildBricks(lv) {
    var cols = 10, rows = 5, bw = 61, bh = 18, gap = 5, vgap = 6, top = 64;
    var totalW = cols * bw + (cols - 1) * gap;
    var x0 = Math.round((W - totalW) / 2);
    var keepBase = Math.max(0.45, 0.9 - 0.045 * (lv - 1));
    var attempt = 0;
    bricks = []; aliveCount = 0;
    do {
      bricks = []; aliveCount = 0;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (Math.random() < keepBase) {
            bricks.push({
              x: x0 + c * (bw + gap),
              y: top + r * (bh + vgap),
              w: bw, h: bh, row: r, alive: true
            });
            aliveCount++;
          }
        }
      }
      attempt++;
    } while (aliveCount < 10 && attempt < 40);
  }

  /* ---------- 粒子 / 飘字 / 震动 ---------- */
  function burst(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = spd * rand(0.25, 1);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 60,
        life: rand(0.35, 0.7),
        max: 0.7,
        size: rand(1.5, 3.6),
        color: color,
        grav: 760
      });
    }
  }
  function popup(x, y, text, color) {
    pops.push({ x: x, y: y, text: text, color: color || '#ffd66b', life: 0.9, max: 0.9 });
  }
  function shake(m) { shakeMag = Math.max(shakeMag, m); }

  function addScore(n) {
    score += n;
    if (score > best) {
      if (!bestBeaten && score > runStartBest) {
        bestBeaten = true;
        popup(W / 2, 96, '🏆 新纪录！', '#ffd66b');
      }
      best = score;
      persistBest();
    }
    updateHud();
  }

  /* ---------- 挡板 ---------- */
  function updatePaddle(dt) {
    var dir = 0;
    if (keys.left || btnLeft) dir -= 1;
    if (keys.right || btnRight) dir += 1;
    var velPx = 0;
    if (dir !== 0) {
      velPx = dir * 640;
      paddle.x += velPx * dt;
      paddleTarget = null;
    } else if (paddleTarget != null) {
      var dx = paddleTarget - paddle.x;
      var maxM = 1000 * dt;
      var m = clamp(dx, -maxM, maxM);
      paddle.x += m;
      velPx = m / dt;
      if (Math.abs(dx) < 0.6) paddleTarget = null;
    }
    var half = paddle.w / 2;
    paddle.x = clamp(paddle.x, half + 6, W - half - 6);
    paddle.tiltT = clamp(velPx / 1500, -1, 1) * 0.17;
  }

  function paddleSquash() {
    paddle.squash = 0.55;
    paddle.squashV = -9;
    paddle.flash = 1;
  }

  function paddleTopY() { return paddle.y - paddle.h / 2; }

  /* ---------- 球 ---------- */
  function attachBall() {
    ball.x = paddle.x;
    ball.y = paddleTopY() - ball.r - 1;
    ball.vx = 0; ball.vy = 0;
    trail.length = 0;
  }

  function hitPaddle() {
    var half = paddle.w / 2;
    var o = clamp((ball.x - paddle.x) / half, -1, 1);
    var sp = Math.min(Math.hypot(ball.vx, ball.vy) * 1.025, 880); // 轻微加速
    var th = o * (Math.PI / 180) * 70;                            // 命中位置决定反弹角度
    var nx = Math.sin(th) * sp, ny = -Math.cos(th) * sp;
    if (Math.abs(nx) < sp * 0.05) {                               // 避免纯直线上下
      nx = (Math.random() < 0.5 ? -1 : 1) * sp * rand(0.06, 0.12);
      ny = -Math.sqrt(Math.max(0, sp * sp - nx * nx));
    }
    ball.vx = nx; ball.vy = ny;
    ball.y = paddleTopY() - ball.r - 0.5;
    paddleSquash();
    sndPaddle();
  }

  function hitBricks() {
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      var hw = b.w / 2, hh = b.h / 2;
      var dx = ball.x - (b.x + hw);
      var dy = ball.y - (b.y + hh);
      var ox = (hw + ball.r) - Math.abs(dx);
      if (ox <= 0) continue;
      var oy = (hh + ball.r) - Math.abs(dy);
      if (oy <= 0) continue;
      if (ox < oy) { ball.x += dx >= 0 ? ox : -ox; ball.vx = -ball.vx; }
      else { ball.y += dy >= 0 ? oy : -oy; ball.vy = -ball.vy; }
      destroyBrick(b);
      return;
    }
  }

  function destroyBrick(b) {
    b.alive = false;
    aliveCount--;
    var pts = ROW_POINTS[b.row];
    addScore(pts);
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    burst(cx, cy, ROW_COLORS[b.row][0], 14, 260);
    burst(cx, cy, '#ffffff', 3, 160);
    popup(cx, cy, '+' + pts, ROW_COLORS[b.row][1]);
    shake(2);
    sndBrick(b.row);
    if (aliveCount <= 0) {
      clearLevel();
    }
  }

  function clearLevel() {
    runState = 'cleared';
    clearT = CLEAR_DELAY;
    for (var i = 0; i < 90; i++) {
      particles.push({
        x: rand(0, W), y: rand(90, 260),
        vx: rand(-60, 60), vy: rand(-160, 20),
        life: rand(0.6, 1.2), max: 1.2,
        size: rand(2, 4.4),
        color: CONFETTI[(Math.random() * CONFETTI.length) | 0],
        grav: 220
      });
    }
    shake(6);
    sndWin();
  }

  function moveBall(dt) {
    var sp = Math.hypot(ball.vx, ball.vy);
    if (sp <= 0) return;
    var remain = sp * dt;
    var stepCap = Math.max(2.5, ball.r * 0.8);
    while (remain > 0) {
      if (runState !== 'play') return;
      var step = Math.min(stepCap, remain);
      remain -= step;
      // 每一步都用当前速度方向推进，确保砖块/挡板反弹后方向立即生效
      var spNow = Math.hypot(ball.vx, ball.vy);
      if (spNow <= 0) return;
      var ux = ball.vx / spNow, uy = ball.vy / spNow;
      var px = ball.x, py = ball.y;
      ball.x += ux * step;
      ball.y += uy * step;
      // 四壁（底边单独处理）
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); sndWall(); }
      else if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); sndWall(); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); sndWall(); }
      // 砖块
      hitBricks();
      if (runState !== 'play') return;
      // 挡板
      if (ball.vy > 0) {
        var pt = paddleTopY();
        if (py + ball.r <= pt + 1 && ball.y + ball.r >= pt &&
            Math.abs(ball.x - paddle.x) <= paddle.w / 2 + ball.r * 0.75) {
          hitPaddle();
        }
      }
      // 漏底
      if (ball.y - ball.r > H + 24) { lifeLost(); return; }
    }
  }

  function lifeLost() {
    lives--;
    updateHud();
    if (lives <= 0) {
      runState = 'dying';
      dyingT = DIE_DELAY;
      deathFlash = 1;
      shake(12);
      sndLose();
    } else {
      runState = 'intro';
      introT = DEATH_LEN;
      introDen = DEATH_LEN;
      introMain = '准备…';
      introSub = '剩余 ' + lives + ' 条命';
      deathFlash = 0.85;
      shake(8);
      sndLose();
      attachBall();
      trail.length = 0;
    }
  }

  /* ---------- 发射 ---------- */
  function launch() {
    if (runState !== 'ready') return;
    var s = levelSpeed(level);
    var ang = rand(-0.32, 0.32);            // 初始方向略微随机
    ball.vx = Math.sin(ang) * s;
    ball.vy = -Math.cos(ang) * s;
    runState = 'play';
    sndLaunch();
    paddleSquash();
  }

  /* ---------- 流程控制 ---------- */
  function startLevel(lv) {
    level = lv;
    buildBricks(lv);
    runState = 'intro';
    introT = INTRO_LEN;
    introDen = INTRO_LEN;
    introMain = '准备…';
    introSub = '第 ' + level + ' 关';
    attachBall();
    trail.length = 0;
    updateHud();
  }

  function startRun() {
    score = 0; level = 1; lives = 3;
    best = loadBest();
    runStartBest = best;
    bestBeaten = false;
    paddle.x = W / 2;
    paddleTarget = null;
    hideModal();
    startLevel(1);
    updateHud();
  }

  function hideModal() { modal.classList.remove('show'); }

  function showModal(title, subHtml, actA, actB) {
    mTitle.textContent = title;
    mSub.innerHTML = subHtml;
    btnA.textContent = actA ? actA.label : '';
    btnA.className = 'btn' + (actA && actA.cls ? ' ' + actA.cls : '');
    btnA.onclick = function () {
      hideModal();
      if (actA && actA.fn) actA.fn();
    };
    if (actB) {
      btnB.style.display = '';
      btnB.textContent = actB.label;
      btnB.className = 'btn' + (actB.cls ? ' ' + actB.cls : '');
      btnB.onclick = function () {
        hideModal();
        if (actB.fn) actB.fn();
      };
    } else {
      btnB.style.display = 'none';
      btnB.onclick = null;
    }
    modal.classList.add('show');
  }

  function recLine() {
    return bestBeaten ? '<br><span class="rec">🏆 新纪录：' + best + ' 分</span>' : '';
  }

  function showWinModal() {
    runState = 'over';
    showModal(
      '🎉 第 ' + level + ' 关通关！',
      '本关得分 ' + score + ' 分 · 历史最高 ' + best + ' 分' + recLine(),
      { label: '下一关 ▶', cls: '', fn: function () { startLevel(level + 1); } },
      { label: '从头重玩', cls: 'secondary', fn: startRun }
    );
  }

  function showLoseModal() {
    runState = 'over';
    showModal(
      '💔 游戏结束',
      '得分 ' + score + ' 分 · 到达第 ' + level + ' 关<br>历史最高 ' + best + ' 分' + recLine(),
      { label: '再来一局', cls: '', fn: startRun },
      null
    );
  }

  /* ---------- 主更新（帧时间差驱动） ---------- */
  function update(dt) {
    // 视觉衰减：震动 / 红闪 / 挡板弹性 / 倾斜
    shakeMag = shakeMag > 0.0005 ? shakeMag * Math.exp(-11 * dt) : 0;
    deathFlash = deathFlash > 0.004 ? Math.max(0, deathFlash - dt * 1.7) : 0;
    paddle.squashV += ((1 - paddle.squash) * 520 - paddle.squashV * 22) * dt;
    paddle.squash = clamp(paddle.squash + paddle.squashV * dt, 0.2, 1.6);
    paddle.flash = Math.max(0, paddle.flash - dt * 4);
    paddle.tilt += (paddle.tiltT - paddle.tilt) * Math.min(1, 16 * dt);

    // 粒子
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < 0 || p.x > W) p.vx = -p.vx;
      if (p.y > H + 20) { particles.splice(i, 1); }
    }
    // 飘字
    for (var j = pops.length - 1; j >= 0; j--) {
      var q = pops[j];
      q.life -= dt; q.y -= 46 * dt;
      if (q.life <= 0) pops.splice(j, 1);
    }
    // 拖尾记录
    if (runState === 'play') {
      trail.unshift({ x: ball.x, y: ball.y });
      if (trail.length > 14) trail.pop();
    }

    // 挡板移动（intro / ready / play / cleared 均可操控）
    if (runState === 'intro' || runState === 'ready' ||
        runState === 'play' || runState === 'cleared') {
      updatePaddle(dt);
    }

    if (runState === 'intro') {
      attachBall();
      introT -= dt;
      if (introT <= 0) runState = 'ready';
    } else if (runState === 'ready') {
      attachBall();
    } else if (runState === 'play') {
      moveBall(dt);
    } else if (runState === 'cleared') {
      clearT -= dt;
      if (clearT <= 0) showWinModal();
    } else if (runState === 'dying') {
      dyingT -= dt;
      if (dyingT <= 0) showLoseModal();
    }
  }

  /* ---------- 绘制 ---------- */
  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shakeMag > 0.05) {
      ctx.translate(rand(-shakeMag, shakeMag), rand(-shakeMag, shakeMag));
    }
    // 背景
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#141b2b');
    bg.addColorStop(1, '#0a0f18');
    ctx.fillStyle = bg;
    ctx.fillRect(-8, -8, W + 16, H + 16);
    // 极淡网格
    ctx.strokeStyle = 'rgba(160,180,210,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = 40; gx < W; gx += 40) { ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); }
    for (var gy = 40; gy < H; gy += 40) { ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); }
    ctx.stroke();

    drawBricks();
    drawParticles();
    drawPops();
    drawTrail();
    drawPaddle();
    drawBall();

    // 红闪（失命反馈）
    if (deathFlash > 0.01) {
      ctx.fillStyle = 'rgba(255,70,95,' + (deathFlash * 0.26).toFixed(3) + ')';
      ctx.fillRect(-8, -8, W + 16, H + 16);
    }
    // 状态浮层文案
    if (runState === 'intro') {
      var p = clamp(1 - introT / introDen, 0, 1);
      drawOverlay(introMain, introSub, now, p, 'main');
    } else if (runState === 'ready') {
      var a = 0.75 + Math.sin(now * 5.2) * 0.22;
      ctx.globalAlpha = clamp(a, 0.4, 1);
      ctx.font = '700 30px system-ui, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#eaf3ff';
      ctx.fillText('点击发射', W / 2, H * 0.42);
      ctx.font = '500 14px system-ui, "Segoe UI", sans-serif';
      ctx.fillStyle = '#8fa3bd';
      ctx.fillText('空格 / 点按 / 触屏点按', W / 2, H * 0.42 + 30);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawBricks() {
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      var col = ROW_COLORS[b.row];
      var grad = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      grad.addColorStop(0, col[1]);
      grad.addColorStop(0.45, col[0]);
      grad.addColorStop(1, col[0]);
      ctx.fillStyle = grad;
      rr(b.x, b.y, b.w, b.h, 5);
      ctx.fill();
      // 顶部高光
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      rr(b.x + 2, b.y + 1.5, b.w - 4, b.h * 0.42, 4);
      ctx.fill();
      // 描边
      ctx.strokeStyle = 'rgba(4,8,16,0.5)';
      ctx.lineWidth = 1;
      rr(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 5);
      ctx.stroke();
    }
  }

  function drawPaddle() {
    var half = paddle.w / 2;
    ctx.save();
    ctx.translate(paddle.x, paddle.y);
    ctx.rotate(paddle.tilt);
    ctx.scale(1, paddle.squash);
    var g = ctx.createLinearGradient(0, -half, 0, half);
    g.addColorStop(0, paddle.flash > 0.2 ? '#9fd0ff' : '#5cb6ff');
    g.addColorStop(1, '#2e8ef0');
    ctx.shadowColor = 'rgba(70,150,255,0.55)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    rr(-half, -paddle.h / 2, paddle.w, paddle.h, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 顶部高光线
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    rr(-half + 6, -paddle.h / 2 + 1.5, paddle.w - 12, 3.5, 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBall() {
    // 光晕 + 球体
    ctx.save();
    ctx.shadowColor = 'rgba(130,210,255,0.9)';
    ctx.shadowBlur = 14;
    var grad = ctx.createRadialGradient(
      ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, ball.r * 0.2,
      ball.x, ball.y, ball.r
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#9fd8ff');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTrail() {
    var n = trail.length;
    for (var i = n - 1; i >= 0; i--) {
      var t = trail[i];
      var f = (n - i) / n;
      ctx.globalAlpha = f * 0.22;
      ctx.fillStyle = '#7fd0ff';
      ctx.beginPath();
      ctx.arc(t.x, t.y, ball.r * (0.3 + 0.7 * f), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPops() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < pops.length; i++) {
      var q = pops[i];
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.font = '700 15px system-ui, "Segoe UI", sans-serif';
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, q.x, q.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawOverlay(main, sub, now, p, kind) {
    var t = now * 0.001;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var cy = H * 0.42;
    // 弹入动画
    var s = 0.6 + 0.4 * easeOutBack(p);
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.scale(s, s);
    ctx.globalAlpha = clamp(p * 2.2, 0, 1);
    ctx.font = '800 46px system-ui, "Segoe UI", sans-serif';
    ctx.fillStyle = '#f4f9ff';
    ctx.fillText(main, 0, 0);
    ctx.restore();
    ctx.globalAlpha = clamp(p * 2.2, 0, 1);
    ctx.font = '600 20px system-ui, "Segoe UI", sans-serif';
    ctx.fillStyle = '#3aa0ff';
    ctx.fillText(sub, W / 2, cy + 44 + Math.sin(t * 3) * 3);
    ctx.globalAlpha = 1;
  }
  function easeOutBack(x) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  /* ---------- 输入 ---------- */
  function toLogical(e) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height)
    };
  }

  function bindCanvas() {
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      ac(); // 首次交互时创建音频上下文
      var p = toLogical(e);
      pointer.active = true;
      pointer.type = e.pointerType || 'mouse';
      pointer.downX = p.x; pointer.downY = p.y; pointer.downT = performance.now();
      paddleTarget = clamp(p.x, paddle.w / 2 + 6, W - paddle.w / 2 - 6);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    });
    canvas.addEventListener('pointermove', function (e) {
      var p = toLogical(e);
      if (e.pointerType === 'mouse' || pointer.active) {
        paddleTarget = clamp(p.x, paddle.w / 2 + 6, W - paddle.w / 2 - 6);
      }
    });
    canvas.addEventListener('pointerup', function (e) {
      var p = toLogical(e);
      var moved = Math.hypot(p.x - pointer.downX, p.y - pointer.downY);
      var quick = (performance.now() - pointer.downT) < 700;
      if (pointer.active && moved < 10 && quick) launch(); // 点按发射
      pointer.active = false;
    });
    canvas.addEventListener('pointercancel', function () { pointer.active = false; });
    canvas.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && !pointer.active) paddleTarget = null;
    });
  }

  function bindKeyboard() {
    window.addEventListener('keydown', function (e) {
      var c = e.code || e.key;
      if (c === 'ArrowLeft' || c === 'KeyA' || c === 'a') { keys.left = true; e.preventDefault(); }
      else if (c === 'ArrowRight' || c === 'KeyD' || c === 'd') { keys.right = true; e.preventDefault(); }
      else if (c === 'Space' || c === ' ') {
        if (!e.repeat) launch();
        e.preventDefault();
      } else if (c === 'KeyR' || c === 'r') {
        startRun();
      }
      ac();
    });
    window.addEventListener('keyup', function (e) {
      var c = e.code || e.key;
      if (c === 'ArrowLeft' || c === 'KeyA' || c === 'a') keys.left = false;
      else if (c === 'ArrowRight' || c === 'KeyD' || c === 'd') keys.right = false;
    });
    window.addEventListener('blur', function () {
      keys.left = false; keys.right = false;
      btnLeft = false; btnRight = false;
      paddleTarget = null;
    });
  }

  function bindTouchBtns() {
    var bL = $('btnL'), bR = $('btnR');
    function hold(btn, set) {
      var on = false;
      var start = function (e) { e.preventDefault(); on = true; set(true); btn.classList.add('active'); };
      var stop = function () { if (on) { on = false; set(false); btn.classList.remove('active'); } };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointercancel', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
    hold(bL, function (v) { btnLeft = v; });
    hold(bR, function (v) { btnRight = v; });
  }

  /* ---------- 主循环 ---------- */
  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000); // 切后台/跳帧保护
    last = ts;
    update(dt);
    draw(ts / 1000);
    requestAnimationFrame(frame);
  }

  /* ---------- 启动 ---------- */
  function init() {
    best = loadBest();
    bindCanvas();
    bindKeyboard();
    bindTouchBtns();
    startRun();
    last = performance.now();
    requestAnimationFrame(frame);
  }

  if (canvas && ctx) init();
})();
