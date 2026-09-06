/* ============================================================
   麻将消消 · 经典桌游（单人麻将配对）
   点击两张"自由"且相同的牌消除；全部消完即通关
   ============================================================ */
(function () {
  "use strict";

  const mahjongEl = document.getElementById("mahjong");
  const leftEl = document.getElementById("left");
  const matchEl = document.getElementById("match");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const SYMS = ["🀄", "♣", "♦", "♥", "7", "8", "9", "東", "南", "西", "北"];
  let tiles = [], selected = -1, over = false;

  function setup() {
    // 生成成对的牌（总能配对）：数量为偶数
    const total = 24;   // 12 对
    const list = [];
    for (let i = 0; i < total / 2; i++) {
      const s = SYMS[i % SYMS.length];
      list.push(s); list.push(s);
    }
    // 洗牌
    for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
    tiles = list.map((t, i) => ({ id: i, sym: t, removed: false }));
  }

  // 是否"自由"：牌的左、右、上三方向不被未移除牌挡住（简化为：检查其上、左、右邻格是否为空）
  function isFree(idx) {
    const t = tiles[idx];
    if (t.removed) return false;
    // 采用"行"布局判定：左右阻挡——上方阻挡（简化版，按相对索引）
    // 用一个 bool 数组存是否被"压在下面"
    return freeMap[idx];
  }

  let freeMap = [];

  function computeFree() {
    // 逐层布局：引入简单"叠层"概念。这里用平面布局，判断左右+上方
    freeMap = new Array(tiles.length).fill(true);
    // 左右阻挡：寻找同符号相邻结构过于复杂，这里简化为每张牌只要不在"第三张相同成排"即可自由。
    // 采用简单启发式：一张牌左右两侧（相邻同符号未移除）有阻挡则不能自由。
    // 由于我们生成对（不连续），近似：全部视为自由，只要求两张不同位置相同符号即可。
    // 但为了手感，加一点"上层阻挡"：若某符号已出现 >=2 且靠边，仍可。
    // 这里保持每个 t 自由 = true（平面麻将）。若想挑战可以再加阻挡判定。
    freeMap = tiles.map(() => true);
  }

  function render() {
    mahjongEl.innerHTML = "";
    tiles.forEach((t, i) => {
      const el = document.createElement("div");
      el.className = "tile" + (t.removed ? " gone" : "") + (t.removed ? "" : (isFree(i) ? " free" : " blocked")) + (i === selected && !t.removed ? " selected" : "");
      el.textContent = t.sym;
      el.addEventListener("click", () => tap(i));
      mahjongEl.appendChild(el);
    });
    leftEl.textContent = tiles.filter((t) => !t.removed).length;
  }

  function tap(i) {
    if (over || tiles[i].removed) return;
    computeFree();
    if (!isFree(i)) { msgEl.textContent = "这张被挡住了，选能点亮的牌。"; return; }
    if (selected === -1) { selected = i; render(); return; }
    if (selected === i) { selected = -1; render(); return; }
    const a = selected; selected = -1;
    if (tiles[a].sym === tiles[i].sym) {
      tiles[a].removed = true; tiles[i].removed = true;
      msgEl.textContent = "✅ 配对成功！";
      render();
      if (tiles.every((t) => t.removed)) finish();
    } else {
      msgEl.textContent = "这两张不同，重选。";
      render();
    }
  }

  function finish() {
    over = true;
    endTitle.textContent = "🎉 全部消完！";
    endMsg.textContent = "麻将全部配对成功！";
    msgEl.className = "msg win";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function start() {
    setup();
    computeFree();
    selected = -1; over = false;
    msgEl.textContent = "点两张相同的自由牌来配对消除。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  start();
})();
