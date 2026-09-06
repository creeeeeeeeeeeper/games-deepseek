/* ============================================================
   种花 · 休闲娱乐（单人种植经营）
   种花→浇水→成熟→收获；买种换金币；目标攒金币 & 种满
   ============================================================ */
(function () {
  "use strict";

  const gardenEl = document.getElementById("garden");
  const coinsEl = document.getElementById("coins");
  const ripeEl = document.getElementById("ripe");
  const seedBtn = document.getElementById("seedBtn");
  const waterBtn = document.getElementById("waterBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const ROWS = 4, COLS = 5, SEED_COST = 10;
  const STAGES = ["🌱", "🌿", "🌸", "🌻"];   // 种子→芽→花→成熟
  let tiles = [], coins = 20, selected = -1, over = false;

  function makeTiles() {
    tiles = Array.from({ length: ROWS * COLS }, () => ({ stage: 0, grown: false }));
  }
  const idx = (r, c) => r * COLS + c;

  function render() {
    ripeEl.textContent = tiles.filter((t) => t.grown).length;
    gardenEl.innerHTML = "";
    tiles.forEach((t, i) => {
      const el = document.createElement("div");
      el.className = "tile" + (selected === i ? " sel" : "") + (t.grown ? " ripe" : "");
      el.textContent = t.stage > 0 ? STAGES[Math.min(t.stage - 1, STAGES.length - 1)] : "";
      el.addEventListener("click", () => tap(i));
      gardenEl.appendChild(el);
    });
  }

  function tap(i) {
    if (over) return;
    const t = tiles[i];
    if (t.stage === 0) { selected = i; render(); return; }
    if (t.grown) { harvest(i); return; }
    selected = i; render();
  }

  function seed(i) {
    if (over || tiles[i].stage > 0) return;
    if (coins < SEED_COST) { msgEl.textContent = "金币不够，先收获几株。"; return; }
    coins -= SEED_COST;
    tiles[i].stage = 1;
    selected = i;
    msgEl.textContent = "种下一株花，浇水让它成长。";
    render();
  }

  function water(i) {
    if (over) return;
    const t = tiles[i];
    if (t.stage === 0 || t.grown) return;
    t.stage++;
    if (t.stage >= STAGES.length) { t.grown = true; }
    msgEl.textContent = t.grown ? "成熟啦！点它收获。" : "花长大了一点。";
    render();
  }

  function harvest(i) {
    if (over) return;
    const t = tiles[i];
    if (!t.grown) return;
    coins += 20;
    selected = -1;
    // 先判断是否全部成熟，再清空当前格
    const allRipe = tiles.every((x) => x.grown);
    msgEl.textContent = "收获 +20 金币！";
    t.stage = 0; t.grown = false;
    if (allRipe) { finish(); return; }
    render();
  }

  function finish() {
    over = true;
    endTitle.textContent = "🌼 花园全都熟了！";
    endMsg.textContent = "你攒到 " + coins + " 金币。";
    msgEl.className = "msg win";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function start() {
    makeTiles();
    coins = 20; selected = -1; over = false;
    msgEl.textContent = "点空格种花，点已有花浇水，成熟收获。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  seedBtn.addEventListener("click", () => { if (selected >= 0) seed(selected); else msgEl.textContent = "先点一块空地再买种子。"; });
  waterBtn.addEventListener("click", () => { if (selected >= 0) water(selected); else msgEl.textContent = "先点一株花再浇水。"; });
  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  start();
})();
