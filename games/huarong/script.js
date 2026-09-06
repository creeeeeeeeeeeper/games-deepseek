/* ============================================================
   华容道（Klotski）游戏逻辑
   纯原生 JavaScript。4x5 棋盘，2x2 曹操滑到底部中间出口过关。
   渲染：静态槽位 + 绝对定位棋子；移动时 left/top 过渡平滑滑动
   ============================================================ */
(function () {
  "use strict";

  var COLS = 4;
  var ROWS = 5;
  var EXIT_ROW = 4;
  var EXIT_COLS = [1, 2];
  var BEST_KEY = "huarong-best";

  var boardEl = document.getElementById("board-klotski");
  var stepsEl = document.getElementById("steps");
  var bestEl = document.getElementById("best");
  var msgEl = document.getElementById("gameMsg");
  var winModal = document.getElementById("winModal");
  var modalSteps = document.getElementById("modalSteps");
  var restartBtn = document.getElementById("restart");
  var modalRestart = document.getElementById("modalRestart");
  var dirBtns = document.querySelectorAll(".dpad .btn.dir");

  var pieces = [];
  var steps = 0;
  var selected = null;
  var won = false;
  var lost = false;
  var best = null;

  var slots = [];        // 20 个槽位元素（按 r*COLS+c 索引）
  var pieceEls = {};     // id -> 棋子 DOM

  function makePiece(id, name, role, row, col, rows, cols) {
    return { id: id, name: name, role: role, row: row, col: col, rows: rows, cols: cols };
  }

  function createInitialBoard() {
    return [
      makePiece("cao", "曹操", "cao", 0, 1, 2, 2),
      makePiece("guanyu", "关羽", "general", 3, 1, 1, 2),
      makePiece("zhangfei", "张飞", "general", 0, 0, 2, 1),
      makePiece("zhaoyun", "赵云", "general", 0, 3, 2, 1),
      makePiece("machao", "马超", "general", 2, 0, 2, 1),
      makePiece("huangzhong", "黄忠", "general", 2, 3, 2, 1),
      makePiece("s1", "兵", "soldier", 2, 1, 1, 1),
      makePiece("s2", "兵", "soldier", 2, 2, 1, 1),
      makePiece("s3", "兵", "soldier", 4, 0, 1, 1),
      makePiece("s4", "兵", "soldier", 4, 3, 1, 1),
    ];
  }

  function buildOccupancy(list) {
    var occ = [];
    for (var r = 0; r < ROWS; r++) occ.push(new Array(COLS).fill(null));
    list.forEach(function (p) {
      for (var rr = p.row; rr < p.row + p.rows; rr++)
        for (var cc = p.col; cc < p.col + p.cols; cc++)
          occ[rr][cc] = p.id;
    });
    return occ;
  }

  function canMove(p, dr, dc) {
    var nr = p.row + dr, nc = p.col + dc;
    if (nr < 0 || nc < 0 || nr + p.rows > ROWS || nc + p.cols > COLS) return false;
    var occ = buildOccupancy(pieces);
    for (var r = nr; r < nr + p.rows; r++)
      for (var c = nc; c < nc + p.cols; c++)
        if (occ[r][c] && occ[r][c] !== p.id) return false;
    return true;
  }
  function validDirs(p) {
    return [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(function (d) { return canMove(p, d[0], d[1]); });
  }

  function doMove(p, dr, dc) {
    if (won || lost) return false;
    if (!canMove(p, dr, dc)) return false;
    p.row += dr;
    p.col += dc;
    steps++;
    selected = p;
    render();               // 平滑滑动（棋子 left/top 过渡）
    checkEnd();
    return true;
  }

  function isWin() {
    var cao = null;
    for (var i = 0; i < pieces.length; i++)
      if (pieces[i].id === "cao") { cao = pieces[i]; break; }
    return !!cao && cao.row === ROWS - 2 && cao.col === EXIT_COLS[0];
  }
  function hasAnyMove() {
    for (var i = 0; i < pieces.length; i++) if (validDirs(pieces[i]).length > 0) return true;
    return false;
  }

  function checkEnd() {
    if (isWin()) {
      won = true;
      if (best === null || steps < best) {
        best = steps;
        try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      }
      bestEl.textContent = best;
      modalSteps.textContent = "当前用步 " + steps + " 步 · 最少纪录 " + best + " 步";
      winModal.classList.add("show");
      updateMsg();
      return;
    }
    if (!hasAnyMove()) { lost = true; updateMsg(); }
  }

  /* ---------- 几何（直接量取槽位，避免 clamp 自定义属性解析为 NaN） ---------- */
  function geom() {
    if (!slots.length) return { cell: 60, gap: 6, padX: 6, padY: 6, step: 66 };
    var s0 = slots[0];
    var s1 = slots[1];
    var sR = slots[COLS];
    var step = s1.offsetLeft - s0.offsetLeft;
    var cell = s0.clientWidth;
    return {
      cell: cell,
      gap: step - cell,
      padX: s0.offsetLeft,
      padY: s0.offsetTop,
      step: step,
    };
  }
  function place(p) {
    var el = pieceEls[p.id];
    if (!el) return;
    var g = geom(), cell = g.cell, step = g.step, gap = g.gap;
    el.style.left = (g.padX + p.col * step) + "px";
    el.style.top = (g.padY + p.row * step) + "px";
    el.style.width = (p.cols * cell + (p.cols - 1) * gap) + "px";
    el.style.height = (p.rows * cell + (p.rows - 1) * gap) + "px";
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var occ = buildOccupancy(pieces);
    var moveTargets = collectMoveTargets();

    // 槽位状态
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = slots[r * COLS + c];
        cell.className = "cell";
        if (r === EXIT_ROW && c >= EXIT_COLS[0] && c <= EXIT_COLS[1]) cell.classList.add("exit");
        if (selected && moveTargets[r + "_" + c]) cell.classList.add("move-to");
      }
    }

    // 棋子位置与选中状态
    pieces.forEach(function (p) {
      place(p);
      var el = pieceEls[p.id];
      el.classList.toggle("selected", !!(selected && selected.id === p.id));
    });

    stepsEl.textContent = steps;
    updateMsg();
  }

  function buildStatic() {
    boardEl.innerHTML = "";
    slots = [];
    pieceEls = {};
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = document.createElement("div");
        cell.className = "cell";
        (function (rr, cc) {
          cell.addEventListener("click", function () {
            if (selected) moveSelectedToward(rr, cc);
          });
        })(r, c);
        boardEl.appendChild(cell);
        slots.push(cell);
      }
    }
    // 棋子层（绝对定位）
    pieces.forEach(function (p) {
      var el = document.createElement("div");
      el.className = "piece " + p.role;
      el.textContent = p.name;
      el.addEventListener("pointerdown", function (e) { startDrag(p, e); });
      boardEl.appendChild(el);
      pieceEls[p.id] = el;
      place(p);
    });
  }

  function collectMoveTargets() {
    var map = {};
    if (!selected) return map;
    validDirs(selected).forEach(function (d) {
      var nr = selected.row + d[0], nc = selected.col + d[1];
      for (var r = nr; r < nr + selected.rows; r++)
        for (var c = nc; c < nc + selected.cols; c++)
          map[r + "_" + c] = true;
    });
    return map;
  }

  function moveSelectedToward(r, c) {
    if (!selected) return;
    var dirs = validDirs(selected);
    for (var i = 0; i < dirs.length; i++) {
      var d = dirs[i];
      var nr = selected.row + d[0], nc = selected.col + d[1];
      var inside = false;
      for (var a = nr; a < nr + selected.rows; a++)
        for (var b = nc; b < nc + selected.cols; b++)
          if (a === r && b === c) inside = true;
      if (inside) { doMove(selected, d[0], d[1]); return; }
    }
  }

  function selectPiece(p) {
    selected = p;
    render();
  }

  /* ---------- 按住拖动：网格吸附 + 连续移动（回拖可撤回步数） ---------- */
  var drag = { piece: null, axis: null, accum: 0, lastX: 0, lastY: 0 };

  function startDrag(p, e) {
    if (won || lost) return;
    e.preventDefault();
    selected = p;
    drag.piece = p;
    drag.axis = null;
    drag.accum = 0;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    try { pieceEls[p.id].setPointerCapture(e.pointerId); } catch (err) {}
    pieceEls[p.id].classList.add("dragging");
    render();
  }
  function tryShift(dir) {
    var p = drag.piece;
    if (!canMove(p, dir[0], dir[1])) return false;
    p.row += dir[0];
    p.col += dir[1];
    steps++;
    place(p);
    render();
    return true;
  }
  function tryUnshift(dir) {
    var p = drag.piece;
    // 反向移动也要合法（否则会叠块/出界）
    if (!canMove(p, dir[0], dir[1])) return false;
    p.row += dir[0];
    p.col += dir[1];
    steps = Math.max(0, steps - 1);
    place(p);
    render();
    return true;
  }
  function onDragMove(e) {
    if (!drag.piece) return;
    if (!drag.axis) {
      var dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY;
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      // 统一用像素方向向量 [dxDir, dyDir] 表示滑动轴
      drag.axis = Math.abs(dx) >= Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1];
    }
    var st = geom().step;
    // 按像素方向投影距离
    var dp = (e.clientX - drag.lastX) * drag.axis[0] + (e.clientY - drag.lastY) * drag.axis[1];
    drag.accum += dp;
    var n = Math.trunc(drag.accum / st);
    if (n > 0) {
      // 水平拖动 => 左右；垂直 => 上下
      var rowD = drag.axis[1] !== 0 ? drag.axis[1] : 0;
      var colD = drag.axis[1] === 0 ? drag.axis[0] : 0;
      for (var i = 0; i < n; i++) { if (!tryShift([rowD, colD])) break; }
      drag.accum -= n * st;
    } else if (n < 0) {
      var rowU = drag.axis[1] !== 0 ? -drag.axis[1] : 0;
      var colU = drag.axis[1] === 0 ? -drag.axis[0] : 0;
      for (var j = 0; j < -n; j++) { if (!tryUnshift([rowU, colU])) break; }
      drag.accum -= n * st;
    }
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
  }
  function onDragEnd() {
    if (!drag.piece) return;
    var p = drag.piece;
    pieceEls[p.id].classList.remove("dragging");
    drag.piece = null;
    render();
    checkEnd();
  }
  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", onDragEnd);

  function updateMsg() {
    if (won) {
      msgEl.textContent = "🎉 曹操已到达出口，过关！";
      msgEl.className = "msg win";
      return;
    }
    if (lost) {
      msgEl.textContent = "😵 无路可走，请点击「重新开始」";
      msgEl.className = "msg lose";
      return;
    }
    if (selected) {
      msgEl.textContent = "已选：" + selected.name + "（可移动方向 " + validDirs(selected).length + "）";
    } else {
      msgEl.textContent = "点击棋子选中，再用方向键 / 箭头按钮移动";
    }
    msgEl.className = "msg";
  }

  var KEY_DIRS = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
    W: [-1, 0], S: [1, 0], A: [0, -1], D: [0, 1]
  };
  document.addEventListener("keydown", function (e) {
    var d = KEY_DIRS[e.key];
    if (!d) return;
    e.preventDefault();
    if (selected) doMove(selected, d[0], d[1]);
  });

  dirBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var d = KEY_DIRS[btn.dataset.dir];
      if (!d || !selected) return;
      doMove(selected, d[0], d[1]);
    });
  });

  function restart() {
    pieces = createInitialBoard();
    steps = 0;
    selected = null;
    won = false;
    lost = false;
    winModal.classList.remove("show");
    try {
      best = localStorage.getItem(BEST_KEY);
      best = best === null ? null : parseInt(best, 10);
    } catch (e) { best = null; }
    bestEl.textContent = best === null ? "—" : best;
    buildStatic();
    render();
  }

  window.addEventListener("resize", function () {
    pieces.forEach(function (p) { place(p); });
  });

  restartBtn.addEventListener("click", restart);
  modalRestart.addEventListener("click", restart);

  restart();
})();
