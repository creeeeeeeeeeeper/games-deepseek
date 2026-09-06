/* ============================================================
   时钟接龙 · 经典桌游（单人）
   抽中央牌放对应钟点堆；连续翻到第4张 K 失败，翻完 52 张成功
   ============================================================ */
(function () {
  "use strict";

  const clockEl = document.getElementById("clock");
  const revealedEl = document.getElementById("revealed");
  const leftEl = document.getElementById("left");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const VAL = { A: 1, J: 11, Q: 12, K: 13, "10": 10 };

  // 13 堆：索引 0-12 对应钟点 1-12 和 中央(13)
  let piles, revealed, over, current = 12, kCount = 0;

  function build() {
    const deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ s, r });
    for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
    piles = [];
    // 每堆 4 张：12 个钟点堆 + 1 个中央堆
    for (let p = 0; p < 13; p++) piles.push(deck.slice(p * 4, p * 4 + 4));
    revealed = 0; over = false; kCount = 0;
  }

  function rankIndex(card) { return card ? VAL[card.r] : 0; }
  function valOf(card) { return card ? VAL[card.r] : 0; }
  const labelOf = (i) => (i < 12 ? String(i + 1) : "中央");

  function render() {
    clockEl.innerHTML = "";
    for (let i = 0; i < 13; i++) {
      const pile = piles[i];
      const top = pile[pile.length - 1];
      const el = document.createElement("div");
      el.className = "pile" + (pile.length ? " has" : "") + (i === 12 ? " center" : "") + (top && top.r === "K" ? "" : "");
      if (pile.length) {
        el.innerHTML = '<span class="card-inner"><span class="rank">' + top.r + '</span><span class="suit">' + top.s + "</span></span>";
      } else {
        el.textContent = "";
      }
      const lab = document.createElement("span");
      lab.className = "label";
      lab.textContent = labelOf(i);
      el.appendChild(lab);
      el.addEventListener("click", () => clickPile(i));
      clockEl.appendChild(el);
    }
    revealedEl.textContent = revealed;
    leftEl.textContent = piles.reduce((s, p) => s + p.length, 0);
  }

  // 翻牌：从当前堆取出一张，放到对应钟点堆
  function drawFrom(idx) {
    const pile = piles[idx];
    if (!pile.length) return null;
    const card = pile.pop();
    revealed++;
    if (card.r === "K") kCount++;
    // 放到对应钟点堆（K→13 即中央）
    const target = valOf(card) - 1;   // 0-12
    piles[target].unshift(card);
    current = target;
    return card;
  }

  function clickPile(idx) {
    if (over) return;
    // 只能翻"当前指示堆"
    if (idx !== current) return;
    const card = drawFrom(current);
    if (!card) {
      // 当前堆空了，找一张含牌堆继续（简化为从中央/第一堆）
      const next = piles.findIndex((p) => p.length > 0);
      if (next < 0) { finish(false); return; }
      current = next; msgEl.textContent = "这堆空了，换到 " + labelOf(current) + " 堆。";
      render(); return;
    }
    render();
    // 判定
    if (kCount >= 4) { finish(false); return; }
    if (revealed >= 52) { finish(true); return; }
  }

  function finish(win) {
    over = true;
    endTitle.textContent = win ? "🎉 成功！" : "💀 翻出第4张 K！";
    endMsg.textContent = win ? "翻完了全部 " + revealed + " 张牌。" : "翻到 " + revealed + " 张时，第 4 张 K 出现。";
    msgEl.className = "msg " + (win ? "win" : "lose");
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function start() {
    build();
    msgEl.textContent = "点击中央/当前指示堆翻牌。K 出现第4张则失败。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    current = 12;
    render();
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  start();
})();
