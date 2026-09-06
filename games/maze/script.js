/* ============================================================
   迷宫 · 随机生成 + 走出迷宫
   递归回溯生成；WASD/方向键/点按移动；解法高亮；最快纪录
   ============================================================ */
(function () {
  "use strict";

  const COLS = 15, ROWS = 15;
  const SZ = 600 / COLS;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const stepsEl = document.getElementById("steps");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const showBtn = document.getElementById("showBtn");
  const newBtn = document.getElementById("newBtn");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let bestSec = null;
  try {
    const v = parseFloat(localStorage.getItem("maze-best"));
    if (v > 0) bestSec = v;
  } catch (_) {}
  bestEl.textContent = bestSec === null ? "--" : fmt(bestSec);

  // 迷宫数据：wallRight[r][c] / wallDown[r][c]
  let wallR = [], wallD = [];
  let player = { r: 0, c: 0 };
  let goal = { r: ROWS - 1, c: COLS - 1 };
  let px = 0, py = 0;         // 像素中心
  let moving = false;
  let pathMove = null;        // {fr, fc, tr, tc, t}
  let steps = 0;
  let startAt = 0;
  let done = false;
  let showPath = false;
  let pathCells = [];
  let pulse = 0;
  let lastMs = 0;
  let timerId = null;

  function fmt(sec) {
    sec = Math.floor(sec);
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }
  function centerOf(r, c) { return { x: c * SZ + SZ / 2, y: r * SZ + SZ / 2 }; }

  /* ---------- 迷宫生成（递归回溯） ---------- */
  function generate() {
    wallR = [];
    wallD = [];
    for (let r = 0; r < ROWS; r++) {
      wallR.push(new Array(COLS - 1).fill(true));
      wallD.push(new Array(COLS).fill(true));
    }
    const visited = [];
    for (let r = 0; r < ROWS; r++) visited.push(new Array(COLS).fill(false));
    const stack = [[0, 0]];
    visited[0][0] = true;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const opts = [];
      dirs.forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc]) opts.push([nr, nc, dr, dc]);
      });
      if (!opts.length) { stack.pop(); continue; }
      const [nr, nc, dr, dc] = opts[(Math.random() * opts.length) | 0];
      // 打通墙壁
      if (dr === -1) wallD[nr][c] = false;        // 上方来 → 去掉 (nr,c) 的下墙
      else if (dr === 1) wallD[r][c] = false;      // 下方去 → 去掉 (r,c) 的下墙
      else if (dc === -1) wallR[nr][nc] = false;   // 左方来 → 去掉左墙(即 (nr,nc-? )) 见下
      else wallR[r][Math.min(c, nc)] = false;
      // dc===-1: 从 (r,c) 向左到 (r,nc=c-1)，墙在 (r,nc) 的右侧 → wallR[r][nc]
      visited[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }

  function canMove(r, c, dr, dc) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
    if (dr === -1) return !wallD[nr][c];
    if (dr === 1) return !wallD[r][c];
    if (dc === -1) return !wallR[r][nc];
    return !wallR[r][c]; // dc===1
  }

  /* ---------- BFS 解法 ---------- */
  function solve() {
    const prev = [];
    for (let r = 0; r < ROWS; r++) prev.push(new Array(COLS).fill(null));
    const q = [[0, 0]];
    prev[0][0] = [-1, -1];
    while (q.length) {
      const [r, c] = q.shift();
      if (r === goal.r && c === goal.c) break;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
        if (!canMove(r, c, dr, dc)) return;
        const nr = r + dr, nc = c + dc;
        if (prev[nr][nc]) return;
        prev[nr][nc] = [r, c];
        q.push([nr, nc]);
      });
    }
    const cells = [];
    let cur = [goal.r, goal.c];
    while (cur && (cur[0] !== 0 || cur[1] !== 0)) {
      cells.push(cur);
      cur = prev[cur[0]][cur[1]];
      if (!cur) break;
    }
    cells.push([0, 0]);
    cells.reverse();
    return cells;
  }

  /* ---------- 移动 ---------- */
  function tryMove(dr, dc) {
    if (done || moving) return;
    if (!canMove(player.r, player.c, dr, dc)) {
      pulse = 1;
      return;
    }
    const fr = player.r, fc = player.c;
    player.r += dr;
    player.c += dc;
    steps += 1;
    stepsEl.textContent = steps;
    pathMove = { fr, fc, tr: player.r, tc: player.c, t: 0 };
    moving = true;
    if (player.r === goal.r && player.c === goal.c) win();
  }

  /* ---------- 对局 ---------- */
  function newMaze() {
    generate();
    player = { r: 0, c: 0 };
    const p0 = centerOf(0, 0);
    px = p0.x; py = p0.y;
    moving = false;
    pathMove = null;
    steps = 0;
    done = false;
    showPath = false;
    showBtn.textContent = "查看解法";
    pathCells = [];
    stepsEl.textContent = 0;
    msgEl.textContent = "";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    clearInterval(timerId);
    startAt = Date.now();
    timerId = setInterval(() => { if (!done) timeEl.textContent = fmt((Date.now() - startAt) / 1000); }, 200);
  }

  function win() {
    done = true;
    const secs = (Date.now() - startAt) / 1000;
    const isBest = bestSec === null || secs < bestSec;
    if (isBest) {
      bestSec = secs;
      try { localStorage.setItem("maze-best", String(bestSec)); } catch (_) {}
      bestEl.textContent = fmt(bestSec);
    }
    msgEl.textContent = "🏁 到达终点！用时 " + fmt(secs) + "，共 " + steps + " 步";
    msgEl.className = "msg win";
    endTitle.textContent = "🏁 走出迷宫！";
    endMsg.innerHTML = "用时 <b>" + fmt(secs) + "</b> · 步数 " + steps +
      (isBest ? "<br>🏆 新的最快纪录！" : "<br>最快纪录 " + fmt(bestSec));
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function togglePath() {
    if (done) return;
    showPath = !showPath;
    showBtn.textContent = showPath ? "隐藏解法" : "查看解法";
    pathCells = showPath ? solve() : [];
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, 600, 600);
    // 背景
    ctx.fillStyle = "#101a2c";
    ctx.fillRect(0, 0, 600, 600);
    // 终点
    const g = centerOf(goal.r, goal.c);
    ctx.font = (SZ * 0.6) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🏁", g.x, g.y + 2);

    // 迷宫线
    ctx.strokeStyle = "#cfe0ff";
    ctx.lineWidth = 3;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * SZ, y = r * SZ;
        if (r === 0) { line(x, y, x + SZ, y); }
        else if (wallD[r - 1][c]) { line(x, y, x + SZ, y); }
        if (c === 0) { line(x, y, x, y + SZ); }
        else if (wallR[r][c - 1]) { line(x, y, x, y + SZ); }
        if (r === ROWS - 1) { line(x, y + SZ, x + SZ, y + SZ); }
        if (c === COLS - 1) { line(x, y + SZ, x, y + SZ); }
      }
    }
    function line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // 解法路径
    if (pathCells.length) {
      ctx.strokeStyle = "rgba(52,211,153,0.7)";
      ctx.lineWidth = SZ * 0.32;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      pathCells.forEach(([r, c], i) => {
        const p = centerOf(r, c);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    // 玩家（平滑移动）
    if (pathMove && !done) {
      pathMove.t += 1 / 8;
      if (pathMove.t >= 1) {
        pathMove = null;
        moving = false;
      } else {
        const a = centerOf(pathMove.fr, pathMove.fc);
        const b = centerOf(pathMove.tr, pathMove.tc);
        px = a.x + (b.x - a.x) * pathMove.t;
        py = a.y + (b.y - a.y) * pathMove.t;
      }
    } else if (!pathMove) {
      const p = centerOf(player.r, player.c);
      px = p.x; py = p.y;
    }
    // 撞墙脉冲
    if (pulse > 0) {
      pulse -= 0.06;
      ctx.fillStyle = "rgba(255,93,108," + (pulse * 0.4) + ")";
      ctx.beginPath();
      ctx.arc(px, py, SZ * 0.4 + pulse * 8, 0, 7);
      ctx.fill();
    }
    // 玩家身体
    ctx.fillStyle = "#3aa0ff";
    ctx.beginPath();
    ctx.arc(px, py, SZ * 0.34, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(px - 4, py - 3, SZ * 0.09, 0, 7);
    ctx.arc(px + 4, py - 3, SZ * 0.09, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#14223a";
    ctx.beginPath();
    ctx.arc(px - 4, py - 3, SZ * 0.05, 0, 7);
    ctx.arc(px + 4, py - 3, SZ * 0.05, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(px - 6, py + 6);
    ctx.lineTo(px + 6, py + 6);
    ctx.lineTo(px, py + 12);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- 主循环 ---------- */
  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- 输入 ---------- */
  function keyDir(e) {
    const k = e.key;
    if (k === "ArrowUp" || k === "w" || k === "W") return [-1, 0];
    if (k === "ArrowDown" || k === "s" || k === "S") return [1, 0];
    if (k === "ArrowLeft" || k === "a" || k === "A") return [0, -1];
    if (k === "ArrowRight" || k === "d" || k === "D") return [0, 1];
    return null;
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); newMaze(); return; }
    const d = keyDir(e);
    if (d) { e.preventDefault(); tryMove(d[0], d[1]); }
  });
  cv.addEventListener("click", (e) => {
    const rect = cv.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 600;
    const my = ((e.clientY - rect.top) / rect.height) * 600;
    const c = Math.floor(mx / SZ), r = Math.floor(my / SZ);
    const dr = r - player.r, dc = c - player.c;
    if (Math.abs(dr) + Math.abs(dc) === 1) tryMove(Math.sign(dr), Math.sign(dc));
  });
  showBtn.addEventListener("click", togglePath);
  newBtn.addEventListener("click", newMaze);
  againBtn.addEventListener("click", newMaze);

  newMaze();
  requestAnimationFrame(frame);
})();
