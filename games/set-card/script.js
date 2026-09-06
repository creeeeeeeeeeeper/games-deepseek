/* ============================================================
   找集合 Set · 经典益智（单人）
   找出三张卡（数量/颜色/形状/填充 各自全同或全异）；找满全部集合过关
   ============================================================ */
(function () {
  "use strict";

  const cardsEl = document.getElementById("cards");
  const foundEl = document.getElementById("found");
  const countEl = document.getElementById("count");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  // 属性取值
  const SHAPES = ["oval", "diamond", "wave"];
  const COLORS = ["#d94b3a", "#2f9e4f", "#3a6bd9"];
  const FILLS = ["solid", "outline", "hatch"];
  const COUNT = [1, 2, 3];

  let cards = [], selected = [], foundCount = 0, allSets = [], over = false;

  function makeCard() {
    return {
      count: COUNT[(Math.random() * 3) | 0],
      color: COLORS[(Math.random() * 3) | 0],
      shape: SHAPES[(Math.random() * 3) | 0],
      fill: FILLS[(Math.random() * 3) | 0],
    };
  }

  // 三张卡是否为集合
  function isSet(a, b, c) {
    const attrs = ["count", "color", "shape", "fill"];
    for (const at of attrs) {
      const vals = [a[at], b[at], c[at]];
      const same = vals.every((v) => v === vals[0]);
      const allDiff = new Set(vals).size === 3;
      if (!same && !allDiff) return false;
    }
    return true;
  }

  function keyOf(card) { return card.count + "|" + card.color + "|" + card.shape + "|" + card.fill; }

  function findAllSets() {
    const res = [];
    for (let i = 0; i < cards.length; i++)
      for (let j = i + 1; j < cards.length; j++)
        for (let k = j + 1; k < cards.length; k++)
          if (isSet(cards[i], cards[j], cards[k])) res.push([i, j, k]);
    return res;
  }

  // 是否还存在由"未找到"的卡组成的集合；不存在即通关
  function noRemainingSet() {
    const open = cards.map((c, i) => (!c.found ? i : -1)).filter((i) => i >= 0);
    for (let x = 0; x < open.length; x++)
      for (let y = x + 1; y < open.length; y++)
        for (let z = y + 1; z < open.length; z++)
          if (isSet(cards[open[x]], cards[open[y]], cards[open[z]])) return false;
    return true;
  }

  function setup() {
    // 随机生成 12 张卡，保证至少有一个集合
    do {
      cards = [];
      const seen = new Set();
      while (cards.length < 12) {
        const c = makeCard();
        const k = keyOf(c);
        if (!seen.has(k)) { seen.add(k); cards.push(c); }
      }
      allSets = findAllSets();
    } while (allSets.length === 0);
    selected = []; foundCount = 0;
  }

  function render() {
    cardsEl.innerHTML = "";
    cards.forEach((c, i) => {
      const el = document.createElement("div");
      el.className = "scard" + (selected.includes(i) ? " selected" : "");
      if (c.found) el.classList.add("found");
      el.addEventListener("click", () => select(i));
      el.appendChild(shapeEl(c));
      cardsEl.appendChild(el);
    });
    foundEl.textContent = foundCount;
    countEl.textContent = cards.length;
  }

  function shapeEl(c) {
    const w = document.createElement("div");
    w.className = "shape-wrap";
    for (let n = 0; n < c.count; n++) {
      w.appendChild(oneShape(c.shape, c.color, c.fill));
    }
    return w;
  }

  function oneShape(shape, color, fill) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("width", "26"); s.setAttribute("height", "18");
    s.setAttribute("viewBox", "0 0 26 18");
    let d;
    if (shape === "oval") d = "M3,9 a10,8 0 1 0 20,0 a10,8 0 1 0 -20,0";
    else if (shape === "diamond") d = "M13,1 L25,9 L13,17 L1,9 Z";
    else d = "M2,9 Q6,1 13,9 Q20,17 24,9";   // 波浪
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    if (fill === "solid") {
      p.setAttribute("fill", color); p.setAttribute("stroke", color); p.setAttribute("stroke-width", "1.5");
    } else if (fill === "outline") {
      p.setAttribute("fill", "none"); p.setAttribute("stroke", color); p.setAttribute("stroke-width", "2");
    } else { // hatch
      p.setAttribute("fill", color); p.setAttribute("fill-opacity", "0.25"); p.setAttribute("stroke", color); p.setAttribute("stroke-width", "1.5");
    }
    s.appendChild(p);
    return s;
  }

  function select(i) {
    if (over || cards[i].found) return;
    if (selected.includes(i)) { selected = selected.filter((x) => x !== i); render(); return; }
    if (selected.length >= 3) return;
    selected.push(i);
    if (selected.length === 3) {
      const [a, b, c] = selected.map((x) => cards[x]);
      if (isSet(a, b, c)) {
        cards[selected[0]].found = true;
        cards[selected[1]].found = true;
        cards[selected[2]].found = true;
        foundCount++;
        msgEl.textContent = "✅ 找到一组成对！";
        selected = [];
        render();
        if (noRemainingSet()) finish();
      } else {
        msgEl.textContent = "❌ 这三张不成集合，重试。";
        selected = [];
        render();
      }
      return;
    }
    render();
  }

  function finish() {
    over = true;
    endTitle.textContent = "🎉 全部找齐！";
    endMsg.textContent = "共找到 " + foundCount + " 组集合。";
    msgEl.className = "msg win";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function start() {
    setup();
    over = false;
    msgEl.textContent = "选出三张卡组成集合。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  start();
})();
