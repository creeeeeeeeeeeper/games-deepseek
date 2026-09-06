/* ============================================================
   四子棋 · 7×6 竖直连线
   单人=对战 AI / 双人=同屏轮流；四连判胜（横竖斜）
   ============================================================ */
(function () {
  "use strict";

  const COLS = 7, ROWS = 6;
  const boardEl = document.getElementById("board");
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

  let mode = "ai";         // ai | pvp
  let grid = [];           // grid[r][c] = 0 | 1 | 2
  let cur = 1;             // 1=红 p1 / 2=黄 p2
  let running = false;
  let scores = [0, 0];
  let aiTimer = null;

  const CELL = 52;
  const styles = getComputedStyle(boardEl);

  function cellCss() {
    // 读取 --cell 像素值用于下落动画
    const v = styles.getPropertyValue("--cell").trim();
    return parseFloat(v) || 52;
  }

  function reset(keep) {
    clearTimeout(aiTimer);
    grid = [];
    for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(0));
    cur = 1;
    running = true;
    boardEl.innerHTML = "";
    const cellPx = cellCss();
    // 渲染格点
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        boardEl.appendChild(cell);
      }
    }
    // 列点击热区
    for (let c = 0; c < COLS; c++) {
      const btn = document.createElement("div");
      btn.className = "col-btn";
      btn.style.left = (10 + c * (cellPx + 5) + cellPx / 2) + "px";
      btn.addEventListener("click", () => onCol(c));
      boardEl.appendChild(btn);
    }
    updateTurn();
    showMsg(mode === "ai" ? "你执红先行，点击列顶部落子" : "玩家 1（红）先手", "");
    endModal.classList.remove("show");
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
    reset();
  }

  function sideName(p) {
    if (mode === "ai") return p === 1 ? "你" : "AI";
    return p === 1 ? "玩家 1" : "玩家 2";
  }

  function updateTurn() {
    turnEl.textContent = sideName(cur) + (cur === 1 ? "（红）" : "（黄）");
    turnEl.className = cur === 1 ? "p1" : "p2";
  }

  function showMsg(t, cls) {
    msgEl.textContent = t;
    msgEl.className = "msg" + (cls ? " " + cls : "");
  }

  function dropTo(c) {
    // 找到该列最低空位
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c] === 0) return r;
    }
    return -1;
  }

  function place(r, c, player, animate) {
    grid[r][c] = player;
    const cellEl = boardEl.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
    const piece = document.createElement("div");
    piece.className = "piece " + (player === 1 ? "p1" : "p2");
    if (animate) {
      const cellPx = cellCss() + 5;
      piece.style.setProperty("--drop", -((ROWS - 1 - r) * cellPx) + "px");
    }
    cellEl.appendChild(piece);
    return winAt(r, c, true);
  }

  function winAt(r, c, hl) {
    const p = grid[r][c];
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const line = [[r, c]];
      for (let s = 1; s < 4; s++) {
        const rr = r + dr * s, cc = c + dc * s;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] === p) line.push([rr, cc]);
        else break;
      }
      for (let s = 1; s < 4; s++) {
        const rr = r - dr * s, cc = c - dc * s;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] === p) line.push([rr, cc]);
        else break;
      }
      if (line.length >= 4) {
        if (hl) {
          line.forEach(([rr, cc]) => {
            const el = boardEl.querySelector('.cell[data-r="' + rr + '"][data-c="' + cc + '"]');
            if (el) el.classList.add("winpiece");
          });
        }
        return p;
      }
    }
    return 0;
  }

  function isFull() {
    return grid.every((row) => row.every((v) => v !== 0));
  }

  function afterMove(r, c) {
    const w = winAt(r, c, false);
    if (w) { endGame(w); return; }
    if (isFull()) { endGame(0); return; }
    cur = cur === 1 ? 2 : 1;
    updateTurn();
    if (mode === "ai" && cur === 2) {
      aiTimer = setTimeout(() => aiTurn(), 420);
    }
  }

  function onCol(c) {
    if (!running) return;
    if (mode === "ai" && cur === 2) return;
    const r = dropTo(c);
    if (r < 0) return;
    place(r, c, cur, true);
    afterMove(r, c);
  }

  /* ---------- AI ---------- */
  function aiTurn() {
    if (!running || mode !== "ai" || cur !== 2) return;
    const c = aiPick();
    const r = dropTo(c);
    if (r < 0) return;
    place(r, c, 2, true);
    afterMove(r, c);
  }

  function aiPick() {
    // 1) 自己可赢
    for (let c = 0; c < COLS; c++) {
      const r = dropTo(c);
      if (r < 0) continue;
      if (wouldWin(r, c, 2)) return c;
    }
    // 2) 堵玩家
    for (let c = 0; c < COLS; c++) {
      const r = dropTo(c);
      if (r < 0) continue;
      if (wouldWin(r, c, 1)) return c;
    }
    // 3) 中心优先 + 随机
    const order = [3, 2, 4, 1, 5, 0, 6];
    for (const c of order) if (dropTo(c) >= 0) return c;
    return 3;
  }

  function wouldWin(r, c, p) {
    grid[r][c] = p;
    const w = winAt(r, c, false);
    grid[r][c] = 0;
    return !!w;
  }

  function endGame(w) {
    running = false;
    if (!w) {
      showMsg("🤝 平局！棋盘已满。", "");
      turnEl.textContent = "平局";
      turnEl.className = "";
      return;
    }
    scores[w - 1] += 1;
    (w === 1 ? scoreAEl : scoreBEl).textContent = scores[w - 1];
    showMsg("🎉 " + sideName(w) + " 获胜！", "win");
    turnEl.textContent = sideName(w) + " 胜";
    turnEl.className = w === 1 ? "p1" : "p2";
    endTitle.textContent = "🎉 " + sideName(w) + " 获胜！";
    endMsg.textContent = "率先连成四子！当前比分 " + scores[0] + " : " + scores[1];
    setTimeout(() => endModal.classList.add("show"), 700);
  }

  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  restartBtn.addEventListener("click", reset);
  againBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); reset(); }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 7) onCol(n - 1);
  });

  setMode("ai");
})();
