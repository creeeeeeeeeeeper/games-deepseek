/* ============================================================
   六角棋 Hex · 棋牌对战（人机）
   11×11 六边形棋盘；你连上下（竖），AI 连左右（横）
   采用轴向坐标 (q,r)，六邻居定向
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const youEl = document.getElementById("you");
  const aiEl = document.getElementById("ai");
  const turnEl = document.getElementById("turn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const SIZE = 8;
  const HEX = 30;
  const W = 440, H = 440;
  canvas.width = W; canvas.height = H;

  // 使用"方阵"坐标 (r,c) 行/列；near 邻居按六边形（偶数行奇偶偏移）
  let grid, turn, over, busy, moves;

  function makeGrid() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function reset() {
    makeGrid();
    turn = "player"; over = false; busy = false; moves = 0;
  }

  // 六边形屏幕坐标（奇数行右移）
  function center(r, c) {
    const x = 36 + c * HEX * 1.75 + (r % 2 ? HEX * 0.875 : 0);
    const y = 40 + r * HEX * 1.55;
    return { x, y };
  }

  function neighbors(r, c) {
    const res = [];
    const pairs = [[0,1],[0,-1],[1,0],[1,-1],[-1,0],[-1,1]];
    for (const [dr, dc] of pairs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) res.push([nr, nc]);
    }
    return res;
  }

  // 连通性判定：player 需连 row0→row(SIZE-1)；ai 连 col0→col(SIZE-1)
  function playerWins() {
    const start = [], goal = new Set();
    for (let c = 0; c < SIZE; c++) { if (grid[0][c] === 1) start.push([0, c]); if (grid[SIZE - 1][c] === 1) goal.add((SIZE - 1) + "," + c); }
    if (!start.length || !goal.size) return false;
    const seen = new Set(); const stack = start.slice();
    while (stack.length) {
      const [r, c] = stack.pop();
      const k = r + "," + c;
      if (seen.has(k)) continue;
      seen.add(k);
      if (goal.has(k)) return true;
      for (const [nr, nc] of neighbors(r, c)) if (grid[nr][nc] === 1) stack.push([nr, nc]);
    }
    return false;
  }
  function aiWins() {
    const start = [], goal = new Set();
    for (let r = 0; r < SIZE; r++) { if (grid[r][0] === 2) start.push([r, 0]); if (grid[r][SIZE - 1] === 2) goal.add(r + "," + (SIZE - 1)); }
    if (!start.length || !goal.size) return false;
    const seen = new Set(); const stack = start.slice();
    while (stack.length) {
      const [r, c] = stack.pop();
      const k = r + "," + c;
      if (seen.has(k)) continue;
      seen.add(k);
      if (goal.has(k)) return true;
      for (const [nr, nc] of neighbors(r, c)) if (grid[nr][nc] === 2) stack.push([nr, nc]);
    }
    return false;
  }

  function counts() {
    let a = 0, b = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) { if (grid[r][c] === 1) a++; else if (grid[r][c] === 2) b++; }
    return { player: a, ai: b };
  }

  function render() {
    const cnt = counts();
    youEl.textContent = cnt.player;
    aiEl.textContent = cnt.ai;
    turnEl.textContent = turn === "player" ? "你" : "AI";
    turnEl.style.color = turn === "player" ? "var(--accent-2)" : "var(--danger)";
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 边
    ctx.strokeStyle = "rgba(111,217,138,0.4)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(center(0, 0).x - 20, center(0, 0).y); ctx.lineTo(center(0, SIZE - 1).x + 20, center(0, SIZE - 1).y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(center(SIZE - 1, 0).x - 20, center(SIZE - 1, 0).y); ctx.lineTo(center(SIZE - 1, SIZE - 1).x + 20, center(SIZE - 1, SIZE - 1).y); ctx.stroke();
    ctx.strokeStyle = "rgba(217,75,58,0.4)";
    ctx.beginPath(); ctx.moveTo(center(0, 0).x, center(0, 0).y - 20); ctx.lineTo(center(SIZE - 1, 0).x, center(SIZE - 1, 0).y + 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(center(0, SIZE - 1).x, center(0, SIZE - 1).y - 20); ctx.lineTo(center(SIZE - 1, SIZE - 1).x, center(SIZE - 1, SIZE - 1).y + 20); ctx.stroke();

    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const { x, y } = center(r, c);
      ctx.fillStyle = "#2a2f3a";
      ctx.strokeStyle = "#3a4150"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3;
        const px = x + HEX * Math.cos(a), py = y + HEX * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (grid[r][c] === 1) { ctx.fillStyle = "#6fd98a"; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); }
      else if (grid[r][c] === 2) { ctx.fillStyle = "#d94b3a"; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function place(r, c, who) {
    if (over || busy || grid[r][c] !== 0) return false;
    grid[r][c] = who;
    moves++;
    render(); draw();
    return true;
  }

  function endFor(whoWin, label) {
    over = true; busy = false;
    endTitle.textContent = label;
    endMsg.textContent = "共 " + moves + " 手。再来一局？";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function playerPlace(r, c) {
    if (over || busy || turn !== "player") return;
    if (!place(r, c, 1)) { msgEl.textContent = "这一格子已被占用。"; return; }
    if (playerWins()) { endFor(true, "🎉 你竖向连通了！"); return; }
    turn = "ai"; render();
    busy = true; setTimeout(aiMove, 500);
  }

  function aiMove() {
    if (over) return;
    // 简单启发式：优先占中心、其次随机空格，尽量堵玩家
    const empties = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) empties.push([r, c]);
    if (!empties.length) { endFor(false, "平局"); return; }
    let chosen = empties[(Math.random() * empties.length) | 0];
    // 找能立即获胜的点
    for (const [r, c] of empties) {
      grid[r][c] = 2;
      if (aiWins()) { grid[r][c] = 0; chosen = [r, c]; break; }
      grid[r][c] = 0;
    }
    place(chosen[0], chosen[1], 2);
    if (aiWins()) { endFor(true, "🤖 AI 横向连成了！"); return; }
    turn = "player"; busy = false; render();
  }

  canvas.addEventListener("click", (e) => {
    if (over || busy) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bd = 1e9;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const { x, y } = center(r, c);
      const d = Math.hypot(x - mx, y - my);
      if (d < bd && d < HEX) { bd = d; best = [r, c]; }
    }
    if (best) playerPlace(best[0], best[1]);
  });

  againBtn.addEventListener("click", () => { reset(); start(); });
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); reset(); start(); } });

  function start() {
    reset();
    msgEl.textContent = "点击空白六边形下子。你连上下，AI 连左右。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render(); draw();
  }
  start();
})();
