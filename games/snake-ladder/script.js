/* ============================================================
   蛇梯棋 · 10×10（1~100）
   双人=同屏；单人=对战 AI（AI 自动掷骰）
   梯子/蛇映射；恰好 100 才获胜
   ============================================================ */
(function () {
  "use strict";

  const N = 100;
  const LADDERS = { 3: 22, 8: 30, 20: 38, 28: 84, 36: 44, 51: 67, 63: 81, 71: 91 };
  const SNAKES = { 97: 42, 95: 75, 88: 24, 62: 19, 49: 11, 46: 25, 26: 6, 16: 2 };

  const boardEl = document.getElementById("board");
  const p1El = document.getElementById("p1");
  const p2El = document.getElementById("p2");
  const posEls = [document.getElementById("pos0"), document.getElementById("pos1")];
  const turnEl = document.getElementById("turn");
  const diceEl = document.getElementById("dice");
  const rollBtn = document.getElementById("rollBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");
  const modeBtns = Array.from(document.querySelectorAll(".mode-btn"));

  let mode = "pvp";
  let pos = [0, 0];
  let turn = 0;
  let rolling = false;
  let over = false;
  let tokens = [];
  let aiTimer = null;

  function coordOf(n) {
    const idx = n - 1;
    const row = Math.floor(idx / 10);       // 0 为最底行
    const col = row % 2 === 0 ? idx % 10 : 9 - (idx % 10);
    return { x: (col + 0.5) * 10, y: (9 - row + 0.5) * 10 }; // 百分比
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    for (let n = 100; n >= 1; n--) { // 从顶行（100）开始排 DOM
      const cell = document.createElement("div");
      cell.className = "cell";
      const inSnake = SNAKES[n];
      const inLadder = Object.keys(LADDERS).map(Number).includes(n);
      if (n === 1) cell.classList.add("start");
      if (n === 100) cell.classList.add("end");
      if (inSnake) cell.classList.add("snake");
      if (inLadder) cell.classList.add("ladder");
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = n;
      cell.appendChild(num);
      if (inSnake) {
        const g = document.createElement("span");
        g.className = "glyph";
        g.textContent = "🐍";
        cell.appendChild(g);
      }
      if (inLadder) {
        const g = document.createElement("span");
        g.className = "glyph";
        g.textContent = "🪜";
        cell.appendChild(g);
      }
      boardEl.appendChild(cell);
    }
    // 棋子层
    const tk = document.createElement("div");
    tk.className = "tokens";
    tokens = [0, 1].map((i) => {
      const t = document.createElement("div");
      t.className = "token p" + i;
      tk.appendChild(t);
      return t;
    });
    boardEl.appendChild(tk);
    placeTokens(false);
  }

  function placeTokens(animate) {
    [0, 1].forEach((i) => {
      const t = tokens[i];
      const c = coordOf(Math.max(pos[i], 1));
      if (animate) t.classList.add("jump");
      t.style.left = c.x + "%";
      t.style.top = c.y + "%";
      setTimeout(() => t.classList.remove("jump"), 650);
    });
  }

  function label() {
    return mode === "pvp" ? "玩家 1" : "你";
  }
  function label2() {
    return mode === "pvp" ? "玩家 2" : "AI";
  }
  function syncUi() {
    p1El.innerHTML = label() + ' <span class="pos" id="pos0">' + (pos[0] === 0 ? "起点" : pos[0]) + "</span>";
    p2El.innerHTML = label2() + ' <span class="pos" id="pos1">' + (pos[1] === 0 ? "起点" : pos[1]) + "</span>";
    posEls[0] = p1El.querySelector(".pos");
    posEls[1] = p2El.querySelector(".pos");
    const nm = turn === 0 ? label() : label2();
    turnEl.textContent = nm + " 的回合";
    p1El.classList.toggle("hot", turn === 0 && !over);
    p2El.classList.toggle("hot", turn === 1 && !over);
  }

  function showMsg(t, cls) {
    msgEl.textContent = t;
    msgEl.className = "msg " + (cls || "");
  }

  function roll() {
    if (over || rolling) return;
    if (mode === "ai" && turn === 1) return;
    rolling = true;
    rollBtn.disabled = true;
    // 骰子滚动动画
    const d = 1 + ((Math.random() * 6) | 0);
    let ticks = 0;
    diceEl.classList.remove("roll");
    void diceEl.offsetWidth;
    diceEl.classList.add("roll");
    const t = setInterval(() => {
      diceEl.textContent = "🎲" + (1 + ((Math.random() * 6) | 0));
      ticks += 1;
      if (ticks >= 7) {
        clearInterval(t);
        diceEl.textContent = "🎲 " + d;
        movePiece(d);
      }
    }, 70);
  }

  function movePiece(d) {
    const who = turn;
    let nxt = Math.min(100, pos[who] + d);
    let msg = labelOf(who) + " 掷出 " + d + "，前进到 " + nxt;
    let cls = "";
    const dest = applyBoard(nxt);
    if (dest > nxt) { msg += " → 🪜 爬上 " + dest + "！"; cls = "hot"; }
    else if (dest < nxt) { msg += " → 🐍 滑到 " + dest + "…"; cls = "snake"; }
    nxt = dest;
    pos[who] = nxt;
    showMsg(msg, cls);
    placeTokens(true);
    syncUi();
    setTimeout(() => {
      if (pos[who] === 100) { win(who); return; }
      rolling = false;
      turn = 1 - turn;
      syncUi();
      rollBtn.disabled = false;
      if (mode === "ai" && turn === 1) {
        aiTimer = setTimeout(() => roll(), 900);
      }
    }, 720);
  }

  function applyBoard(n) {
    while (LADDERS[n] || SNAKES[n]) {
      if (LADDERS[n]) n = LADDERS[n];
      else if (SNAKES[n]) n = SNAKES[n];
    }
    return n;
  }

  function labelOf(w) {
    return w === 0 ? label() : label2();
  }

  function win(who) {
    over = true;
    rolling = true;
    rollBtn.disabled = true;
    const nm = labelOf(who);
    showMsg("🏆 " + nm + " 到达 100，获胜！", "hot");
    endTitle.textContent = "🎉 " + nm + " 赢了！";
    endMsg.textContent = "掷骰子登顶成功！按「再来一局」重新开局";
    setTimeout(() => endModal.classList.add("show"), 800);
  }

  function newGame() {
    clearTimeout(aiTimer);
    pos = [0, 0];
    turn = 0;
    rolling = false;
    over = false;
    endModal.classList.remove("show");
    showMsg(mode === "pvp" ? "玩家 1 先掷骰子" : "你先掷骰子！", "");
    buildBoard();
    syncUi();
    rollBtn.disabled = false;
  }

  function setMode(m) {
    mode = m;
    modeBtns.forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    newGame();
  }

  rollBtn.addEventListener("click", roll);
  againBtn.addEventListener("click", newGame);
  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); newGame(); }
    if (e.key === " ") { e.preventDefault(); roll(); }
  });

  buildBoard();
  syncUi();
  setMode("pvp");
})();
