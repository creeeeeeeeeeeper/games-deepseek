/* ============================================================
   灭灯 · 经典益智（单人）
   5×5 灯阵，点击会翻转十字五格；全灭即过关
   ============================================================ */
(function () {
  "use strict";

  const gridEl = document.getElementById("grid");
  const movesEl = document.getElementById("moves");
  const litEl = document.getElementById("lit");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const N = 5;
  let grid = [], moves = 0, over = false;

  function makeGrid() {
    // 全灭，然后随机翻转若干次生成有解的乱局
    grid = Array.from({ length: N }, () => Array(N).fill(0));
    const presses = 6 + ((Math.random() * 8) | 0);
    for (let k = 0; k < presses; k++) {
      toggle((Math.random() * N) | 0, (Math.random() * N) | 0);
    }
  }

  function toggle(r, c) {
    for (const [dr, dc] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) grid[nr][nc] ^= 1;
    }
  }

  function litCount() {
    let n = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) n += grid[r][c];
    return n;
  }

  function render() {
    gridEl.innerHTML = "";
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement("div");
        cell.className = "cell " + (grid[r][c] ? "on" : "off");
        cell.addEventListener("click", () => tap(r, c));
        gridEl.appendChild(cell);
      }
    }
    movesEl.textContent = moves;
    litEl.textContent = litCount();
  }

  function tap(r, c) {
    if (over) return;
    toggle(r, c);
    moves++;
    render();
    if (litCount() === 0) finish();
  }

  function finish() {
    over = true;
    endTitle.textContent = "🎉 灭灯成功！";
    endMsg.textContent = "用了 " + moves + " 步。";
    msgEl.className = "msg win";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function start() {
    makeGrid();
    moves = 0; over = false;
    msgEl.textContent = "点格子翻转十字形灯，让全部熄灭。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  start();
})();
