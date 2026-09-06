/* ============================================================
   数字拼图（4x4 数字华容道）
   纯原生 JS/DOM；静态槽位 + 绝对定位数字块
   滑动方向平滑过渡（数字块 left/top 过渡）
   玩法：与空格同行/列的整串方块可滑向空格；方向键逐格移动
   开局由已解状态做随机合法滑动打乱（保证可解）
   ============================================================ */
(function () {
  "use strict";

  const SIZE = 4;
  const TOTAL = SIZE * SIZE;
  const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

  let board = [];
  let blank = TOTAL - 1;
  let moves = 0;
  let started = false;
  let finished = false;
  let timer = null;
  let startTime = 0;
  let elapsed = 0;

  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const timeEl = document.getElementById("time");
  const statusEl = document.getElementById("status");
  const restartBtn = document.getElementById("restart");

  const elByVal = {};    // value -> 数字块 DOM（0 没有）

  function rc(i) { return { row: Math.floor(i / SIZE), col: i % SIZE }; }
  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? m + ":" + String(s).padStart(2, "0") : s + "s";
  }

  /* ---------- 几何 ---------- */
  function dims() {
    const cs = getComputedStyle(boardEl);
    const f = (n) => parseFloat(cs.getPropertyValue(n)) || 90;
    const t = f("--t"), g = f("--g"), pd = f("--pd");
    return { t, g, pd, step: t + g };
  }
  function setPos(el, idx) {
    const { pd, step } = dims();
    const p = rc(idx);
    el.style.left = (pd + p.col * step) + "px";
    el.style.top = (pd + p.row * step) + "px";
  }

  function canSlide(index) {
    const t = rc(index), b = rc(blank);
    return t.row === b.row || t.col === b.col;
  }

  /* ---------- 洗牌（可解） ---------- */
  function shuffle() {
    board = SOLVED.slice();
    blank = TOTAL - 1;
    let last = -1;
    for (let k = 0; k < 500; k++) {
      const b = rc(blank);
      const candidates = [];
      for (let c = 0; c < SIZE; c++) if (c !== b.col) candidates.push(b.row * SIZE + c);
      for (let r = 0; r < SIZE; r++) if (r !== b.row) candidates.push(r * SIZE + b.col);
      const pickable = candidates.filter((i) => i !== last);
      const pick = pickable[(Math.random() * pickable.length) | 0];
      const prev = blank;
      slideToward(pick, true);
      last = prev;
    }
    if (board.join(",") === SOLVED.join(",")) shuffle();
  }

  /* ---------- 移动 ---------- */
  function slideToward(index, silent) {
    const b = rc(blank), t = rc(index);
    if (b.row !== t.row && b.col !== t.col) return false;
    const dr = Math.sign(t.row - b.row);
    const dc = Math.sign(t.col - b.col);
    let cur = blank;
    const movedVals = [];
    while (cur !== index) {
      const p = rc(cur);
      const nxt = (p.row + dr) * SIZE + (p.col + dc);
      board[cur] = board[nxt];
      board[nxt] = 0;
      if (board[cur]) movedVals.push(board[cur]);
      cur = nxt;
    }
    blank = index;

    // 平滑重排所有受影响数字块（也可能整行整列都动）
    for (const v of movedVals) {
      const el = elByVal[v];
      if (el) setPos(el, board.indexOf(v));
    }
    // 安全兜底：若有未覆盖的也统一归位（合并碰撞不会发生，值唯一）
    for (let i = 0; i < TOTAL; i++) {
      const v = board[i];
      if (!v) continue;
      const el = elByVal[v];
      if (el && !isAt(el, i)) setPos(el, i);
    }

    if (!silent) {
      moves++;
      movesEl.textContent = moves;
      startTimerIfNeeded();
    }
    return true;
  }

  function isAt(el, idx) {
    const { pd, step } = dims();
    const p = rc(idx);
    return parseFloat(el.style.left) === pd + p.col * step &&
           parseFloat(el.style.top) === pd + p.row * step;
  }

  /* ---------- 输入 ---------- */
  function moveTile(index) {
    if (finished || index === blank) return;
    if (slideToward(index)) {
      markMovable();
      checkWin();
    }
  }
  function moveBlank(dir) {
    if (finished) return;
    const b = rc(blank);
    let target = -1;
    if (dir === "up" && b.row > 0) target = blank - SIZE;
    if (dir === "down" && b.row < SIZE - 1) target = blank + SIZE;
    if (dir === "left" && b.col > 0) target = blank - 1;
    if (dir === "right" && b.col < SIZE - 1) target = blank + 1;
    if (target !== -1) moveTile(target);
  }

  /* ---------- 计时 ---------- */
  function startTimerIfNeeded() {
    if (started || finished) return;
    started = true;
    startTime = Date.now();
    timer = setInterval(() => {
      elapsed = Math.floor((Date.now() - startTime) / 1000);
      timeEl.textContent = fmtTime(elapsed);
    }, 250);
  }
  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* ---------- 胜利 ---------- */
  function checkWin() {
    if (board.join(",") !== SOLVED.join(",")) return;
    finished = true;
    stopTimer();
    if (started) elapsed = Math.floor((Date.now() - startTime) / 1000);
    timeEl.textContent = fmtTime(elapsed);
    statusEl.textContent = "🎉 恭喜你！用 " + moves + " 步、" + fmtTime(elapsed) + " 完成拼图！";
    statusEl.className = "msg win";
  }

  /* ---------- 渲染 ---------- */
  function buildStatic() {
    boardEl.innerHTML = "";
    for (let i = 0; i < TOTAL; i++) {
      const s = document.createElement("div");
      s.className = "slot";
      boardEl.appendChild(s);
    }
  }
  function renderFirst() {
    // 首次 / 洗牌后：一次性摆放（不带过渡视觉）
    for (let i = 0; i < TOTAL; i++) {
      const v = board[i];
      if (!v) continue;
      const el = elByVal[v] || (function () {
        const e = document.createElement("div");
        e.className = "tile";
        e.dataset.val = v;
        e.textContent = v;
        if (v >= 10) e.classList.add("big");
        e.addEventListener("pointerdown", (ev) => startDragTile(v, ev));
        boardEl.appendChild(e);
        elByVal[v] = e;
        return e;
      })();
      // 关掉过渡瞬移一次
      el.style.transition = "none";
      setPos(el, i);
      void el.offsetWidth;
      el.style.transition = "";
    }
    // 清理多余元素（重开时）
    for (const v in elByVal) {
      const el = elByVal[v];
      if (!board.includes(Number(v))) { el.remove(); delete elByVal[v]; }
    }
    markMovable();
  }

  function markMovable() {
    for (const v in elByVal) {
      const idx = board.indexOf(Number(v));
      const el = elByVal[v];
      el.classList.toggle("movable", idx >= 0 && idx !== blank && canSlide(idx));
    }
  }

  /* ---------- 重置 ---------- */
  /* ---------- 按住拖动：网格吸附 + 连续链动 ---------- */
  var dragT = { val: null, axis: null, accum: 0, lastX: 0, lastY: 0, moved: false };

  function startDragTile(v, e) {
    if (finished) return;
    dragT.val = v;
    dragT.axis = null;
    dragT.accum = 0;
    dragT.moved = false;
    dragT.lastX = e.clientX;
    dragT.lastY = e.clientY;
    if (elByVal[v]) elByVal[v].classList.add("dragging");
  }
  function stepBlank(name) {
    var prev = blank;
    moveBlank(name);
    return blank !== prev;
  }
  function dragStepOnce() {
    var a = dragT.axis;
    var tile = board.indexOf(dragT.val);
    if (tile < 0) return false;
    var t = rc(tile), b = rc(blank);
    if (a.dx !== 0) {
      if (t.row !== b.row) return false;
      if (!(a.dx > 0 ? b.col > t.col : b.col < t.col)) return false;
    } else {
      if (t.col !== b.col) return false;
      if (!(a.dy > 0 ? b.row > t.row : b.row < t.row)) return false;
    }
    var dirName = a.dx > 0 ? "left" : a.dx < 0 ? "right" : a.dy > 0 ? "up" : "down";
    if (stepBlank(dirName)) { dragT.moved = true; return true; }
    return false;
  }
  function onDragMove(e) {
    if (!dragT.val) return;
    if (!dragT.axis) {
      var dx = e.clientX - dragT.lastX, dy = e.clientY - dragT.lastY;
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragT.axis = Math.abs(dx) >= Math.abs(dy)
        ? { dx: Math.sign(dx), dy: 0 }
        : { dx: 0, dy: Math.sign(dy) };
    }
    var st = dims().step;
    var dp = (e.clientX - dragT.lastX) * dragT.axis.dx + (e.clientY - dragT.lastY) * dragT.axis.dy;
    dragT.accum += dp;
    var n = Math.trunc(dragT.accum / st);
    if (n !== 0) {
      // 只推进 n 步；把余数留到下一事件，避免同一段位移被重复计数
      dragT.accum -= n * st;
      for (var i = 0; i < Math.abs(n); i++) { if (!dragStepOnce()) break; }
    }
    dragT.lastX = e.clientX;
    dragT.lastY = e.clientY;
  }
  function onDragEnd() {
    if (!dragT.val) return;
    var v = dragT.val;
    if (elByVal[v]) elByVal[v].classList.remove("dragging");
    if (!dragT.moved) {
      var idx = board.indexOf(v);
      if (idx >= 0 && idx !== blank) moveTile(idx);   // 轻点 = 行列快速滑动
    }
    dragT.val = null;
  }
  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", onDragEnd);

  function reset() {
    stopTimer();
    moves = 0;
    started = false;
    finished = false;
    elapsed = 0;
    movesEl.textContent = "0";
    timeEl.textContent = "0s";
    statusEl.textContent = "";
    statusEl.className = "msg";
    // 清空数字块映射，避免复用已从 DOM 摘除的旧元素
    for (const v in elByVal) { delete elByVal[v]; }
    buildStatic();
    shuffle();
    renderFirst();
  }

  /* ---------- 事件 ---------- */
  document.addEventListener("keydown", (e) => {
    const keyMap = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    const dir = keyMap[e.key];
    if (dir) { e.preventDefault(); moveBlank(dir); }
  });

  let touchStart = null;
  boardEl.addEventListener("touchstart", (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  boardEl.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) moveBlank(dx > 0 ? "right" : "left");
    else moveBlank(dy > 0 ? "down" : "up");
  }, { passive: true });

  window.addEventListener("resize", () => {
    for (const v in elByVal) {
      const idx = board.indexOf(Number(v));
      if (idx >= 0) {
        const el = elByVal[v];
        el.style.transition = "none";
        setPos(el, idx);
        void el.offsetWidth;
        el.style.transition = "";
      }
    }
  });

  restartBtn.addEventListener("click", reset);

  reset();
})();
