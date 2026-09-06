/* ============================================================
   翻转棋 · 桌游（6x6 黑白棋，对 AI）
   你执黑先手；夹住对方即可翻转；AI 用启发式（尽量多翻/抢角）
   ============================================================ */
(function () {
  "use strict";

  const N = 6;
  const boardEl = document.getElementById("board");
  const youEl = document.getElementById("you");
  const aiEl = document.getElementById("ai");
  const turnEl = document.getElementById("turn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let grid = null;         // 'B' | 'W' | null
  let turn = "B", over = false, passCount = 0;
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

  function legalFlips(r, c, me) {
    const them = me === "B" ? "W" : "B";
    if (grid[r][c]) return [];
    const flips = [];
    for (const [dr, dc] of DIRS) {
      const line = [];
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < N && cc >= 0 && cc < N && grid[rr][cc] === them) {
        line.push([rr, cc]);
        rr += dr; cc += dc;
      }
      if (line.length && rr >= 0 && rr < N && cc >= 0 && cc < N && grid[rr][cc] === me) {
        flips.push(...line);
      }
    }
    return flips;
  }
  function legalMoves(me) {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (legalFlips(r, c, me).length) out.push([r, c]);
    return out;
  }

  function isFull() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) return false;
    return true;
  }

  function place(r, c, me) {
    const flips = legalFlips(r, c, me);
    if (!flips.length) return false;
    grid[r][c] = me;
    flips.forEach(([rr, cc]) => { grid[rr][cc] = me; });
    return true;
  }

  function sync() {
    boardEl.innerHTML = "";
    let b = 0, w = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement("button");
        cell.dataset.r = r; cell.dataset.c = c;
        if (grid[r][c]) {
          const d = document.createElement("span");
          d.className = "disc " + (grid[r][c] === "B" ? "b" : "w");
          cell.appendChild(d);
          cell.classList.add("filled");
          if (grid[r][c] === "B") b++; else w++;
        }
        cell.addEventListener("click", () => onCell(r, c));
        boardEl.appendChild(cell);
      }
    }
    // 提示合法落点
    legalMoves(turn).forEach(([r, c]) => {
      const cell = boardEl.querySelector('button[data-r="' + r + '"][data-c="' + c + '"]');
      if (cell && !cell.classList.contains("filled")) cell.classList.add("legal");
    });
    youEl.textContent = b; aiEl.textContent = w;
    turnEl.textContent = turn === "B" ? "你" : "AI";
    turnEl.style.color = turn === "B" ? "#7ce08a" : "#ff8a97";
  }

  function onCell(r, c) {
    if (over || turn !== "B") return;
    if (!place(r, c, "B")) return;
    passCount = 0;
    turn = "W";
    sync();
    if (isFull()) { finish(); return; }
    setTimeout(aiMove, 600);
  }

  function aiMove() {
    if (over || turn !== "W") return;
    const moves = legalMoves("W");
    if (!moves.length) {
      passCount++;
      msgEl.textContent = "AI 无子可下，你继续。";
      if (passCount >= 2 || isFull()) { finish(); return; }
      turn = "B"; sync();
      return;
    }
    passCount = 0;
    let best = moves[0], bestScore = -1;
    for (const [r, c] of moves) {
      const flips = legalFlips(r, c, "W");
      const big = (r === 0 || r === N - 1) && (c === 0 || c === N - 1) ? 3 : 0;
      const sc = flips.length + big + Math.random() * 0.5;
      if (sc > bestScore) { bestScore = sc; best = [r, c]; }
    }
    place(best[0], best[1], "W");
    if (isFull()) { sync(); finish(); return; }
    const youMoves = legalMoves("B").length;
    if (!youMoves) {
      passCount++;
      msgEl.textContent = "你无子可下，AI 继续。";
      if (passCount >= 2 || isFull()) { finish(); return; }
      turn = "W"; sync();
      setTimeout(aiMove, 600);
      return;
    }
    passCount = 0;
    turn = "B";
    sync();
  }

  function finish() {
    over = true;
    let b = 0, w = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (grid[r][c] === "B") b++; else if (grid[r][c] === "W") w++; }
    if (b === w) { msgEl.textContent = "🤝 平局（" + b + ":" + w + "）。"; msgEl.className = "msg win"; }
    else {
      const win = b > w;
      msgEl.textContent = win ? "🎉 你赢了（" + b + ":" + w + "）！" : "💪 AI 赢了（" + b + ":" + w + "）…";
      msgEl.className = "msg win";
    }
    endTitle.textContent = b > w ? "🏆 你赢了！" : b < w ? "🤖 AI 赢了…" : "🤝 平局";
    endMsg.textContent = "黑 " + b + " 对 白 " + w;
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function start() {
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    const mid = N / 2;
    grid[mid - 1][mid - 1] = "W"; grid[mid - 1][mid] = "B";
    grid[mid][mid - 1] = "B"; grid[mid][mid] = "W";
    turn = "B"; over = false; passCount = 0;
    msgEl.textContent = "你执黑先行，点击高亮空格落子。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    sync();
  }

  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  againBtn.addEventListener("click", start);

  start();
})();
