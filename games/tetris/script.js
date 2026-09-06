'use strict';
/* ============================================================
   俄罗斯方块（Tetris）— 单机单人版
   - 7 种标准方块（I/O/T/S/Z/J/L），7-bag 随机
   - 移动 / 旋转 / 软降 / 硬降 / 暂存(hold) / 暂停
   - 消行 1/2/3/4 = 100/300/500/800 × 等级；每 10 行升一级提速
   - 幽灵落点(ghost)、消行闪烁→下落动画、粒子与得分浮动
   - 纯 canvas（固定逻辑尺寸）+ rAF 帧时间差驱动
   ============================================================ */
(function () {
  'use strict';

  // ---------------- 常量 ----------------
  var COLS = 10;
  var ROWS = 20;
  var CELL = 30;
  var BOARD_W = COLS * CELL;   // 300
  var BOARD_H = ROWS * CELL;   // 600
  var LOCK_DELAY = 0.48;       // 落地锁定延迟（秒）
  var DAS_DELAY = 0.17;        // 按键自动连移初始延迟
  var DAS_REPEAT = 0.06;       // 自动连移间隔
  var SOFT_STEP = 0.045;       // 软降连降间隔
  var READY_TOTAL = 1.8;       // 开局倒计时总时长
  var READY_STEP = 0.6;        // 每个数字停留时长
  var FLASH_T = 0.24;          // 消行闪烁时长
  var COLLAPSE_T = 0.16;       // 消行下落动画时长
  var BEST_KEY = 'tetris-best';

  var ST = { READY: 1, PLAY: 2, CLEAR: 3, PAUSE: 4, OVER: 5 };

  var COLORS = {
    I: '#3ae0f0',
    O: '#ffd23e',
    T: '#b77bff',
    S: '#3fd98b',
    Z: '#ff5d6c',
    J: '#4d8dff',
    L: '#ff9f3d'
  };

  var PIECES = {
    I: { size: 4, color: COLORS.I, cells: [[1, 0], [1, 1], [1, 2], [1, 3]] },
    J: { size: 3, color: COLORS.J, cells: [[0, 0], [1, 0], [1, 1], [1, 2]] },
    L: { size: 3, color: COLORS.L, cells: [[0, 2], [1, 0], [1, 1], [1, 2]] },
    O: { size: 2, color: COLORS.O, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
    S: { size: 3, color: COLORS.S, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
    T: { size: 3, color: COLORS.T, cells: [[0, 1], [1, 0], [1, 1], [1, 2]] },
    Z: { size: 3, color: COLORS.Z, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] }
  };
  var TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  var KICKS = [0, -1, 1, -2, 2]; // 旋转墙踢偏移

  // ---------------- DOM ----------------
  function $(id) { return document.getElementById(id); }
  var cvBoard = $('cv-board');
  var cvHold = $('cv-hold');
  var cvNext = $('cv-next');
  var ctxB = cvBoard.getContext('2d');
  var ctxH = cvHold.getContext('2d');
  var ctxN = cvNext.getContext('2d');

  var hudScore = $('hud-score');
  var hudLevel = $('hud-level');
  var hudLines = $('hud-lines');
  var hudBest = $('hud-best');
  var panelHold = $('panel-hold');

  var modalPause = $('modal-pause');
  var modalEnd = $('modal-end');
  var newRecord = $('new-record');
  var endScore = $('end-score');
  var endLines = $('end-lines');
  var endLevel = $('end-level');
  var endBest = $('end-best');

  // ---------------- 游戏状态 ----------------
  var st = ST.READY;
  var grid = [];
  var cur = null;          // 当前方块
  var holdType = null;     // 暂存类型
  var canHold = true;
  var nextQueue = [];
  var bag = [];

  var score = 0;
  var level = 1;
  var linesTotal = 0;
  var best = 0;
  var bestAtStart = 0;

  var readyT = READY_TOTAL;
  var gravityT = 0;
  var lockT = 0;
  var softT = 0;
  var grounded = false;

  var input = { left: false, right: false, down: false };
  var moveT = 0;

  var clearRows = [];
  var clearPhase = 0;      // 0 = 闪烁, 1 = 下落
  var clearT = 0;
  var moveMap = null;      // 消行后每个新行对应的旧行
  var oldGrid = null;

  var particles = [];
  var floats = [];
  var overTimer = null;

  // ---------------- 最高分（localStorage） ----------------
  function loadBest() {
    try {
      var v = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
      return (isFinite(v) && v > 0) ? v : 0;
    } catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* 忽略 */ }
  }
  best = loadBest();
  bestAtStart = best;

  // ---------------- 基础工具 ----------------
  function emptyRow() { return Array(COLS).fill(null); }
  function newGrid() {
    var g = [];
    for (var i = 0; i < ROWS; i++) g.push(emptyRow());
    return g;
  }
  function shuffleArr(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function refillBag() { bag = shuffleArr(TYPES.slice()); }
  function bagDraw() {
    if (bag.length === 0) refillBag();
    return bag.pop();
  }
  function fillNext() { while (nextQueue.length < 3) nextQueue.push(bagDraw()); }

  function rotateCells(cells, size, dir) {
    // dir > 0 顺时针，dir < 0 逆时针
    return cells.map(function (p) {
      return dir > 0 ? [p[1], size - 1 - p[0]] : [size - 1 - p[1], p[0]];
    });
  }

  function createPiece(type) {
    var def = PIECES[type];
    return {
      type: type,
      size: def.size,
      color: def.color,
      cells: def.cells.map(function (p) { return [p[0], p[1]]; }),
      x: Math.floor((COLS - def.size) / 2),
      y: 0
    };
  }

  // ---------------- 碰撞 / 移动 ----------------
  function collidesAt(piece, x, y) {
    for (var i = 0; i < piece.cells.length; i++) {
      var c = x + piece.cells[i][1];
      var r = y + piece.cells[i][0];
      if (c < 0 || c >= COLS || r >= ROWS) return true;
      if (r >= 0 && grid[r][c]) return true;
    }
    return false;
  }
  function canDrop(piece) { return !collidesAt(piece, piece.x, piece.y + 1); }

  function tryMove(dx) {
    if (!cur) return false;
    if (!collidesAt(cur, cur.x + dx, cur.y)) {
      cur.x += dx;
      if (grounded && canDrop(cur)) { grounded = false; lockT = 0; }
      return true;
    }
    return false;
  }

  // 向下移动一步；soft=true 表示玩家软降（计 1 分）
  function tryDown(soft) {
    if (!cur) return false;
    if (!collidesAt(cur, cur.x, cur.y + 1)) {
      cur.y += 1;
      if (soft) addScore(1);
      return true;
    }
    grounded = true;
    lockT = 0;
    return false;
  }

  function ghostY() {
    var gy = cur.y;
    while (!collidesAt(cur, cur.x, gy + 1)) gy++;
    return gy;
  }

  function rotatePiece(dir) {
    if (!cur || st !== ST.PLAY) return;
    var newCells = rotateCells(cur.cells, cur.size, dir);
    for (var i = 0; i < KICKS.length; i++) {
      var nx = cur.x + KICKS[i];
      if (!collidesAt({ cells: newCells, size: cur.size, x: nx, y: cur.y }, nx, cur.y)) {
        cur.cells = newCells;
        cur.x = nx;
        if (grounded && canDrop(cur)) { grounded = false; lockT = 0; }
        return;
      }
    }
    // 旋转失败时给轻微提示
    pushFloat(BOARD_W / 2, cur.y * CELL + 26, '转不动', { color: 'rgba(255,255,255,0.55)', size: 13, life: 0.45 });
  }

  // ---------------- 得分 / 等级 ----------------
  function dropInterval() {
    return Math.max(0.06, 0.76 * Math.pow(0.82, level - 1));
  }

  function addScore(v) {
    score += v;
    hudScore.textContent = String(score);
    popEl(hudScore);
    if (score > best) {
      best = score;
      saveBest(best);
      hudBest.textContent = String(best);
      hudBest.classList.add('new-best');
      popEl(hudBest);
    }
  }

  function addClearedLines(n) {
    linesTotal += n;
    hudLines.textContent = String(linesTotal);
    popEl(hudLines);
    var newLevel = Math.floor(linesTotal / 10) + 1;
    if (newLevel > level) {
      level = newLevel;
      hudLevel.textContent = String(level);
      popEl(hudLevel);
      pushFloat(BOARD_W / 2, BOARD_H * 0.42, '\u26A1 升级 Lv.' + level, { color: '#ffd23e', size: 30, life: 1.15 });
    }
  }

  function popEl(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  // ---------------- 粒子 / 浮动文字 ----------------
  function spawnBurst(px, py, color, n) {
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = 60 + Math.random() * 190;
      particles.push({
        x: px, y: py,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 90,
        size: 1.6 + Math.random() * 2.2,
        life: 0.32 + Math.random() * 0.45,
        max: 0.75,
        color: color
      });
    }
  }

  function pushFloat(x, y, text, opt) {
    opt = opt || {};
    floats.push({
      x: x, y: y,
      text: text,
      color: opt.color || '#ffffff',
      size: opt.size || 19,
      life: opt.life || 0.9,
      max: opt.life || 0.9,
      vy: -34
    });
  }

  function updateFx(dt) {
    var i;
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += 430 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (i = floats.length - 1; i >= 0; i--) {
      var f = floats[i];
      f.life -= dt;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      f.y += f.vy * dt;
    }
  }

  // ---------------- 渲染：通用方块绘制 ----------------
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  // 在任意 canvas 上画一个彩色格子（发光 + 轻微描边 + 顶部高光）
  function paintBlock(c, px, py, color, size, opt) {
    opt = opt || {};
    var alpha = opt.alpha === undefined ? 1 : opt.alpha;
    var glow = opt.glow === undefined ? 10 : opt.glow;
    var inset = opt.inset === undefined ? 1.5 : opt.inset;
    var s = size || CELL;
    c.save();
    c.globalAlpha = alpha;
    if (glow > 0) {
      c.shadowColor = color;
      c.shadowBlur = glow;
    }
    c.fillStyle = color;
    rr(c, px + inset, py + inset, s - inset * 2, s - inset * 2, 4);
    c.fill();
    c.shadowBlur = 0;
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(255,255,255,0.14)';
    rr(c, px + inset + 0.5, py + inset + 0.5, s - inset * 2 - 1, s - inset * 2 - 1, 3.5);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.17)';
    rr(c, px + inset + 2.5, py + inset + 2.5, s - inset * 2 - 5, Math.min(5, (s - inset * 2) * 0.3), 2);
    c.fill();
    c.restore();
  }

  function drawPieceOn(c, cells, ox, oy, color, size, glow) {
    for (var i = 0; i < cells.length; i++) {
      paintBlock(c, (ox + cells[i][1]) * size, (oy + cells[i][0]) * size, color, size, { glow: glow });
    }
  }

  // ---------------- 渲染：主棋盘 ----------------
  function drawGridBackdrop() {
    ctxB.clearRect(0, 0, BOARD_W, BOARD_H);
    var g = ctxB.createLinearGradient(0, 0, 0, BOARD_H);
    g.addColorStop(0, '#101a30');
    g.addColorStop(1, '#0a1020');
    ctxB.fillStyle = g;
    ctxB.fillRect(0, 0, BOARD_W, BOARD_H);

    ctxB.strokeStyle = 'rgba(160,178,220,0.05)';
    ctxB.lineWidth = 1;
    ctxB.beginPath();
    for (var c = 1; c < COLS; c++) {
      ctxB.moveTo(c * CELL + 0.5, 0);
      ctxB.lineTo(c * CELL + 0.5, BOARD_H);
    }
    for (var r = 1; r < ROWS; r++) {
      ctxB.moveTo(0, r * CELL + 0.5);
      ctxB.lineTo(BOARD_W, r * CELL + 0.5);
    }
    ctxB.stroke();
  }

  function drawCells(g) {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (g[r][c]) paintBlock(ctxB, c * CELL, r * CELL, g[r][c], CELL, { glow: 7 });
      }
    }
  }

  function drawGhost() {
    var gy = ghostY();
    if (gy === cur.y) return;
    ctxB.save();
    for (var i = 0; i < cur.cells.length; i++) {
      var c = cur.x + cur.cells[i][1];
      var r = gy + cur.cells[i][0];
      if (r < 0) continue;
      ctxB.globalAlpha = 0.12;
      ctxB.fillStyle = cur.color;
      rr(ctxB, c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2, 4);
      ctxB.fill();
      ctxB.globalAlpha = 0.5;
      ctxB.strokeStyle = 'rgba(255,255,255,0.55)';
      ctxB.setLineDash([4, 4]);
      ctxB.lineWidth = 1;
      rr(ctxB, c * CELL + 1.5, r * CELL + 1.5, CELL - 3, CELL - 3, 3.5);
      ctxB.stroke();
      ctxB.setLineDash([]);
    }
    ctxB.restore();
  }

  function drawFx() {
    var i;
    ctxB.save();
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctxB.globalAlpha = Math.max(0, p.life / p.max);
      ctxB.fillStyle = p.color;
      ctxB.beginPath();
      ctxB.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctxB.fill();
    }
    for (i = 0; i < floats.length; i++) {
      var f = floats[i];
      var elapsed = f.max - f.life;
      var pop = elapsed < 0.12 ? elapsed / 0.12 : 1; // 出现时弹性放大
      var sz = f.size * (0.72 + 0.28 * pop);
      var a = Math.min(1, f.life / (f.max * 0.25));  // 末尾淡出
      ctxB.globalAlpha = Math.max(0, Math.min(1, a));
      ctxB.font = '700 ' + Math.round(sz) + 'px "Segoe UI", system-ui, sans-serif';
      ctxB.textAlign = 'center';
      ctxB.textBaseline = 'middle';
      ctxB.shadowColor = f.color;
      ctxB.shadowBlur = 12;
      ctxB.fillStyle = f.color;
      ctxB.fillText(f.text, f.x, f.y);
    }
    ctxB.restore();
  }

  function drawReadyOverlay() {
    ctxB.save();
    ctxB.fillStyle = 'rgba(7,11,22,0.55)';
    ctxB.fillRect(0, 0, BOARD_W, BOARD_H);
    var n = Math.max(1, Math.ceil(readyT / READY_STEP));
    var inStep = readyT - (n - 1) * READY_STEP;
    var k = 1 - inStep / READY_STEP;
    var scale = 1 + 0.35 * (1 - k) * (1 - k);
    ctxB.translate(BOARD_W / 2, BOARD_H / 2);
    ctxB.scale(scale, scale);
    ctxB.globalAlpha = 0.75 + 0.25 * Math.sin(readyT * 14);
    ctxB.font = '800 72px "Segoe UI", system-ui, sans-serif';
    ctxB.textAlign = 'center';
    ctxB.textBaseline = 'middle';
    ctxB.shadowColor = '#3aa0ff';
    ctxB.shadowBlur = 26;
    ctxB.fillStyle = '#3aa0ff';
    ctxB.fillText(String(n), 0, -6);
    ctxB.shadowBlur = 0;
    ctxB.globalAlpha = 0.75;
    ctxB.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctxB.fillStyle = 'rgba(255,255,255,0.8)';
    ctxB.fillText('准备…', 0, 58);
    ctxB.restore();
  }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function renderBoard() {
    drawGridBackdrop();

    if (st === ST.CLEAR) {
      if (clearPhase === 0) {
        // 闪烁阶段：整行白亮闪烁
        drawCells(grid);
        var a = 0.12 + 0.5 * Math.abs(Math.sin(clearT * 26));
        ctxB.save();
        ctxB.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        for (var i = 0; i < clearRows.length; i++) {
          var r = clearRows[i];
          ctxB.fillRect(0, r * CELL, BOARD_W, CELL);
        }
        ctxB.restore();
      } else {
        // 下落阶段：按 moveMap 插值把旧行滑到新行
        var t = Math.min(1, clearT / COLLAPSE_T);
        var e = easeInOut(t);
        for (var nr = 0; nr < ROWS; nr++) {
          var m = moveMap[nr];
          if (!m) continue;
          var from = m.from;
          for (var c = 0; c < COLS; c++) {
            if (!grid[nr][c]) continue;
            var yNow = (from + (nr - from) * e) * CELL;
            paintBlock(ctxB, c * CELL, yNow, grid[nr][c], CELL, { glow: 6 });
          }
        }
      }
    } else {
      drawCells(grid);
      if (st === ST.PLAY && cur) {
        drawGhost();
        drawPieceOn(ctxB, cur.cells, cur.x, cur.y, cur.color, CELL, 12);
      }
    }

    drawFx();

    if (st === ST.READY) drawReadyOverlay();
  }

  // ---------------- 渲染：预览 / 暂存 ----------------
  function drawPreviewCanvas(c, cv, type, emptyText) {
    c.clearRect(0, 0, cv.width, cv.height);
    if (!type) {
      c.save();
      c.globalAlpha = 0.3;
      c.font = '600 15px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#aab6cd';
      c.fillText(emptyText || '空', cv.width / 2, cv.height / 2);
      c.restore();
      return;
    }
    var cells = PIECES[type].cells;
    var minR = 9, maxR = -9, minC = 9, maxC = -9;
    for (var i = 0; i < cells.length; i++) {
      if (cells[i][0] < minR) minR = cells[i][0];
      if (cells[i][0] > maxR) maxR = cells[i][0];
      if (cells[i][1] < minC) minC = cells[i][1];
      if (cells[i][1] > maxC) maxC = cells[i][1];
    }
    var w = maxC - minC + 1;
    var h = maxR - minR + 1;
    var offX = (4 - w) / 2 - minC;
    var offY = (4 - h) / 2 - minR;
    for (i = 0; i < cells.length; i++) {
      var px = (offX + cells[i][1]) * CELL + (cv.width - 4 * CELL) / 2;
      var py = (offY + cells[i][0]) * CELL + (cv.height - 4 * CELL) / 2;
      paintBlock(c, px, py, COLORS[type], CELL, { glow: 8, inset: 2 });
    }
  }

  function renderSide() {
    drawPreviewCanvas(ctxH, cvHold, holdType, '空');
    drawPreviewCanvas(ctxN, cvNext, nextQueue.length ? nextQueue[0] : null, '—');
  }

  // ---------------- 主流程：生成 / 锁定 / 消行 ----------------
  function spawnFromQueue() {
    var type = nextQueue.length ? nextQueue.shift() : bagDraw();
    fillNext();
    cur = createPiece(type);
    grounded = false;
    lockT = 0;
    gravityT = 0;
    softT = 0;
    canHold = true;
    panelHold.classList.remove('blocked');
    if (collidesAt(cur, cur.x, cur.y)) {
      gameOver();
      return;
    }
    st = ST.PLAY;
  }

  function lockPiece() {
    if (!cur) return;
    // 写入网格
    for (var i = 0; i < cur.cells.length; i++) {
      var r = cur.y + cur.cells[i][0];
      var c = cur.x + cur.cells[i][1];
      if (r < 0) { gameOver(); return; }
      grid[r][c] = cur.color;
    }
    cur = null;
    grounded = false;
    lockT = 0;
    input.left = false;
    input.right = false;
    input.down = false;
    moveT = 0;

    // 找满行
    var full = [];
    for (var row = 0; row < ROWS; row++) {
      var ok = true;
      for (var cc = 0; cc < COLS; cc++) {
        if (!grid[row][cc]) { ok = false; break; }
      }
      if (ok) full.push(row);
    }

    if (full.length) {
      startClear(full);
    } else {
      spawnFromQueue();
    }
  }

  function startClear(rows) {
    st = ST.CLEAR;
    clearRows = rows.slice();
    clearPhase = 0;
    clearT = 0;
    oldGrid = grid.map(function (r) { return r.slice(); });

    var n = rows.length;
    var pts = [0, 100, 300, 500, 800][n] * level;
    if (pts > 0) {
      addScore(pts);
      var bottom = rows[rows.length - 1];
      pushFloat(BOARD_W / 2, bottom * CELL + CELL * 0.5, '+' + pts, { color: '#ffd23e', size: 20 + n * 2, life: 0.95 });
    }

    // 消除粒子：每个被消格子弹射火花
    for (var r = 0; r < rows.length; r++) {
      for (var c = 0; c < COLS; c++) {
        if (oldGrid[rows[r]][c]) {
          spawnBurst(c * CELL + CELL / 2, rows[r] * CELL + CELL / 2, oldGrid[rows[r]][c], 3);
        }
      }
    }
    addClearedLines(n);
  }

  function startCollapse() {
    var removed = {};
    for (var i = 0; i < clearRows.length; i++) removed[clearRows[i]] = true;
    var survivors = [];
    for (var r = 0; r < ROWS; r++) {
      if (!removed[r]) survivors.push(r);
    }
    var k = survivors.length;
    var g = [];
    for (var top = 0; top < ROWS - k; top++) g.push(emptyRow());
    for (var s = 0; s < k; s++) {
      g.push(oldGrid[survivors[s]].slice());
    }
    grid = g;

    moveMap = new Array(ROWS);
    for (s = 0; s < k; s++) {
      moveMap[ROWS - k + s] = { from: survivors[s] };
    }
    clearPhase = 1;
    clearT = 0;
  }

  function finishClear() {
    moveMap = null;
    oldGrid = null;
    clearRows = [];
    spawnFromQueue();
  }

  function gameOver() {
    if (st === ST.OVER) return;
    st = ST.OVER;
    if (score > bestAtStart) saveBest(best);
    var isNew = score > bestAtStart;
    newRecord.classList.toggle('show', isNew);
    endScore.textContent = String(score);
    endLines.textContent = String(linesTotal);
    endLevel.textContent = String(level);
    endBest.textContent = String(best);
    // 让触顶画面先闪现一下再弹窗
    overTimer = setTimeout(function () { modalEnd.classList.add('show'); }, 380);
  }

  // ---------------- 暂存 hold ----------------
  function doHold() {
    if (st !== ST.PLAY || !cur) return;
    if (!canHold) {
      panelHold.classList.remove('shake');
      void panelHold.offsetWidth;
      panelHold.classList.add('shake');
      pushFloat(BOARD_W / 2, BOARD_H * 0.6, '本块已暂存过', { color: 'rgba(255,255,255,0.6)', size: 13, life: 0.6 });
      return;
    }
    var t = cur.type;
    cur = null;
    grounded = false;
    lockT = 0;
    if (holdType === null) {
      holdType = t;
      spawnFromQueue();
    } else {
      var swap = holdType;
      holdType = t;
      cur = createPiece(swap);
    }
    canHold = false;
    panelHold.classList.add('blocked');
    if (cur && collidesAt(cur, cur.x, cur.y)) { gameOver(); return; }
  }

  // ---------------- 硬降 / 暂停 / 重开 ----------------
  function hardDrop() {
    if (st !== ST.PLAY || !cur) return;
    if (grounded && !canDrop(cur)) { lockPiece(); return; }
    var gy = ghostY();
    var dist = gy - cur.y;
    if (dist > 0) {
      addScore(dist * 2); // 硬降加分（每格 +2）
      cur.y = gy;
    }
    lockPiece();
  }

  function setPaused(pause) {
    if (pause) {
      if (st === ST.PLAY) {
        st = ST.PAUSE;
        modalPause.classList.add('show');
      }
    } else {
      if (st === ST.PAUSE) {
        st = ST.PLAY;
        modalPause.classList.remove('show');
      }
    }
  }

  function resetGame() {
    if (overTimer) { clearTimeout(overTimer); overTimer = null; }
    modalEnd.classList.remove('show');
    modalPause.classList.remove('show');
    newRecord.classList.remove('show');
    hudBest.classList.remove('new-best');

    grid = newGrid();
    cur = null;
    holdType = null;
    canHold = true;
    panelHold.classList.remove('blocked');
    bag = [];
    nextQueue = [];
    fillNext();

    score = 0;
    level = 1;
    linesTotal = 0;
    hudScore.textContent = '0';
    hudLevel.textContent = '1';
    hudLines.textContent = '0';
    hudBest.textContent = String(best);

    readyT = READY_TOTAL;
    gravityT = lockT = softT = moveT = 0;
    grounded = false;
    input.left = input.right = input.down = false;
    clearRows = [];
    clearPhase = 0;
    clearT = 0;
    moveMap = null;
    oldGrid = null;
    particles = [];
    floats = [];
    st = ST.READY;
    bestAtStart = best;
  }

  // ---------------- 帧更新 ----------------
  function update(dt) {
    if (st === ST.READY) {
      readyT -= dt;
      if (readyT <= 0) spawnFromQueue();
      return;
    }
    if (st === ST.PLAY) {
      // 自动连移（DAS）
      var axis = 0;
      if (input.left && !input.right) axis = -1;
      else if (input.right && !input.left) axis = 1;
      if (axis !== 0) {
        moveT += dt;
        if (moveT >= DAS_DELAY) {
          tryMove(axis);
          moveT -= DAS_REPEAT;
        }
      }

      // 软降
      if (input.down) {
        softT += dt;
        if (softT >= SOFT_STEP) {
          softT = 0;
          tryDown(true);
        }
      } else {
        softT = 0;
      }

      if (grounded) {
        lockT += dt * (input.down ? 3 : 1);
        if (lockT >= LOCK_DELAY) lockPiece();
      } else {
        gravityT += dt;
        if (gravityT >= dropInterval()) {
          gravityT = 0;
          tryDown(false);
        }
      }
      return;
    }
    if (st === ST.CLEAR) {
      clearT += dt;
      if (clearPhase === 0 && clearT >= FLASH_T) {
        startCollapse();
      } else if (clearPhase === 1 && clearT >= COLLAPSE_T) {
        finishClear();
      }
    }
  }

  // ---------------- 输入：键盘 ----------------
  function onKeyDown(e) {
    var k = e.key;
    var low = typeof k === 'string' ? k.toLowerCase() : '';
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // R：任何时候重开
    if (low === 'r') {
      if (!e.repeat) resetGame();
      return;
    }
    if (e.repeat) return;

    if (st === ST.PAUSE) {
      if (low === 'p' || k === 'Enter' || k === 'Escape') { e.preventDefault(); setPaused(false); }
      return;
    }
    if (st === ST.OVER) {
      if (k === ' ' || k === 'Enter') { e.preventDefault(); resetGame(); }
      return;
    }
    if (st !== ST.PLAY) return; // READY / CLEAR 忽略

    if (k === 'ArrowLeft') {
      e.preventDefault();
      input.left = true;
      moveT = 0;
      tryMove(-1);
    } else if (k === 'ArrowRight') {
      e.preventDefault();
      input.right = true;
      moveT = 0;
      tryMove(1);
    } else if (k === 'ArrowDown') {
      e.preventDefault();
      input.down = true;
      tryDown(true);
    } else if (k === 'ArrowUp' || low === 'x') {
      if (k === 'ArrowUp') e.preventDefault();
      rotatePiece(1);
    } else if (low === 'z') {
      rotatePiece(-1);
    } else if (low === 'c') {
      doHold();
    } else if (k === ' ') {
      e.preventDefault();
      hardDrop();
    } else if (low === 'p') {
      setPaused(true);
    } else if (k === 'Escape') {
      setPaused(true);
    }
  }

  function onKeyUp(e) {
    var k = e.key;
    if (k === 'ArrowLeft') { input.left = false; moveT = 0; }
    else if (k === 'ArrowRight') { input.right = false; moveT = 0; }
    else if (k === 'ArrowDown') { input.down = false; softT = 0; }
  }

  // ---------------- 输入：触屏按键 ----------------
  function registerPad(btn) {
    var act = btn.getAttribute('data-act');
    function press(ev) {
      ev.preventDefault();
      if (act === 'left') { input.left = true; moveT = 0; tryMove(-1); }
      else if (act === 'right') { input.right = true; moveT = 0; tryMove(1); }
      else if (act === 'down') { input.down = true; tryDown(true); }
      else if (act === 'rotate') { rotatePiece(1); }
      else if (act === 'hard') { hardDrop(); }
      else if (act === 'hold') { doHold(); }
      else if (act === 'pause') {
        if (st === ST.PAUSE) setPaused(false);
        else setPaused(true);
      }
      else if (act === 'restart') { resetGame(); }
      if (btn.setPointerCapture && ev.pointerId !== undefined) {
        try { btn.setPointerCapture(ev.pointerId); } catch (err) { /* 忽略 */ }
      }
    }
    function release(ev) {
      ev.preventDefault();
      if (act === 'left') { input.left = false; moveT = 0; }
      else if (act === 'right') { input.right = false; moveT = 0; }
      else if (act === 'down') { input.down = false; softT = 0; }
    }
    function cancel() {
      if (act === 'left') { input.left = false; moveT = 0; }
      else if (act === 'right') { input.right = false; moveT = 0; }
      else if (act === 'down') { input.down = false; softT = 0; }
    }
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', cancel);
    btn.addEventListener('pointerleave', cancel);
  }

  // ---------------- 事件绑定 ----------------
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', function () {
    input.left = input.right = input.down = false;
    if (st === ST.PLAY) setPaused(true);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && st === ST.PLAY) setPaused(true);
  });

  $('btn-pause').addEventListener('click', function () {
    if (st === ST.PLAY) setPaused(true);
    else if (st === ST.PAUSE) setPaused(false);
  });
  $('btn-restart').addEventListener('click', resetGame);
  $('btn-resume').addEventListener('click', function () { setPaused(false); });
  $('btn-restart-pause').addEventListener('click', resetGame);
  $('btn-again').addEventListener('click', resetGame);

  var padBtns = document.querySelectorAll('.pad-btn');
  for (var b = 0; b < padBtns.length; b++) registerPad(padBtns[b]);

  panelHold.addEventListener('animationend', function (ev) {
    if (ev.animationName === 'tet-shake') panelHold.classList.remove('shake');
  });

  // ---------------- 主循环 ----------------
  var lastT = performance.now();

  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    if (st !== ST.PAUSE) updateFx(dt);
    update(dt);
    renderBoard();
    renderSide();
    requestAnimationFrame(frame);
  }

  // ---------------- 初始化 ----------------
  grid = newGrid();
  fillNext();
  hudBest.textContent = String(best);
  renderBoard();
  renderSide();
  requestAnimationFrame(frame);
})();
