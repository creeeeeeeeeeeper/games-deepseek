/* ============================================================
   宝石消消乐 · 休闲娱乐（单人）
   8×8 盘面，交换相邻宝石凑 3+ 连消；连锁越多分越高
   ============================================================ */
(function () {
  "use strict";

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const movesEl = document.getElementById("moves");
  const comboEl = document.getElementById("combo");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const COLS = 8, ROWS = 8, COLORS = 5, TOTAL_MOVES = 30;
  const GLYPHS = ["◆", "●", "▲", "■", "★"];

  let grid = [], score = 0, moves = TOTAL_MOVES, sel = null, busy = false, over = false;

  function newGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        let col;
        do { col = (Math.random() * COLORS) | 0; }
        while ((c >= 2 && row[c - 1] === col && row[c - 2] === col) ||
               (r >= 2 && grid[r - 1][c] === col && grid[r - 2][c] === col));
        row.push(col);
      }
      grid.push(row);
    }
  }

  function render() {
    boardEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const d = document.createElement("div");
        d.className = "gem c" + grid[r][c];
        d.textContent = GLYPHS[grid[r][c]];
        d.dataset.r = r; d.dataset.c = c;
        d.addEventListener("click", () => onTap(r, c));
        boardEl.appendChild(d);
      }
    }
  }

  function findMatches() {
    const hit = new Set();
    // 横向
    for (let r = 0; r < ROWS; r++) {
      let run = 1;
      for (let c = 1; c <= COLS; c++) {
        if (c < COLS && grid[r][c] === grid[r][c - 1]) { run++; continue; }
        if (run >= 3) for (let k = c - run; k < c; k++) hit.add(r * COLS + k);
        run = 1;
      }
    }
    // 纵向
    for (let c = 0; c < COLS; c++) {
      let run = 1;
      for (let r = 1; r <= ROWS; r++) {
        if (r < ROWS && grid[r][c] === grid[r - 1][c]) { run++; continue; }
        if (run >= 3) for (let k = r - run; k < r; k++) hit.add(k * COLS + c);
        run = 1;
      }
    }
    return hit;
  }

  function swap(a, b) {
    const t = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = t;
  }

  function adjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function applyGravity() {
    for (let c = 0; c < COLS; c++) {
      const col = [];
      for (let r = 0; r < ROWS; r++) if (grid[r][c] >= 0) col.push(grid[r][c]);
      while (col.length < ROWS) col.unshift(-1);
      for (let r = 0; r < ROWS; r++) grid[r][c] = col[r];
    }
    // 补新宝石
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] < 0) grid[r][c] = (Math.random() * COLORS) | 0;
  }

  async function cascade() {
    let chain = 0, gained;
    do {
      const matches = findMatches();
      if (matches.size === 0) break;
      chain++;
      gained = matches.size;
      // 标记消除动画
      matches.forEach((id) => {
        const r = (id / COLS) | 0, c = id % COLS;
        const el = boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        if (el) el.classList.add("pop");
      });
      score += gained * chain;
      if (chain > 1) msgEl.textContent = "💥 连锁 x" + chain + "！ +" + (gained * chain);
      comboEl.textContent = chain;
      await wait(300);
      matches.forEach((id) => { grid[(id / COLS) | 0][id % COLS] = -1; });
      applyGravity();
      render();
      await wait(120);
    } while (true);
  }

  function wait(ms) { return new Promise((res) => setTimeout(res, ms)); }

  async function onTap(r, c) {
    if (busy || over) return;
    if (!sel) {
      sel = { r, c };
      mark(r, c);
      return;
    }
    if (sel.r === r && sel.c === c) { clearSel(); return; }
    const a = sel; clearSel();
    const b = { r, c };
    if (!adjacent(a, b)) { sel = { r, c }; mark(r, c); return; }
    busy = true;
    swap(a, b);
    const matches = findMatches();
    if (matches.size === 0) {
      swap(a, b);
      msgEl.textContent = "这样换不会消除，再试试。";
      busy = false;
      return;
    }
    moves--;
    movesEl.textContent = moves;
    await cascade();
    scoreEl.textContent = score;
    // 若无任何可交换 => 自动重排，避免软锁
    if (!hasMove()) {
      msgEl.textContent = "没有可消的了，自动重排！";
      await reshuffle();
      await cascade();
      scoreEl.textContent = score;
    }
    msgEl.textContent = "有得消！再点两颗相邻宝石。";
    busy = false;
    if (moves <= 0) { finish(); }
  }

  function hasMove() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS) { swap({ r, c }, { r, c: c + 1 }); const m = findMatches().size > 0; swap({ r, c }, { r, c: c + 1 }); if (m) return true; }
      if (r + 1 < ROWS) { swap({ r, c }, { r: r + 1, c }); const m = findMatches().size > 0; swap({ r, c }, { r: r + 1, c }); if (m) return true; }
    }
    return false;
  }

  function reshuffle() {
    return new Promise((res) => {
      // 重新洗牌，避免出现无可消灭情况（保险起见循环几次）
      const vals = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) vals.push(grid[r][c]);
      for (let i = vals.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [vals[i], vals[j]] = [vals[j], vals[i]]; }
      let k = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = vals[k++];
      if (!hasMove()) { rerandomize(); }
      render();
      res();
    });
  }
  function rerandomize() {
    // 兜底：全部随机重新填色直到有解
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = (Math.random() * COLORS) | 0;
    if (!hasMove()) rerandomize();
  }

  function mark(r, c) {
    const el = boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (el) el.classList.add("sel");
  }
  function clearSel() {
    const el = boardEl.querySelector(".sel");
    if (el) el.classList.remove("sel");
    sel = null;
  }

  function finish() {
    over = true;
    endTitle.textContent = score >= 400 ? "🎉 高分冲线！" : "⏰ 步数用尽";
    endMsg.textContent = "得分 " + score + "（目标 400）";
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function start() {
    newGrid();
    score = 0; moves = TOTAL_MOVES; sel = null; busy = false; over = false;
    scoreEl.textContent = 0; movesEl.textContent = moves; comboEl.textContent = 0;
    msgEl.textContent = "点击一颗宝石，再点它相邻的宝石交换。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  start();
})();
