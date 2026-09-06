/* ============================================================
   寻宝探险 · 翻格寻宝（类扫雷推理）
   8×8：3 颗 💎 宝石、7 颗 💣 地雷；数字=相邻地雷数
   挖到宝石+分；踩雷扣命；集齐 3 颗宝石通关
   ============================================================ */
(function () {
  "use strict";

  const N = 8;
  const GEM_TOTAL = 3;
  const BOMB_TOTAL = 7;

  const boardEl = document.getElementById("board");
  const gemsEl = document.getElementById("gems");
  const livesEl = document.getElementById("lives");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const newBtn = document.getElementById("newBtn");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let best = 0;
  try { best = parseInt(localStorage.getItem("treasure-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let grid = [];         // {kind:'gem'|'bomb'|'plain', adj:number}
  let openCount = 0;
  let gems = 0;
  let lives = 3;
  let score = 0;
  let done = false;

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function setLives() { livesEl.textContent = "❤".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives)); }

  function neighborsOf(i) {
    const r = (i / N) | 0, c = i % N;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
      }
    }
    return out;
  }

  function generate() {
    grid = [];
    for (let i = 0; i < N * N; i++) grid.push({ kind: "plain", adj: 0 });
    // 放置地雷
    const bombs = new Set();
    while (bombs.size < BOMB_TOTAL) bombs.add((Math.random() * N * N) | 0);
    // 宝石避开地雷
    const gemSet = new Set();
    let guard = 0;
    while (gemSet.size < GEM_TOTAL && guard++ < 500) {
      const i = (Math.random() * N * N) | 0;
      if (!bombs.has(i) && !gemSet.has(i)) gemSet.add(i);
    }
    bombs.forEach((i) => { grid[i].kind = "bomb"; });
    gemSet.forEach((i) => { grid[i].kind = "gem"; });
    // 相邻地雷数
    for (let i = 0; i < N * N; i++) {
      if (grid[i].kind === "bomb") continue;
      let n = 0;
      neighborsOf(i).forEach((j) => { if (grid[j].kind === "bomb") n++; });
      grid[i].adj = n;
    }
  }

  function open(i) {
    if (done || openTileSet.has(i)) return;
    openTileSet.add(i);
    const cell = grid[i];
    if (cell.kind === "bomb") {
      // 扣命
      lives -= 1;
      setLives();
      boardEl.classList.remove("bad"); void boardEl.offsetWidth;
      boardEl.classList.add("bad");
      showTile(i, true);
      if (lives <= 0) gameOver();
      return;
    }
    showTile(i, true);
    if (cell.kind === "gem") {
      gems += 1;
      gemsEl.textContent = gems + "/" + GEM_TOTAL;
      score += 50;
      scoreEl.textContent = score;
      bump(scoreEl);
      if (score > best) bestEl.textContent = score;
      if (gems >= GEM_TOTAL) win();
      return;
    }
    // 普通：分数与数字
    score += 5;
    scoreEl.textContent = score;
    bump(scoreEl);
    if (score > best) bestEl.textContent = score;
    // 若数字为 0，泛洪展开相邻 plain
    if (cell.adj === 0) {
      neighborsOf(i).forEach((j) => {
        if (grid[j].kind !== "bomb" && !openTileSet.has(j)) open(j);
      });
    }
  }

  const openTileSet = new Set();

  function showTile(i, isOpen) {
    const el = tiles[i];
    const cell = grid[i];
    el.classList.add("open");
    if (cell.kind === "bomb") {
      el.classList.add("bomb");
      el.textContent = "💣";
    } else if (cell.kind === "gem") {
      el.classList.add("gem");
      el.textContent = "💎";
    } else {
      el.classList.add("plain");
      el.textContent = cell.adj > 0 ? cell.adj : "·";
      if (cell.adj > 0) el.classList.add("num-" + cell.adj);
    }
    el.setAttribute("aria-label", "已翻开");
  }

  let tiles = [];

  function renderBoard() {
    boardEl.innerHTML = "";
    tiles = [];
    openTileSet.clear();
    for (let i = 0; i < N * N; i++) {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "tile";
      t.dataset.i = i;
      t.addEventListener("click", () => open(i));
      boardEl.appendChild(t);
      tiles.push(t);
    }
  }

  function newGame() {
    done = false;
    openCount = 0;
    gems = 0;
    lives = 3;
    score = 0;
    gemsEl.textContent = "0/" + GEM_TOTAL;
    scoreEl.textContent = 0;
    setLives();
    msgEl.textContent = "";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    generate();
    renderBoard();
  }

  function win() {
    done = true;
    const isNew = score > best;
    if (isNew) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem("treasure-best", String(best)); } catch (_) {}
    }
    msgEl.textContent = "🎉 集齐 3 颗宝石！";
    msgEl.className = "msg win";
    endTitle.textContent = "🎉 满载而归！";
    endMsg.innerHTML = "得分 <b>" + score + "</b> · 剩余生命 " + "❤".repeat(lives) +
      (isNew ? "<br>🏆 新纪录！" : "<br>最高分 " + best);
    setTimeout(() => endModal.classList.add("show"), 600);
  }

  function gameOver() {
    done = true;
    const isNew = score > best;
    if (isNew) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem("treasure-best", String(best)); } catch (_) {}
    }
    msgEl.textContent = "💥 生命耗尽…";
    msgEl.className = "msg";
    endTitle.textContent = "💥 探险失败";
    endMsg.innerHTML = "找到 " + gems + " / " + GEM_TOTAL + " 颗宝石 · 得分 <b>" + score + "</b>" +
      (isNew ? "<br>🏆 新纪录！" : "<br>最高分 " + best);
    setTimeout(() => endModal.classList.add("show"), 600);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); newGame(); }
  });
  newBtn.addEventListener("click", newGame);
  againBtn.addEventListener("click", newGame);

  newGame();
})();
