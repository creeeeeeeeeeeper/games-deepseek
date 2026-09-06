/* ============================================================
   五子棋 · 15×15
   单人=对战 AI（威胁评分）/ 双人=同屏轮流；先连五子胜
   ============================================================ */
(function () {
  "use strict";

  const N = 15, CELL = 40, M = CELL;           // 600×600
  const cv = document.getElementById("board");
  const ctx = cv.getContext("2d");
  const msgEl = document.getElementById("msg");
  const turnEl = document.getElementById("turn");
  const scoreAEl = document.getElementById("scoreA");
  const scoreBEl = document.getElementById("scoreB");
  const lblA = document.getElementById("lblA");
  const lblB = document.getElementById("lblB");
  const restartBtn = document.getElementById("restart");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");
  const modeBtns = Array.from(document.querySelectorAll(".mode-btn"));

  let mode = "ai";
  let board = [];           // 0 空 1 黑 2 白
  let cur = 1;
  let running = false;
  let scores = [0, 0];
  let stones = [];          // {r,c,p,t0}
  let winLine = [];
  let aiTimer = null;
  let over = false;
  let now = 0;

  const starPts = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];

  function resetBoard() {
    board = [];
    for (let r = 0; r < N; r++) board.push(new Array(N).fill(0));
    stones = [];
    winLine = [];
    cur = 1;
    running = true;
    over = false;
    endModal.classList.remove("show");
    updateTurn();
    showMsg(mode === "ai" ? "你执黑先行" : "玩家 1（黑）先行", "");
  }

  function setMode(m) {
    mode = m;
    modeBtns.forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    lblA.textContent = m === "ai" ? "你" : "玩家 1";
    lblB.textContent = m === "ai" ? "AI" : "玩家 2";
    resetBoard();
  }

  function sideName(p) {
    if (mode === "ai") return p === 1 ? "你" : "AI";
    return p === 1 ? "玩家 1" : "玩家 2";
  }
  function updateTurn() {
    turnEl.textContent = sideName(cur) + (cur === 1 ? "（黑）" : "（白）");
    turnEl.className = cur === 1 ? "b" : "w";
  }
  function showMsg(t, cls) {
    msgEl.textContent = t;
    msgEl.className = "msg" + (cls ? " " + cls : "");
  }

  function place(r, c, p) {
    board[r][c] = p;
    stones.push({ r, c, p, t0: performance.now() / 1000 });
    const wl = hasFive(r, c, p);
    if (wl) winLine = wl;
    return !!wl;
  }

  function count5(r, c, p, dr, dc) {
    const line = [[r, c]];
    for (let s = 1; s < 5; s++) {
      const rr = r + dr * s, cc = c + dc * s;
      if (rr < 0 || rr >= N || cc < 0 || cc >= N || board[rr][cc] !== p) break;
      line.push([rr, cc]);
    }
    for (let s = 1; s < 5; s++) {
      const rr = r - dr * s, cc = c - dc * s;
      if (rr < 0 || rr >= N || cc < 0 || cc >= N || board[rr][cc] !== p) break;
      line.push([rr, cc]);
    }
    return line;
  }
  function hasFive(r, c, p) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const line = count5(r, c, p, dr, dc);
      if (line.length >= 5) return line;
    }
    return null;
  }

  function isFull() {
    return stones.length >= N * N;
  }

  function afterMove(r, c) {
    if (winLine.length) { endGame(cur); return; }
    if (isFull()) { endGame(0); return; }
    cur = cur === 1 ? 2 : 1;
    updateTurn();
    if (mode === "ai" && cur === 2) aiTimer = setTimeout(() => { aiMove(); }, 380);
  }

  function onBoardClick(e) {
    if (!running) return;
    if (mode === "ai" && cur === 2) return;
    const rect = cv.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 600;
    const my = ((e.clientY - rect.top) / rect.height) * 600;
    const c = Math.round((mx - M) / CELL), r = Math.round((my - M) / CELL);
    if (r < 0 || r >= N || c < 0 || c >= N) return;
    if (board[r][c]) return;
    place(r, c, cur);
    afterMove(r, c);
  }

  /* ---------- AI（威胁评分） ---------- */
  function aiMove() {
    if (!running || mode !== "ai" || cur !== 2) return;
    const empty = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!board[r][c]) empty.push([r, c]);
    if (!empty.length) return;

    // 开局走中心附近
    if (stones.length <= 2) {
      const cand = empty.filter(([r, c]) => Math.abs(r - 7) <= 3 && Math.abs(c - 7) <= 3);
      const pool = cand.length ? cand : empty;
      const pick = pool[(Math.random() * pool.length) | 0];
      place(pick[0], pick[1], 2);
      afterMove(pick[0], pick[1]);
      return;
    }

    let bestCell = null, bestScore = -1;
    empty.forEach(([r, c]) => {
      const s = cellValue(r, c, 2) + cellValue(r, c, 1) * 0.82;
      if (s > bestScore) { bestScore = s; bestCell = [r, c]; }
    });
    if (!bestCell) return;
    place(bestCell[0], bestCell[1], 2);
    afterMove(bestCell[0], bestCell[1]);
  }

  function cellValue(r, c, p) {
    if (hasFive(r, c, p)) return 1e9;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let total = 0;
    for (const [dr, dc] of dirs) {
      let cnt = 1;
      let openL = 0, openR = 0;
      for (let s = 1; ; s++) {
        const rr = r - dr * s, cc = c - dc * s;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) break;
        if (board[rr][cc] === p) cnt++;
        else { if (!board[rr][cc]) openL = 1; break; }
      }
      for (let s = 1; ; s++) {
        const rr = r + dr * s, cc = c + dc * s;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) break;
        if (board[rr][cc] === p) cnt++;
        else { if (!board[rr][cc]) openR = 1; break; }
      }
      if (cnt >= 5) return 1e9;
      const open = openL + openR;
      if (cnt >= 4) total += open === 2 ? 20000 : open === 1 ? 4000 : 300;
      else if (cnt === 3) total += open === 2 ? 1600 : open === 1 ? 200 : 10;
      else if (cnt === 2) total += open === 2 ? 120 : open === 1 ? 25 : 2;
      else total += open >= 1 ? 4 : 0;
    }
    return total;
  }

  function endGame(w) {
    running = false;
    over = true;
    if (!w) {
      showMsg("🤝 棋盘已满，平局！", "");
      turnEl.textContent = "平局";
      turnEl.className = "";
      return;
    }
    scores[w - 1] += 1;
    (w === 1 ? scoreAEl : scoreBEl).textContent = scores[w - 1];
    showMsg("🎉 " + sideName(w) + " 获胜！", "win");
    turnEl.textContent = sideName(w) + " 胜";
    turnEl.className = w === 1 ? "b" : "w";
    endTitle.textContent = "🎉 " + sideName(w) + " 获胜！";
    endMsg.textContent = "五子连珠！比分 " + scores[0] + " : " + scores[1];
    setTimeout(() => endModal.classList.add("show"), 600);
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, 600, 600);
    // 木纹背景
    const bg = ctx.createLinearGradient(0, 0, 600, 600);
    bg.addColorStop(0, "#edcb8c");
    bg.addColorStop(1, "#d9a95f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 600, 600);

    // 网格
    ctx.strokeStyle = "#5b3d1e";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      ctx.moveTo(M + i * CELL, M);
      ctx.lineTo(M + i * CELL, M + (N - 1) * CELL);
      ctx.moveTo(M, M + i * CELL);
      ctx.lineTo(M + (N - 1) * CELL, M + i * CELL);
    }
    ctx.stroke();

    // 星位
    ctx.fillStyle = "#5b3d1e";
    starPts.forEach(([r, c]) => {
      ctx.beginPath();
      ctx.arc(M + c * CELL, M + r * CELL, 4.4, 0, 7);
      ctx.fill();
    });

    // 最后一步标记
    const last = stones[stones.length - 1];
    if (last && !winLine.length) {
      ctx.strokeStyle = last.p === 1 ? "rgba(255,90,90,0.9)" : "rgba(230,60,60,0.9)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(M + last.c * CELL, M + last.r * CELL, 9, 0, 7);
      ctx.stroke();
    }

    // 棋子
    stones.forEach((s) => {
      const age = performance.now() / 1000 - s.t0;
      const scale = Math.min(1, age / 0.18);
      const x = M + s.c * CELL, y = M + s.r * CELL;
      const R = 16 * (0.3 + 0.7 * scale);
      const grad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, R);
      if (s.p === 1) { grad.addColorStop(0, "#4a4f57"); grad.addColorStop(1, "#0c0e12"); }
      else { grad.addColorStop(0, "#ffffff"); grad.addColorStop(1, "#c9c4ba"); }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, 7);
      ctx.fill();
    });

    // 胜利线
    if (winLine.length) {
      const a = winLine[0], b = winLine[winLine.length - 1];
      ctx.strokeStyle = "rgba(52,211,153,0.95)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(M + a.c * CELL, M + a.r * CELL);
      ctx.lineTo(M + b.c * CELL, M + b.r * CELL);
      ctx.stroke();
    }
  }

  function frame(ts) {
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- 事件 ---------- */
  cv.addEventListener("click", onBoardClick);
  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  restartBtn.addEventListener("click", resetBoard);
  againBtn.addEventListener("click", resetBoard);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); resetBoard(); }
  });

  setMode("ai");
  requestAnimationFrame(frame);
})();
