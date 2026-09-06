/* ============================================================
   海战棋 · 10×10 双舰队
   单人=对战 AI（自动布阵 + 猎杀算法）
   双人=传屏轮流（PvP 回合提示）
   视口：右侧始终显示"当前操作者"的己方舰队，左侧为敌方海域
   ============================================================ */
(function () {
  "use strict";

  const N = 10;
  const SHIP_LENS = [5, 4, 3, 3, 2];
  const enemyGrid = document.getElementById("enemyGrid");
  const myGrid = document.getElementById("myGrid");
  const statusEl = document.getElementById("status");
  const sunk0El = document.getElementById("sunk0");
  const sunk1El = document.getElementById("sunk1");
  const labelAtk = document.getElementById("labelAtk");
  const labelDef = document.getElementById("labelDef");
  const titleEnemy = document.getElementById("titleEnemy");
  const titleMine = document.getElementById("titleMine");
  const msgEl = document.getElementById("msg");
  const newBtn = document.getElementById("newBtn");
  const passModal = document.getElementById("passModal");
  const passTitle = document.getElementById("passTitle");
  const passBtn = document.getElementById("passBtn");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");
  const modeBtns = Array.from(document.querySelectorAll(".mode-btn"));

  let mode = "ai";
  let fleets = [];
  let seat = 0;          // 当前操作者（AI 模式固定 0）
  let busy = false;
  let over = false;
  let aiQ = [];

  // 视口：右侧显示的操作者舰队下标 & 左侧敌方舰队下标
  function viewIdx() { return mode === "ai" ? 0 : seat; }
  function enemyIdx() { return 1 - viewIdx(); }

  function actorName(s) {
    if (mode === "ai") return s === 0 ? "你" : "AI";
    return "玩家 " + (s + 1);
  }

  /* ---------- 舰队 ---------- */
  function makeFleet() {
    const grid = new Array(N * N).fill(0);
    const ships = SHIP_LENS.map((len, id) => ({ id, len, cells: [], hits: 0, sunk: false }));
    if (!placeRandom(grid, ships)) placeSequential(grid, ships);
    return { grid, ships, shots: new Array(N * N).fill(false) };
  }
  function canPlace(grid, cells) {
    return cells.every((i) => i >= 0 && i < N * N && grid[i] === 0);
  }
  function placeRandom(grid, ships) {
    for (const ship of ships) {
      let placed = false;
      for (let t = 0; t < 500 && !placed; t++) {
        const horiz = Math.random() < 0.5;
        const r = (Math.random() * N) | 0;
        const c = (Math.random() * N) | 0;
        const cells = [];
        let ok = true;
        for (let k = 0; k < ship.len; k++) {
          const rr = horiz ? r : r + k;
          const cc = horiz ? c + k : c;
          if (rr >= N || cc >= N) { ok = false; break; }
          cells.push(rr * N + cc);
        }
        if (ok && canPlace(grid, cells)) {
          ship.cells = cells;
          cells.forEach((i) => (grid[i] = ship.id + 1));
          placed = true;
        }
      }
      if (!placed) return false;
    }
    return true;
  }
  function placeSequential(grid, ships) {
    for (const ship of ships) {
      let done = false;
      for (let r = 0; r < N && !done; r++) {
        for (let c = 0; c < N && !done; c++) {
          const cells = [];
          for (let k = 0; k < ship.len && c + k < N; k++) cells.push(r * N + c + k);
          if (cells.length === ship.len && canPlace(grid, cells)) {
            ship.cells = cells;
            cells.forEach((i) => (grid[i] = ship.id + 1));
            done = true;
          }
        }
      }
    }
  }
  function sunkCount(f) { return f.ships.filter((s) => s.sunk).length; }
  function allSunk(f) { return f.ships.every((s) => s.sunk); }

  /* ---------- 渲染 ---------- */
  function renderGrid(gridEl, fleet, showShips, clickable) {
    gridEl.innerHTML = "";
    for (let i = 0; i < N * N; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const v = fleet.grid[i];
      const ship = v > 0 ? fleet.ships[v - 1] : null;
      const shot = fleet.shots[i];
      if (shot) {
        cell.classList.add("shot");
        if (ship) cell.classList.add("hit");
        else cell.classList.add("miss");
        if (ship && ship.sunk) cell.classList.add("sunkcell");
      } else if (showShips && ship) {
        cell.classList.add("ship");
        if (ship.sunk) cell.classList.add("sunkcell");
      }
      if (clickable) {
        cell.classList.add("cand");
        cell.addEventListener("click", () => onEnemyClick(i));
      }
      gridEl.appendChild(cell);
    }
  }

  function refresh() {
    renderGrid(enemyGrid, fleets[enemyIdx()], false, true);
    renderGrid(myGrid, fleets[viewIdx()], true, false);
    const me = actorName(viewIdx());
    labelAtk.textContent = me;
    labelDef.textContent = actorName(enemyIdx());
    sunk0El.textContent = sunkCount(fleets[enemyIdx()]);   // 击沉敌舰
    sunk1El.textContent = sunkCount(fleets[viewIdx()]);    // 我方被击沉
    titleEnemy.textContent = "敌方海域（点击开炮）";
    titleMine.textContent = me + " 的我方海域";
    titleEnemy.classList.toggle("now", !busy && !over);
  }
  function setStatus(t) {
    statusEl.textContent = t;
    statusEl.classList.toggle("fight", t.includes("攻击") || t.includes("思考"));
  }
  function showMsg(t, cls) {
    msgEl.textContent = t;
    msgEl.className = "msg" + (cls ? " " + cls : "");
  }

  /* ---------- 开火 ---------- */
  // 返回 0=重复 1=未中 2=命中 3=击沉
  function fire(fleet, idx) {
    if (fleet.shots[idx]) return 0;
    fleet.shots[idx] = true;
    const v = fleet.grid[idx];
    if (v > 0) {
      const ship = fleet.ships[v - 1];
      ship.hits += 1;
      if (ship.hits >= ship.len) { ship.sunk = true; return 3; }
      return 2;
    }
    return 1;
  }

  function onEnemyClick(idx) {
    if (busy || over) return;
    if (mode === "ai" && seat !== 0) return;
    const shooter = viewIdx();
    const def = fleets[enemyIdx()];
    const res = fire(def, idx);
    if (res === 0) return;
    busy = true;
    refresh();
    if (res === 3) showMsg("💥 击沉一艘敌舰！", "sunk");
    else if (res === 2) showMsg("💥 命中！", "sunk");
    else showMsg("✕ 未命中", "");
    setTimeout(() => {
      if (allSunk(def)) { finish(shooter); return; }
      if (mode === "ai") {
        setTimeout(() => aiShoot(), 600);
      } else {
        seat = 1 - seat;
        busy = false;
        passTitle.textContent = "请把设备交给 " + actorName(seat);
        passModal.classList.add("show");
        refresh();
      }
    }, 430);
  }

  /* ---------- AI（守卫并猎杀玩家舰队） ---------- */
  function aiShoot() {
    if (over || mode !== "ai") return;
    busy = true;
    setStatus("AI 思考中…");
    setTimeout(() => {
      const def = fleets[0];            // AI 攻击玩家舰队
      let idx;
      while (aiQ.length) {
        const i = aiQ.shift();
        if (!def.shots[i]) { idx = i; break; }
      }
      if (idx === undefined) {
        const untried = [];
        for (let i = 0; i < N * N; i++) if (!def.shots[i]) untried.push(i);
        idx = untried[(Math.random() * untried.length) | 0];
      }
      const res = fire(def, idx);
      refresh();
      if (res === 3) showMsg("💥 AI 击沉了你的战舰！", "sunk");
      else if (res === 2) {
        showMsg("💥 AI 命中了你！", "sunk");
        const r = (idx / N) | 0, c = idx % N;
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < N && cc >= 0 && cc < N && !def.shots[rr * N + cc]) aiQ.push(rr * N + cc);
        });
      } else showMsg("AI 未命中", "");
      setTimeout(() => {
        if (allSunk(def)) { finish(1); return; }
        busy = false;
        refresh();
        setStatus("你的回合：点击敌方海域开炮");
      }, 460);
    }, 700);
  }

  /* ---------- 对局控制 ---------- */
  function newGame() {
    fleets = [makeFleet(), makeFleet()];
    seat = 0;
    aiQ = [];
    busy = false;
    over = false;
    passModal.classList.remove("show");
    endModal.classList.remove("show");
    showMsg("舰队已部署！点击敌方海域开炮", "");
    refresh();
    setStatus(mode === "ai" ? "你的回合：点击敌方海域开炮" : "玩家 1 攻击：点击敌方海域");
  }

  function finish(winner) {
    over = true;
    busy = false;
    endTitle.textContent = winner === 0 ? "🏆 胜利！" : "💥 舰队覆没…";
    endMsg.textContent = actorName(winner) + " 率先击沉对方全部舰队！";
    showMsg("🎉 " + actorName(winner) + " 获胜！", "win");
    setTimeout(() => endModal.classList.add("show"), 450);
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

  /* ---------- 事件 ---------- */
  newBtn.addEventListener("click", newGame);
  againBtn.addEventListener("click", newGame);
  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  passBtn.addEventListener("click", () => {
    passModal.classList.remove("show");
    busy = false;
    refresh();
    setStatus(actorName(seat) + " 攻击：点击敌方海域");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); newGame(); }
  });

  setMode("ai");
})();
