/* ============================================================
   青蛙过河 Frogger · 单机单人
   原生 JavaScript + Canvas，无外部依赖
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 常量与几何 ---------------- */
  var W = 480, H = 540;
  var ROWH = 60;      // 每行高度
  var COLW = 32;      // 青蛙横向步长（15 列）
  var TIME_LIMIT = 40;

  var HOME_ROW = 0;
  var RIVER_ROWS = [1, 2];
  var SAFE_ROW = 3;
  var ROAD_ROWS = [4, 5, 6, 7];
  var START_ROW = 8;

  var BEST_KEY = 'frogger-best';

  var U = 0, D = 1, L = 2, R = 3;
  var DX = [0, 0, -COLW, COLW];

  /* ---------------- DOM ---------------- */
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var scoreVal = document.getElementById('scoreVal');
  var bestVal = document.getElementById('bestVal');
  var lvlVal = document.getElementById('lvlVal');
  var livesVal = document.getElementById('livesVal');
  var timeVal = document.getElementById('timeVal');
  var modal = document.getElementById('modal');
  var modalTitle = document.getElementById('modalTitle');
  var modalSub = document.getElementById('modalSub');
  var btnAgain = document.getElementById('btnAgain');
  var btnRestart = document.getElementById('btnRestart');
  var boardWrap = document.querySelector('.board-wrap');

  /* ---------------- 调色 ---------------- */
  var C = {
    waterTop: '#0d3a66', waterBot: '#08203c',
    grassSafe: '#1e4b34', grassStart: '#1e4b34',
    road: '#232936', curb: '#414a63',
    homeEmpty1: '#12243f', homeEmpty2: '#0a1526',
    log: '#8a5a2f', logHi: '#c0884a', logRing: '#a06a33',
    leaf: '#2fbf6f', leafHi: '#7ee0a8',
    frog: '#3fd47a', frogDark: '#1f8a4a', frogBelly: '#b7f6cd',
    resident: '#ff9ac2'
  };
  var CAR_COLORS = ['#ff5d6c', '#ffb23e', '#4da6ff', '#e05da8', '#c58aff', '#7fd0e8'];

  /* ---------------- 工具 ---------------- */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadBest() {
    try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; }
    catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 主状态 ---------------- */
  var best = loadBest();
  var filled = [false, false, false, false, false];
  var score = 0, lives = 3, level = 1;
  var timer = TIME_LIMIT;
  var lastTimerShown = -1;
  var phase = 'boot';   // count / play / dead / celebrate / over
  var count = null;     // {kind:'intro'|'ready', t, dur}
  var death = null;     // {kind:'car'|'water'|'time', t, dur}
  var celebrate = null; // {t, dur, win}
  var banners = [];     // {text,t,dur,size,color}
  var particles = [];
  var floatTexts = [];

  /* ---------------- 青蛙 ---------------- */
  var frog = {
    x: W / 2, y: START_ROW * ROWH + ROWH / 2,
    row: START_ROW,
    face: U,
    hopping: false, hidden: false, riding: null,
    hop: null,
    blinkT: 3, blinkOn: 0
  };

  /* ---------------- 车道 / 河道 ---------------- */
  var lanes = [
    { row: 4, dir: 1, base: 84,  gapMin: 120, gapMax: 190 },
    { row: 5, dir: -1, base: 72, gapMin: 120, gapMax: 190 },
    { row: 6, dir: 1, base: 60,  gapMin: 120, gapMax: 190 },
    { row: 7, dir: -1, base: 50, gapMin: 110, gapMax: 180 }
  ];
  var rivers = [
    { row: 1, dir: -1, base: 62, lenMin: 150, lenMax: 192, gapMin: 40, gapMax: 72, leafChance: .12 },
    { row: 2, dir: 1,  base: 86, lenMin: 116, lenMax: 152, gapMin: 44, gapMax: 78, leafChance: .2 }
  ];
  // 每个车道/河道对象：{ objs:[], v(带方向速度 px/s), spawnIn }

  /* ---------------- 计时/动画变量 ---------------- */
  var lastTs = 0;
  var timeAcc = 0;      // 全局时钟（驱动浪花/灯光等）
  var shakeT = 0;

  /* ============================================================
     构造与重开
     ============================================================ */
  function speedFactor(k) { return 1 + 0.07 * (k - 1); }

  function addScore(v) {
    score += v;
    if (score > best) { best = score; saveBest(best); }
    refreshHUD();
    scoreVal.classList.remove('bump');
    void scoreVal.offsetWidth;
    scoreVal.classList.add('bump');
  }

  function refreshHUD() {
    scoreVal.textContent = score;
    bestVal.textContent = best;
    lvlVal.textContent = level + '/5';
    livesVal.textContent = lives;
    var s = Math.max(0, Math.ceil(timer));
    timeVal.textContent = s;
    lastTimerShown = s;
    timeVal.classList.toggle('low', s <= 10 && phase === 'play');
  }

  function tickTimerUI() {
    var s = Math.max(0, Math.ceil(timer));
    if (s === lastTimerShown) return;
    lastTimerShown = s;
    timeVal.textContent = s;
    timeVal.classList.toggle('low', s <= 10 && phase === 'play');
  }

  function resetFrog() {
    frog.x = W / 2;
    frog.row = START_ROW;
    frog.y = START_ROW * ROWH + ROWH / 2;
    frog.face = U;
    frog.hopping = false;
    frog.hidden = false;
    frog.riding = null;
    frog.hop = null;
  }

  /* 预铺 + 持续生成：车道 */
  function buildLanes(k) {
    var f = speedFactor(k);
    lanes.forEach(function (lane) {
      var sp = lane.base * f;
      lane.v = lane.dir * sp;
      lane.objs = [];
      // 预铺满屏幕（从入口侧向对侧）
      var front = (lane.dir > 0) ? -140 : W + 140;
      var step = (lane.dir > 0) ? 1 : -1;
      var guard = 0;
      while (guard++ < 80) {
        if (step > 0 && front > W + 160) break;
        if (step < 0 && front < -160) break;
        var len = pickCarLen();
        var kind = Math.random() < 0.28 ? 'truck' : 'car';
        lane.objs.push(makeCar(lane, kind, len, front));
        front += step * (len + rand(lane.gapMin, lane.gapMax));
      }
      // 首个运行时生成：等入口处对象完全入场，避免叠影
      var anchor = lane.objs[0];
      var abs = Math.abs(lane.v);
      lane.spawnIn = lane.dir > 0
        ? Math.max(0.35, (0 - anchor.x) / abs)
        : Math.max(0.35, (anchor.x + anchor.w - W) / abs);
    });
  }
  function pickCarLen() {
    return rand(42, 54);
  }
  function makeCar(lane, kind, len, front) {
    var color = CAR_COLORS[randi(0, CAR_COLORS.length - 1)];
    var x = (lane.dir > 0) ? front : (front - len);
    return {
      lane: lane.row, x: x, w: len,
      kind: kind, color: color,
      hw: len / 2 - 4,
      id: Math.random()
    };
  }

  /* 河道：原木 / 荷叶 */
  function buildRivers(k) {
    var f = speedFactor(k);
    rivers.forEach(function (rv) {
      var sp = rv.base * f;
      rv.v = rv.dir * sp;
      rv.objs = [];
      var front = (rv.dir > 0) ? -200 : W + 200;
      var step = (rv.dir > 0) ? 1 : -1;
      var guard = 0;
      while (guard++ < 60) {
        if (step > 0 && front > W + 220) break;
        if (step < 0 && front < -220) break;
        var len = rand(rv.lenMin, rv.lenMax);
        var isLeaf = Math.random() < rv.leafChance;
        if (isLeaf) len = rand(58, 78);
        rv.objs.push(makeRide(rv, len, front, isLeaf));
        front += step * (len + rand(rv.gapMin, rv.gapMax));
      }
      // 首个运行时生成：等入口处对象完全入场
      var anchor = rv.objs[0];
      var abs = Math.abs(rv.v);
      rv.spawnIn = rv.dir > 0
        ? Math.max(0.35, (0 - anchor.x) / abs)
        : Math.max(0.35, (anchor.x + anchor.w - W) / abs);
    });
  }
  function makeRide(rv, len, front, isLeaf) {
    var x = (rv.dir > 0) ? front : (front - len);
    return {
      row: rv.row, x: x, w: len, prevX: x,
      leaf: isLeaf, ph: Math.random() * 6.28,
      id: Math.random()
    };
  }

  function buildLevel(k) {
    buildLanes(k);
    buildRivers(k);
  }

  function restartRun() {
    clearTimeout(window.__froggerT1);
    score = 0; lives = 3; level = 1;
    filled = [false, false, false, false, false];
    particles.length = 0;
    floatTexts.length = 0;
    banners.length = 0;
    buildLevel(level);
    resetFrog();
    timer = TIME_LIMIT;
    death = null;
    celebrate = null;
    hideModal();
    refreshHUD();
    phase = 'count';
    count = { kind: 'intro', t: 0, dur: 1.5 };
  }

  /* ============================================================
     输入
     ============================================================ */
  function tryMove(dir) {
    if (phase !== 'play') return;
    if (frog.hidden || frog.hopping) return;
    var nx = frog.x, nrow = frog.row;
    if (dir === U || dir === D) {
      nrow = frog.row + (dir === U ? -1 : 1);
      if (nrow < 0 || nrow > START_ROW) return;
    } else {
      nx = frog.x + DX[dir];
      if (nx < COLW / 2 || nx > W - COLW / 2) return;
    }
    var tx = nx;
    var ty = nrow * ROWH + ROWH / 2;
    frog.face = dir;
    frog.riding = null;
    frog.hopping = true;
    frog.row = nrow;
    frog.hop = { fx: frog.x, fy: frog.y, tx: tx, ty: ty, t: 0, dur: 0.15 };
    // 从水里起跳：溅起小水花
    if (RIVER_ROWS.indexOf(frog.row) >= 0 || RIVER_ROWS.indexOf(nrow) >= 0) {
      if (dir === U || dir === D) {
        spawnRipple(frog.x, frog.y + (dir === U ? 10 : -10), 6, 'rgba(200,230,255,.5)');
      }
    }
  }

  function onKey(e) {
    var k = e.key;
    var map = {
      ArrowUp: U, ArrowDown: D, ArrowLeft: L, ArrowRight: R,
      w: U, s: D, a: L, d: R, W: U, S: D, A: L, D: R
    };
    if (k === 'r' || k === 'R') { restartRun(); e.preventDefault(); return; }
    if (modal.classList.contains('show')) {
      if (k === 'Enter' || k === ' ') { restartRun(); e.preventDefault(); }
      return;
    }
    if (k in map) {
      tryMove(map[k]);
      e.preventDefault();
    }
    if (k === ' ') e.preventDefault();
  }

  /* ============================================================
     死亡 / 进家 / 庆祝 流程
     ============================================================ */
  function startDeath(kind) {
    if (phase !== 'play') return;
    phase = 'dead';
    death = {
      kind: kind,
      t: 0,
      dur: kind === 'car' ? 0.5 : (kind === 'time' ? 0.9 : 1.0)
    };
    frog.hopping = false;
    frog.riding = null;
    if (kind === 'water' || kind === 'time') {
      spawnRipple(frog.x, frog.y + 6, 10, 'rgba(160,220,255,.8)');
      if (kind === 'time') addBanner('时间到', 0.8, 34, '#ffb23e');
      else addBanner('落水啦！', 0.8, 30, '#4da6ff');
    } else {
      addBanner('撞车了！', 0.7, 30, '#ff5d6c');
      spawnStars(frog.x, frog.y, 8);
    }
  }

  function doHome(slot) {
    filled[slot] = true;
    addScore(50);
    var cx = slot * 96 + 48, cy = HOME_ROW * ROWH + 34;
    spawnRing(cx, cy, '#ffd166');
    spawnSparks(cx, cy, 14);
    addFloat(cx, cy - 22, '+50', '#ffd166', 18);
    // 成功进家：生命补至上限 3，鼓励连续挑战
    if (lives < 3) { lives = Math.min(3, lives + 1); refreshHUD(); }
    frog.hidden = true;
    frog.hopping = false;
    var all = filled.every(Boolean);
    if (all) {
      addScore(100);
      addFloat(W / 2, H * 0.3, '过关奖励 +100', '#34d399', 22);
      addBanner('全部家穴已占满！', 1.1, 34, '#34d399');
      celebrate = { t: 0, dur: 1.6, win: true };
      confettiRain();
    } else {
      celebrate = { t: 0, dur: 1.0, win: false };
    }
    phase = 'celebrate';
  }

  function finishCelebrate(win) {
    if (win) {
      phase = 'over';
      window.__froggerT1 = setTimeout(function () {
        showModal(true);
      }, 500);
      return;
    }
    level++;
    buildLevel(level);
    resetFrog();
    timer = TIME_LIMIT;
    refreshHUD();
    phase = 'count';
    count = { kind: 'ready', t: 0, dur: 0.9 };
  }

  function finishDeath() {
    lives--;
    refreshHUD();
    if (lives <= 0) {
      phase = 'over';
      frog.hidden = true;
      window.__froggerT1 = setTimeout(function () {
        showModal(false);
      }, 450);
      return;
    }
    resetFrog();
    timer = TIME_LIMIT;
    refreshHUD();
    phase = 'count';
    count = { kind: 'ready', t: 0, dur: 0.9 };
  }

  /* ============================================================
     粒子 / 特效
     ============================================================ */
  function pushP(p) {
    if (particles.length > 300) particles.shift();
    particles.push(p);
  }
  function spawnSparks(x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283;
      var sp = rand(40, 130);
      pushP({
        type: 'spark', x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: rand(.35, .7), max: .7, size: rand(2, 4.5),
        color: ['#ffd166', '#ff9ac2', '#34d399', '#ff5d6c'][randi(0, 3)]
      });
    }
  }
  function spawnRing(x, y, color) {
    pushP({ type: 'ring', x: x, y: y, life: .55, max: .55, size: 8, color: color });
  }
  function spawnRipple(x, y, size, color) {
    pushP({ type: 'ring', x: x, y: y, life: .5, max: .5, size: size, color: color, wide: true });
  }
  function spawnStars(x, y, n) {
    for (var i = 0; i < n; i++) {
      pushP({
        type: 'star', x: x + rand(-10, 10), y: y + rand(-8, 8),
        vx: rand(-30, 30), vy: rand(-70, -20),
        life: rand(.4, .8), max: .8, size: rand(4, 8), color: '#fff3b0'
      });
    }
  }
  function spawnBubble(x, y) {
    pushP({
      type: 'bubble', x: x + rand(-8, 8), y: y,
      vx: rand(-8, 8), vy: rand(-45, -18),
      life: rand(.5, 1), max: 1, size: rand(1.6, 4), color: '#bfe6ff'
    });
  }
  function confettiRain() {
    for (var i = 0; i < 46; i++) {
      pushP({
        type: 'confetti', x: rand(0, W), y: rand(-80, 40),
        vx: rand(-16, 16), vy: rand(50, 130),
        life: rand(1.4, 2.6), max: 2.6, size: rand(3, 6),
        rot: rand(0, 6.28), vr: rand(-6, 6),
        color: ['#ffd166', '#ff5d6c', '#34d399', '#4da6ff', '#c58aff'][randi(0, 4)]
      });
    }
  }

  function addFloat(x, y, text, color, size) {
    floatTexts.push({ x: x, y: y, text: text, color: color, size: size || 16, t: 0, dur: 1 });
  }
  function addBanner(text, dur, size, color) {
    banners.push({ text: text, t: 0, dur: dur, size: size || 30, color: color || '#fff' });
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'confetti' || p.type === 'spark') p.vy += 220 * dt;
      if (p.rot !== undefined) p.rot += p.vr * dt;
    }
    for (var j = floatTexts.length - 1; j >= 0; j--) {
      var f = floatTexts[j];
      f.t += dt;
      if (f.t > f.dur) floatTexts.splice(j, 1);
    }
    for (var k = banners.length - 1; k >= 0; k--) {
      banners[k].t += dt;
      if (banners[k].t > banners[k].dur) banners.splice(k, 1);
    }
  }

  function drawParticles() {
    particles.forEach(function (p) {
      var k = p.life / p.max;
      ctx.globalAlpha = clamp(k, 0, 1);
      if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, 6.283);
        ctx.fill();
      } else if (p.type === 'ring') {
        var grow = p.wide ? 1 - k : k;
        var rad = p.size + (p.wide ? (1 - k) * 26 : (1 - k) * 34);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + 2 * k;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad * (p.wide ? 1 : grow), 0, 6.283);
        ctx.stroke();
      } else if (p.type === 'bubble') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 6.283);
        ctx.stroke();
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.t * 6);
        ctx.font = p.size + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✦', 0, 0);
        ctx.restore();
      } else if (p.type === 'confetti') {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    });
    ctx.globalAlpha = 1;
    // 浮动文字
    floatTexts.forEach(function (f) {
      var k = f.t / f.dur;
      ctx.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3;
      ctx.fillStyle = f.color;
      ctx.font = '700 ' + f.size + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y - k * 34);
    });
    ctx.globalAlpha = 1;
  }

  /* ============================================================
     静态背景（离屏，只画一次）
     ============================================================ */
  var staticCv = null;
  function buildStaticBg() {
    staticCv = document.createElement('canvas');
    staticCv.width = W; staticCv.height = H;
    var c = staticCv.getContext('2d');

    // 整体底色
    c.fillStyle = '#0b1a2e';
    c.fillRect(0, 0, W, H);

    // ---- 顶部家穴区 y:0-60 ----
    c.fillStyle = '#152640';
    c.fillRect(0, 0, W, 60);
    for (var i = 0; i < 5; i++) {
      var gx = c.createLinearGradient(0, 8, 0, 52);
      gx.addColorStop(0, C.homeEmpty1);
      gx.addColorStop(1, C.homeEmpty2);
      c.fillStyle = gx;
      rr(i * 96 + 9, 7, 78, 46, 13);
      c.fill();
      c.strokeStyle = '#2b4a77';
      c.lineWidth = 2;
      rr(i * 96 + 9, 7, 78, 46, 13);
      c.stroke();
    }

    // ---- 河道底色 y:60-180 ----
    var gw = c.createLinearGradient(0, 60, 0, 180);
    gw.addColorStop(0, C.waterTop);
    gw.addColorStop(1, C.waterBot);
    c.fillStyle = gw;
    c.fillRect(0, 60, W, 120);

    // ---- 安全带 y:180-240 ----
    c.fillStyle = C.grassSafe;
    c.fillRect(0, 180, W, 60);
    flowers(c, 205);
    c.fillStyle = '#153a28';
    c.fillRect(0, 237, W, 3);

    // ---- 公路 y:240-480（4 条车道） ----
    c.fillStyle = C.road;
    c.fillRect(0, 240, W, 240);
    // 车道分隔浅线（行边界）
    c.fillStyle = '#2c3244';
    [300, 360, 420].forEach(function (yy) {
      c.fillRect(0, yy, W, 2);
    });
    // 路边石
    c.fillStyle = C.curb;
    c.fillRect(0, 240, W, 5);
    c.fillRect(0, 475, W, 5);

    // ---- 起始带 y:480-540 ----
    c.fillStyle = C.grassStart;
    c.fillRect(0, 480, W, 60);
    c.fillStyle = '#153a28';
    c.fillRect(0, 480, W, 4);
    flowers(c, 510);
    // 起点圆台
    c.fillStyle = '#0f2c1d';
    c.beginPath();
    c.ellipse(W / 2, 522, 66, 22, 0, 0, 6.283);
    c.fill();
    c.strokeStyle = '#3f8f5e';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(W / 2, 522, 52, 16, 0, 0, 6.283);
    c.stroke();
    c.fillStyle = '#3f8f5e';
    c.font = '700 15px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText('起 点', W / 2, 527);
  }
  function flowers(c, y) {
    c.fillStyle = 'rgba(255,255,255,.1)';
    for (var x = 16; x < W; x += 56) {
      c.beginPath();
      c.arc(x, y - 6, 2, 0, 6.283);
      c.arc(x + 24, y + 12, 2, 0, 6.283);
      c.fill();
    }
  }

  /* ============================================================
     逐帧更新
     ============================================================ */
  function updateWorld(dt) {
    timeAcc += dt;

    // 车辆
    lanes.forEach(function (lane) {
      lane.spawnIn -= dt;
      var arr = lane.objs;
      for (var i = arr.length - 1; i >= 0; i--) {
        var o = arr[i];
        o.x += lane.v * dt;
        if ((lane.dir > 0 && o.x > W + 80) || (lane.dir < 0 && o.x + o.w < -80)) {
          arr.splice(i, 1);
        }
      }
      if (lane.spawnIn <= 0) {
        var len = pickCarLen();
        var kind = Math.random() < 0.28 ? 'truck' : 'car';
        var front = lane.dir > 0 ? -len : W + len;
        arr.push(makeCar(lane, kind, len, front));
        lane.spawnIn = (len + rand(lane.gapMin, lane.gapMax)) / Math.abs(lane.v);
      }
    });

    // 原木 / 荷叶
    rivers.forEach(function (rv) {
      rv.spawnIn -= dt;
      var arr = rv.objs;
      for (var i = arr.length - 1; i >= 0; i--) {
        var o = arr[i];
        o.prevX = o.x;             // 记录本帧移动前位置（供青蛙随流）
        o.x += rv.v * dt;
        if ((rv.dir > 0 && o.x > W + 120) || (rv.dir < 0 && o.x + o.w < -120)) {
          arr.splice(i, 1);
        }
      }
      if (rv.spawnIn <= 0) {
        var len = rand(rv.lenMin, rv.lenMax);
        var isLeaf = Math.random() < rv.leafChance;
        if (isLeaf) len = rand(58, 78);
        var front = rv.dir > 0 ? -len : W + len;
        arr.push(makeRide(rv, len, front, isLeaf));
        rv.spawnIn = (len + rand(rv.gapMin, rv.gapMax)) / Math.abs(rv.v);
      }
    });

    updateParticles(dt);
  }

  function updateFrog(dt) {
    if (frog.hidden) return;

    // 跳跃动画
    if (frog.hopping && frog.hop) {
      var h = frog.hop;
      h.t += dt;
      var k = clamp(h.t / h.dur, 0, 1);
      var e = easeInOut(k);
      frog.x = lerp(h.fx, h.tx, e);
      frog.y = lerp(h.fy, h.ty, e);
      if (k >= 1) {
        frog.hopping = false;
        frog.hop = null;
        frog.x = h.tx;
        frog.y = h.ty;
        settleOnLand();
      }
      return;
    }

    // 河道行：找原木/荷叶骑乘
    if (RIVER_ROWS.indexOf(frog.row) >= 0) {
      var ride = findRide(frog.row, frog.x);
      if (ride) {
        frog.riding = ride;
        // 青蛙随原木本帧位移移动（原木已在 updateWorld 中移动）
        frog.x += (ride.x - ride.prevX);
        frog.x = clamp(frog.x, COLW / 2, W - COLW / 2);
      } else {
        frog.riding = null;
        startDeath('water');
        return;
      }
    } else {
      frog.riding = null;
    }

    // 公路行：碰撞检测
    if (ROAD_ROWS.indexOf(frog.row) >= 0) {
      var cars = laneObjs(frog.row);
      for (var i = 0; i < cars.length; i++) {
        var o = cars[i];
        if (Math.abs(o.x + o.w / 2 - frog.x) < o.hw + 11) {
          startDeath('car');
          return;
        }
      }
    }

    // 家穴行：到达空家穴自动进家
    if (frog.row === HOME_ROW) {
      var slot = Math.floor(frog.x / 96);
      if (slot >= 0 && slot < 5 && !filled[slot]) {
        doHome(slot);
      }
    }
  }

  function settleOnLand() {
    if (frog.row === HOME_ROW) {
      var slot = Math.floor(frog.x / 96);
      if (slot >= 0 && slot < 5 && !filled[slot]) {
        doHome(slot);
        return;
      }
    }
    if (RIVER_ROWS.indexOf(frog.row) >= 0 && !findRide(frog.row, frog.x)) {
      startDeath('water');
      return;
    }
    if (ROAD_ROWS.indexOf(frog.row) >= 0) {
      var cars = laneObjs(frog.row);
      for (var i = 0; i < cars.length; i++) {
        var o = cars[i];
        if (Math.abs(o.x + o.w / 2 - frog.x) < o.hw + 11) {
          startDeath('car');
          return;
        }
      }
    }
  }

  function findRide(row, x) {
    var arr = rideObjs(row);
    for (var i = 0; i < arr.length; i++) {
      var o = arr[i];
      if (x > o.x + 7 && x < o.x + o.w - 7) return o;
    }
    return null;
  }
  function laneObjs(row) {
    for (var i = 0; i < lanes.length; i++) if (lanes[i].row === row) return lanes[i].objs;
    return [];
  }
  function rideObjs(row) {
    for (var i = 0; i < rivers.length; i++) if (rivers[i].row === row) return rivers[i].objs;
    return [];
  }

  /* ---------------- 主循环 ---------------- */
  function frame(ts) {
    requestAnimationFrame(frame);
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    tickTimerUI();

    // 阶段推进
    if (phase === 'count' && count) {
      count.t += dt;
      if (count.t >= count.dur) {
        if (count.kind === 'intro') {
          addBanner('出发！', 0.5, 40, '#34d399');
        }
        phase = 'play';
        timer = TIME_LIMIT;
        count = null;
        refreshHUD();
      }
    } else if (phase === 'play') {
      timer -= dt;
      if (timer <= 0 && !frog.hopping) {
        timer = 0;
        startDeath('time');
      }
      if (phase === 'play') updateFrog(dt);
    } else if (phase === 'dead' && death) {
      death.t += dt;
      if (death.kind !== 'car' && death.t > 0.15) {
        if (Math.random() < 0.25) spawnBubble(frog.x, frog.y + 4);
      }
      if (death.t >= death.dur) {
        death = null;
        finishDeath();
      }
    } else if (phase === 'celebrate' && celebrate) {
      celebrate.t += dt;
      if (celebrate.t >= celebrate.dur) {
        var w = celebrate.win;
        celebrate = null;
        finishCelebrate(w);
      }
    }

    if (phase !== 'over') {
      updateWorld(dt);
    }
    // 低血量时间警告震屏参数
    if (shakeT > 0) shakeT -= dt;

    render();
  }

  /* ============================================================
     渲染
     ============================================================ */
  function render() {
    if (staticCv) ctx.drawImage(staticCv, 0, 0);
    else { ctx.fillStyle = '#0b1a2e'; ctx.fillRect(0, 0, W, H); }

    drawWaterFX();
    drawRoadFX();
    drawRides();
    drawCars();
    drawHomes();   // 家穴在青蛙下方绘制，青蛙走在上面不会被遮挡

    if (!frog.hidden) {
      if (phase === 'dead' && death) drawDeadFrog();
      else drawLiveFrog();
    }
    drawParticles();
    drawBanners();
    if (phase === 'count' && count) drawCountdown();
  }

  /* 水流动画 */
  function drawWaterFX() {
    var t = timeAcc;
    ctx.save();
    // 波光细线
    ctx.strokeStyle = 'rgba(190,225,255,.16)';
    ctx.lineWidth = 1.5;
    for (var r = 0; r < rivers.length; r++) {
      var rv = rivers[r];
      var cy = rv.row * ROWH + ROWH / 2;
      var dir = rv.v >= 0 ? 1 : -1;
      for (var line = -1; line <= 1; line++) {
        var yy = cy + line * 16;
        ctx.beginPath();
        for (var x = -20; x <= W + 20; x += 14) {
          var px = x + ((t * (30 + rv.row * 14) * dir) % 42);
          var py = yy + Math.sin(x * 0.04 + t * 2.2 + rv.row) * 2.6;
          if (x === -20) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // 上下边缘浪花
      for (var e = 0; e < 2; e++) {
        var ey = (rv.row * ROWH) + (e === 0 ? 4 : ROWH - 4);
        ctx.strokeStyle = 'rgba(210,240,255,.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (var x2 = -4; x2 <= W + 4; x2 += 8) {
          var py2 = ey + Math.sin(x2 * 0.09 + t * (e === 0 ? 2 : -1.6) + rv.row * 2) * 2.4;
          if (x2 === -4) ctx.moveTo(x2, py2); else ctx.lineTo(x2, py2);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* 车道虚线滚动（速度提示） */
  function drawRoadFX() {
    var t = timeAcc;
    lanes.forEach(function (lane) {
      var cy = lane.row * ROWH + ROWH / 2;
      var sp = Math.abs(lane.v) * 0.55;
      var period = 60;
      var off = ((t * sp) % period) * (lane.v >= 0 ? 1 : -1);
      ctx.fillStyle = 'rgba(150,165,200,.22)';
      for (var x = -period; x < W + period; x += period) {
        ctx.fillRect(x + off, cy - 1.5, 34, 3);
      }
    });
  }

  /* 原木 + 荷叶 */
  function drawRides() {
    rivers.forEach(function (rv) {
      var cy = rv.row * ROWH + ROWH / 2;
      rv.objs.forEach(function (o) {
        var bob = Math.sin(timeAcc * 1.8 + o.ph) * 1.6;
        if (o.leaf) {
          var lx = o.x + o.w / 2, ly = cy + bob;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(Math.sin(timeAcc * 1.1 + o.ph) * 0.12);
          ctx.fillStyle = 'rgba(0,0,0,.28)';
          ctx.beginPath();
          ctx.ellipse(2, 10, o.w / 2, 7, 0, 0, 6.283);
          ctx.fill();
          ctx.fillStyle = C.leaf;
          ctx.beginPath();
          ctx.ellipse(0, 0, o.w / 2, 13, 0, 0, 6.283);
          ctx.fill();
          ctx.fillStyle = C.leafHi;
          ctx.beginPath();
          ctx.ellipse(-3, -3, o.w / 2 - 5, 8, 0, 0, 6.283);
          ctx.fill();
          ctx.strokeStyle = '#1e7a45';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-o.w / 2 + 6, 0);
          ctx.lineTo(o.w / 2 - 6, 0);
          ctx.stroke();
          // 荷叶缺口
          ctx.fillStyle = C.waterTop;
          ctx.beginPath();
          ctx.arc(o.w * 0.22, 2, 4.5, 0, 6.283);
          ctx.fill();
          ctx.restore();
        } else {
          var y = cy + bob;
          // 水下阴影
          ctx.fillStyle = 'rgba(0,0,0,.22)';
          rr(o.x + 3, y + 9, o.w - 6, 8, 4);
          ctx.fill();
          // 圆木主体
          var lg = ctx.createLinearGradient(0, y - 13, 0, y + 13);
          lg.addColorStop(0, C.logHi);
          lg.addColorStop(0.4, C.log);
          lg.addColorStop(1, '#5f3d1f');
          ctx.fillStyle = lg;
          rr(o.x, y - 13, o.w, 26, 13);
          ctx.fill();
          ctx.strokeStyle = 'rgba(40,22,8,.55)';
          ctx.lineWidth = 1.5;
          rr(o.x, y - 13, o.w, 26, 13);
          ctx.stroke();
          // 顶部高光
          ctx.fillStyle = 'rgba(255,230,180,.35)';
          rr(o.x + 10, y - 9, o.w - 20, 3.5, 2);
          ctx.fill();
          // 木纹
          ctx.strokeStyle = 'rgba(70,45,20,.5)';
          ctx.lineWidth = 1;
          for (var s = 1; s < 5; s++) {
            var sx = o.x + (o.w / 5) * s;
            ctx.beginPath();
            ctx.moveTo(sx, y - 9);
            ctx.quadraticCurveTo(sx + 3, y, sx, y + 9);
            ctx.stroke();
          }
          // 两端年轮 + 浪花
          ctx.fillStyle = '#e0b176';
          ctx.beginPath();
          ctx.ellipse(o.x + 6, y, 5, 10, 0, 0, 6.283);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(o.x + o.w - 6, y, 5, 10, 0, 0, 6.283);
          ctx.fill();
          ctx.strokeStyle = 'rgba(120,80,35,.7)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(o.x + 6, y, 2.6, 6, 0, 0, 6.283);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(o.x + o.w - 6, y, 2.6, 6, 0, 0, 6.283);
          ctx.stroke();
          // 尾端浪花（行进方向后方）
          var dirS = rv.v >= 0 ? 1 : -1;
          var wx = dirS > 0 ? o.x + o.w : o.x;
          var wy = y + 4 + Math.sin(timeAcc * 9 + o.ph) * 1.5;
          ctx.strokeStyle = 'rgba(210,240,255,.4)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(wx - dirS * 3, wy, 5 + Math.sin(timeAcc * 6 + o.ph) * 1.6, 0, 6.283);
          ctx.stroke();
        }
      });
    });
  }

  /* 车辆 */
  function drawCars() {
    lanes.forEach(function (lane) {
      var cy = lane.row * ROWH + ROWH / 2;
      lane.objs.forEach(function (o) {
        var fwd = lane.v >= 0 ? 1 : -1;
        var w = o.w, h = o.kind === 'truck' ? 38 : 32;
        var x = o.x, y = cy - h / 2;
        // 车底阴影
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h + 4, w / 2 + 2, 5, 0, 0, 6.283);
        ctx.fill();
        // 车身
        ctx.fillStyle = o.color;
        rr(x, y, w, h, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        rr(x, y + h * 0.55, w, h * 0.45, 6);
        ctx.fill();
        // 驾驶室 / 车窗
        if (o.kind === 'truck') {
          // 货厢在前/后依方向
          var cabX = fwd > 0 ? x + w * 0.72 : x;
          ctx.fillStyle = '#dfe7f5';
          rr(cabX, y + h * 0.2, w * 0.24, h * 0.5, 3);
          ctx.fill();
          ctx.strokeStyle = 'rgba(20,25,40,.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(cabX, y + h * 0.2, w * 0.24, h * 0.5);
        } else {
          var winW = w * 0.3;
          var winX = fwd > 0 ? x + w * 0.12 : x + w * 0.58;
          ctx.fillStyle = '#cfe0f5';
          rr(winX, y + h * 0.16, winW, h * 0.42, 3);
          ctx.fill();
          ctx.strokeStyle = 'rgba(20,25,40,.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(winX, y + h * 0.16, winW, h * 0.42);
        }
        // 车轮
        ctx.fillStyle = '#141821';
        var wheelYs = [y + h * 0.16, y + h * 0.72];
        for (var wi = 0; wi < wheelYs.length; wi++) {
          rr(x + 4, wheelYs[wi], w * 0.16, 5, 2);
          ctx.fill();
          rr(x + w - w * 0.16 - 4, wheelYs[wi], w * 0.16, 5, 2);
          ctx.fill();
        }
        // 车灯（小动画：脉冲）
        var pulse = 0.6 + Math.sin(timeAcc * 9 + o.id * 10) * 0.4;
        var hlx = fwd > 0 ? x + w - 2 : x;
        var tlx = fwd > 0 ? x : x + w - 2;
        // 前灯（行进方向）
        ctx.fillStyle = '#fff3c0';
        ctx.beginPath();
        ctx.arc(hlx, y + h * 0.3, 3.2, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,240,170,.3)';
        ctx.beginPath();
        ctx.arc(hlx, y + h * 0.3, 5.5 + pulse * 2, 0, 6.283);
        ctx.fill();
        // 尾灯
        ctx.fillStyle = '#ff5d6c';
        ctx.beginPath();
        ctx.arc(tlx, y + h * 0.3, 2.6, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,93,108,.25)';
        ctx.beginPath();
        ctx.arc(tlx, y + h * 0.3, 4.5 + pulse, 0, 6.283);
        ctx.fill();
      });
    });
  }

  /* 家穴（已占用用颜色区分 + 光效） */
  function drawHomes() {
    for (var i = 0; i < 5; i++) {
      var cx = i * 96 + 48;
      if (filled[i]) {
        var g = ctx.createLinearGradient(0, 7, 0, 53);
        g.addColorStop(0, '#1c5c3a');
        g.addColorStop(1, '#0e3a22');
        ctx.fillStyle = g;
        rr(i * 96 + 9, 7, 78, 46, 13);
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        rr(i * 96 + 9, 7, 78, 46, 13);
        ctx.stroke();
        // 金光呼吸
        var pulse = 0.5 + Math.sin(timeAcc * 3 + i * 1.3) * 0.5;
        ctx.fillStyle = 'rgba(255,209,102,' + (0.08 + pulse * 0.08) + ')';
        rr(i * 96 + 4, 2, 88, 56, 15);
        ctx.fill();
        drawResident(cx, 30);
      } else {
        // 微光闪烁
        var s = 0.5 + Math.sin(timeAcc * 2.4 + i * 2) * 0.5;
        ctx.fillStyle = 'rgba(120,180,255,' + (0.03 + s * 0.05) + ')';
        rr(i * 96 + 9, 7, 78, 46, 13);
        ctx.fill();
      }
    }
  }

  function drawResident(x, y) {
    drawFrogSprite(x, y, 0.55, {
      body: C.resident, dark: '#b34d7d', belly: '#ffd9ea'
    }, U, 1, 1, Math.sin(timeAcc * 2.5) * 0.04);
  }

  /* 青蛙绘制 */
  function drawLiveFrog() {
    var s = 1, sy = 1, altY = 0;
    var breathe = 1 + Math.sin(timeAcc * 4) * 0.02;
    if (frog.hopping && frog.hop) {
      var k = clamp(frog.hop.t / frog.hop.dur, 0, 1);
      altY = -Math.sin(Math.PI * k) * 20;
      // 起跳压缩 / 空中拉伸 / 落地压缩
      var st = Math.sin(Math.PI * k);
      if (k < 0.12) { sy = 0.86; s = 1.12; }
      else if (k > 0.88) { sy = 0.84; s = 1.14; }
      else { sy = 1 + st * 0.16; s = 1 - st * 0.08; }
      // 影子
      ctx.fillStyle = 'rgba(0,0,0,' + (0.25 * (1 - st)) + ')';
      ctx.beginPath();
      ctx.ellipse(frog.x, frog.y + 14, 16 * (1 + st * 0.15), 5 * (1 - st * 0.35), 0, 0, 6.283);
      ctx.fill();
    }
    // 呼吸眨眼
    frog.blinkT -= 1 / 60;
    if (frog.blinkT <= 0) { frog.blinkOn = 0.12; frog.blinkT = rand(2.4, 5.2); }
    if (frog.blinkOn > 0) frog.blinkOn -= 1 / 60;

    var bob = 0;
    if (RIVER_ROWS.indexOf(frog.row) >= 0 && frog.riding) {
      bob = Math.sin(timeAcc * 2 + frog.x * 0.02) * 1.8;
    }
    drawFrogSprite(frog.x, frog.y + altY + bob, 1, null, frog.face, s * breathe, sy, 0);
  }

  function drawDeadFrog() {
    var d = death;
    var p = clamp(d.t / d.dur, 0, 1);
    if (d.kind === 'car') {
      // 压扁 + 星星
      var squ = 1 - p * 0.88;
      ctx.save();
      ctx.translate(frog.x, frog.y + p * 5);
      ctx.scale(1 + p * 0.5, Math.max(squ, 0.06));
      drawFrogSprite(0, 0, 1, null, frog.face, 1, 1, p * 0.5);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      // 沉没 / 时间到
      var pre = 0.18;
      var sink = p > pre ? (p - pre) / (1 - pre) : 0;
      ctx.save();
      ctx.translate(frog.x, frog.y + sink * 30);
      ctx.rotate(sink * 0.5);
      ctx.globalAlpha = 1 - sink;
      var tint = d.kind === 'time' ? { body: '#aab8c8', dark: '#5a6a80', belly: '#cfd8e0' } : { body: '#5aa0c8', dark: '#2a5a80', belly: '#a8d0e0' };
      drawFrogSprite(0, 0, 1 - sink * 0.35, tint, frog.face, 1, 1, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  /* 通用青蛙精灵（面向 up，绕中心旋转） */
  function drawFrogSprite(x, y, scale, palette, face, sx, sy, rot) {
    var pal = palette || { body: C.frog, dark: C.frogDark, belly: C.frogBelly };
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.rotate(face === D ? Math.PI : (face === L ? -Math.PI / 2 : (face === R ? Math.PI / 2 : 0)));
    ctx.scale(sx * scale, sy * scale);

    // 后腿
    ctx.fillStyle = pal.dark;
    ctx.beginPath();
    ctx.ellipse(-11, 7, 7, 4.5, -0.4, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(11, 7, 7, 4.5, 0.4, 0, 6.283);
    ctx.fill();
    // 身体
    var bg = ctx.createRadialGradient(-4, -5, 3, 0, 0, 20);
    bg.addColorStop(0, pal.belly);
    bg.addColorStop(0.55, pal.body);
    bg.addColorStop(1, pal.dark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 13.5, 0, 0, 6.283);
    ctx.fill();
    // 背斑
    ctx.fillStyle = 'rgba(0,0,0,.1)';
    ctx.beginPath();
    ctx.arc(-5, 3, 2.4, 0, 6.283);
    ctx.arc(5, 3, 2.4, 0, 6.283);
    ctx.fill();
    // 前爪
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.arc(-12, -4, 3.6, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, -4, 3.6, 0, 6.283);
    ctx.fill();
    // 眼柄 + 眼睛（朝上）
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.arc(-7, -11, 4.6, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -11, 4.6, 0, 6.283);
    ctx.fill();
    var blink = (frog.blinkOn > 0 && !palette);
    ctx.fillStyle = '#f4fbff';
    ctx.beginPath();
    ctx.arc(-7, -12.5, 3.6, 0, 6.283);
    ctx.arc(7, -12.5, 3.6, 0, 6.283);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = '#0d1420';
      ctx.beginPath();
      ctx.arc(-7, -12.5, 1.7, 0, 6.283);
      ctx.arc(7, -12.5, 1.7, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.arc(-6.2, -13.2, 0.7, 0, 6.283);
      ctx.arc(7.8, -13.2, 0.7, 0, 6.283);
      ctx.fill();
    }
    ctx.restore();
  }

  /* 文字横幅 + 倒计时 */
  function drawBanners() {
    banners.forEach(function (b) {
      var k = b.t / b.dur;
      var a = k < 0.12 ? k / 0.12 : (k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1);
      var scale = k < 0.12 ? 0.7 + (k / 0.12) * 0.3 : 1;
      ctx.save();
      ctx.translate(W / 2, H * 0.24);
      ctx.scale(scale, scale);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.fillStyle = 'rgba(4,10,20,.5)';
      rr(-190, -28, 380, 56, 14);
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.font = '800 ' + b.size + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.text, 0, 2);
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    });
    ctx.globalAlpha = 1;
  }

  function drawCountdown() {
    var c = count;
    var k = clamp(c.t / c.dur, 0, 1);
    var txt, col;
    if (c.kind === 'intro') {
      var step = Math.floor(k * 3);
      txt = ['3', '2', '1'][Math.min(step, 2)];
      col = step === 2 ? '#ffb23e' : '#fff';
    } else {
      txt = '准备…';
      col = '#fff';
    }
    var pulse = 1 + Math.sin(k * Math.PI * 10) * 0.05;
    ctx.save();
    ctx.translate(W / 2, H / 2 - 20);
    ctx.scale(pulse, pulse);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(4,10,20,.55)';
    rr(-90, -40, 180, 80, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 2;
    rr(-90, -40, 180, 80, 20);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, 0, 2);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  /* ============================================================
     模态框
     ============================================================ */
  function showModal(win) {
    if (win) {
      modalTitle.textContent = '🎉 获胜！';
      modalSub.textContent = '5 只青蛙全部安全到家！\n本局得分 ' + score + ' · 最高分 ' + best;
    } else {
      modalTitle.textContent = '💀 游戏结束';
      modalSub.textContent = '3 条命都用完了…\n本局得分 ' + score + ' · 最高分 ' + best;
    }
    modal.classList.add('show');
  }
  function hideModal() {
    modal.classList.remove('show');
  }

  /* ============================================================
     事件绑定 & 启动
     ============================================================ */
  function bindEvents() {
    window.addEventListener('keydown', onKey);

    var sx = null, sy = null;
    boardWrap.addEventListener('pointerdown', function (e) {
      if (e.target === btnRestart) return;
      try { boardWrap.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      sx = e.clientX; sy = e.clientY;
    });
    boardWrap.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null; sy = null;
      document.querySelectorAll('.dbtn').forEach(function (b) { b.classList.remove('press'); });
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? R : L);
      else tryMove(dy > 0 ? D : U);
    });
    boardWrap.addEventListener('pointercancel', function () { sx = null; sy = null; });

    var dbtns = document.querySelectorAll('.dbtn');
    dbtns.forEach(function (b) {
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        b.classList.add('press');
        tryMove(parseInt(b.getAttribute('data-dir'), 10));
      });
      b.addEventListener('pointerup', function () { b.classList.remove('press'); });
      b.addEventListener('pointerleave', function () { b.classList.remove('press'); });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    btnAgain.addEventListener('click', restartRun);
    btnRestart.addEventListener('click', restartRun);
  }

  // 防连点：跳跃中锁定、死亡/庆祝中锁定已在 tryMove 处理

  buildStaticBg();
  buildLevel(level);
  resetFrog();
  refreshHUD();
  bindEvents();
  phase = 'count';
  count = { kind: 'intro', t: 0, dur: 1.5 };
  lastTs = performance.now();
  requestAnimationFrame(frame);
})();
