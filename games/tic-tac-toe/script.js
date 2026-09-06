/* ============================================================
   井字棋（Tic-Tac-Toe）v2
   - 纯原生 JavaScript，IIFE 包裹，无任何外部依赖
   - 两种模式：
       AI 模式  ：你执 X 对战 AI（O）
       PVP 模式 ：玩家1(X) 与 玩家2(O) 同屏轮流
   - AI 策略（按优先级）：
       1) 能直接获胜就赢  2) 封堵对手  3) 抢中心
       4) 随机角  5) 随机边
   - 动画：落子弹入、获胜连线脉冲、比分跳动、彩带庆祝、消息弹入
   ============================================================ */
(function () {
  "use strict";

  const SIZE = 3;
  const EMPTY = "";
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],   // 横
    [0, 3, 6], [1, 4, 7], [2, 5, 8],   // 竖
    [0, 4, 8], [2, 4, 6],              // 斜
  ];

  // ---- 游戏状态 ----
  let board = [];
  let running = false;
  let mode = "ai";        // "ai" | "pvp"
  let cur = "X";          // 当前行动方
  let aiTimer = null;
  const scores = { X: 0, O: 0 };

  // ---- DOM ----
  const boardEl = document.getElementById("board");
  const msgEl = document.getElementById("msg");
  const turnEl = document.getElementById("turn");
  const scoreXEl = document.getElementById("scoreX");
  const scoreOEl = document.getElementById("scoreO");
  const labelXEl = document.getElementById("labelX");
  const labelOEl = document.getElementById("labelO");
  const hintModeEl = document.getElementById("hintMode");
  const restartBtn = document.getElementById("restart");
  const modeBtns = Array.from(document.querySelectorAll(".mode-btn"));
  const cells = [];

  // 侧名：当前行动方在界面上的称呼
  function sideName(side) {
    if (mode === "pvp") return side === "X" ? "玩家 1" : "玩家 2";
    return side === "X" ? "你" : "AI";
  }

  /* ---------- 核心判定 ---------- */
  function findWinner(b) {
    for (const line of LINES) {
      const [a, bb, c] = line;
      if (b[a] && b[a] === b[bb] && b[a] === b[c]) {
        return { winner: b[a], line };
      }
    }
    return { winner: null, line: null };
  }
  function isFull(b) {
    return b.every((v) => v !== EMPTY);
  }
  function findWinningMove(player) {
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY) continue;
      board[i] = player;
      const w = findWinner(board);
      board[i] = EMPTY;
      if (w.winner === player) return i;
    }
    return null;
  }
  function aiMove() {
    let m = findWinningMove("O");
    if (m !== null) return m;
    m = findWinningMove("X");
    if (m !== null) return m;
    if (board[4] === EMPTY) return 4;
    const corners = [0, 2, 6, 8].filter((i) => board[i] === EMPTY);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    const sides = [1, 3, 5, 7].filter((i) => board[i] === EMPTY);
    if (sides.length) return sides[Math.floor(Math.random() * sides.length)];
    return null;
  }

  /* ---------- 渲染 ---------- */
  function buildCells() {
    boardEl.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "cell empty";
      cell.dataset.index = i;
      cell.setAttribute("role", "button");
      cell.setAttribute("aria-label", "空格 第 " + (Math.floor(i / 3) + 1) + " 行第 " + (i % 3 + 1) + " 列");
      cell.addEventListener("click", () => onCell(i));
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }

  function redraw() {
    board.forEach((v, i) => {
      const cell = cells[i];
      cell.classList.toggle("filled", v !== EMPTY);
      cell.classList.toggle("empty", v === EMPTY);
      cell.classList.toggle("x", v === "X");
      cell.classList.toggle("o", v === "O");
      cell.textContent = v;
    });
  }

  // 重触发落子弹入动画
  function popCell(i) {
    const cell = cells[i];
    cell.classList.remove("pop");
    void cell.offsetWidth;
    cell.classList.add("pop");
  }
  function bump(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }
  function showMsg(text, cls) {
    msgEl.textContent = text;
    msgEl.className = "msg" + (cls ? " " + cls : "");
    msgEl.classList.add("msg-pop");
  }

  function updateTurn() {
    turnEl.textContent = sideName(cur);
    turnEl.className = "turn " + cur.toLowerCase();
  }

  /* ---------- 流程 ---------- */
  function onCell(i) {
    if (!running || board[i] !== EMPTY) return;
    // AI 模式下轮到 AI（思考中）时，玩家点击无效
    if (mode === "ai" && cur === "O") return;

    place(i, cur);

    if (mode === "ai" && running && cur === "O") {
      // AI 回合：短暂“思考”后落子
      turnEl.textContent = "AI 思考中…";
      aiTimer = setTimeout(() => {
        if (!running) return;
        const m = aiMove();
        if (m !== null) place(m, "O");
      }, 360);
    }
  }

  // 在 i 处落 mark，并处理胜负
  function place(i, mark) {
    board[i] = mark;
    redraw();
    popCell(i);

    const w = findWinner(board);
    if (w.winner) { endRound(w.winner, w.line, false); return; }
    if (isFull(board)) { endRound(null, null, true); return; }

    cur = mark === "X" ? "O" : "X";
    updateTurn();
  }

  function endRound(winner, line, draw) {
    running = false;
    boardEl.classList.remove("draw-shake");
    if (draw || !winner) {
      boardEl.classList.add("draw-shake");
      showMsg("🤝 平局！棋盘下满，双方打平。", "draw");
      turnEl.textContent = "平局";
      turnEl.className = "turn";
      return;
    }
    // 记录比分
    scores[winner] += 1;
    (winner === "X" ? scoreXEl : scoreOEl).textContent = scores[winner];
    bump(winner === "X" ? scoreXEl : scoreOEl);

    // 高亮连线 + 提示语
    line.forEach((i) => cells[i].classList.add("win"));
    if (winner === "X") {
      showMsg(mode === "ai" ? "🎉 你赢了！漂亮！" : "🎉 玩家 1（X）获胜！", "win");
    } else {
      showMsg(mode === "ai" ? "🤖 AI 赢了！再试一次吧。" : "🎉 玩家 2（O）获胜！", "win");
    }
    turnEl.textContent = sideName(winner) + " 胜";
    turnEl.className = "turn " + winner.toLowerCase();

    // 彩带庆祝
    confetti();
  }

  function confetti() {
    const colors = ["#3aa0ff", "#34d399", "#ffd166", "#ff5d6c", "#b06bff", "#22d3ee"];
    const card = document.querySelector(".game-card");
    for (let i = 0; i < 26; i++) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[(Math.random() * colors.length) | 0];
      p.style.animationDelay = Math.random() * 0.5 + "s";
      p.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      card.appendChild(p);
      p.addEventListener("animationend", () => p.remove(), { once: true });
    }
  }

  /* ---------- 模式切换 ---------- */
  function setMode(m) {
    mode = m;
    modeBtns.forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    // 名字随模式变化
    labelXEl.textContent = m === "ai" ? "你" : "玩家 1";
    labelOEl.textContent = m === "ai" ? "AI" : "玩家 2";
    hintModeEl.textContent = m === "ai" ? "AI 模式下你执 X。" : "双人模式下两名玩家轮流落子。";
    newGame();
  }

  function newGame() {
    clearTimeout(aiTimer);
    board = Array(SIZE * SIZE).fill(EMPTY);
    running = true;
    cur = "X";
    // 清除上一局高亮 / 动画痕迹
    cells.forEach((c) => c.classList.remove("win", "pop"));
    boardEl.classList.remove("draw-shake");
    document.querySelectorAll(".confetti-piece").forEach((p) => p.remove());
    redraw();
    updateTurn();
    showMsg("", "");
    msgEl.classList.remove("msg-pop");
  }

  /* ---------- 事件 ---------- */
  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  restartBtn.addEventListener("click", newGame);

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); newGame(); return; }
    // 数字键 1-9 快速落子
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) onCell(n - 1);
  });

  /* ---------- 初始化 ---------- */
  buildCells();
  setMode("ai");
})();
