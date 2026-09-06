/* ============================================================
   尼姆博弈 · 棋牌对战（人机 取走最后一根算输）
   若干堆火柴，轮流取，每次取一堆中任意数量；取走最后一根者输
   ============================================================ */
(function () {
  "use strict";

  const wrap = document.getElementById("wrap");
  const turnEl = document.getElementById("turn");
  const lastEl = document.getElementById("last");
  const msgEl = document.getElementById("msg");
  const addBtn = document.getElementById("addBtn");
  const resetBtn = document.getElementById("resetBtn");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let piles = [], playerTurn = true, over = false;

  function makePiles() {
    piles = [3, 4, 5];
    playerTurn = true; over = false;
  }

  function render() {
    wrap.innerHTML = "";
    piles.forEach((count, i) => {
      const pile = document.createElement("div");
      pile.className = "pile";
      const label = document.createElement("span");
      label.className = "pile-label";
      label.textContent = (i + 1) + " 堆";
      const box = document.createElement("div");
      box.className = "matches";
      for (let k = 0; k < count; k++) {
        const m = document.createElement("div");
        m.className = "match";
        m.dataset.pile = i; m.dataset.idx = k;
        if (!playerTurn || over) m.classList.add("taken");
        if (playerTurn && !over) m.addEventListener("click", () => takeFrom(i, count - k));
        box.appendChild(m);
      }
      pile.append(label, box);
      wrap.appendChild(pile);
    });
    turnEl.textContent = playerTurn ? "你" : "AI";
    turnEl.style.color = playerTurn ? "var(--accent-2)" : "var(--danger)";
  }

  function totalMatches() { return piles.reduce((a, b) => a + b, 0); }

  function takeFrom(pileIndex, take) {
    if (over || !playerTurn) return;
    const pileCount = piles[pileIndex];
    if (pileCount <= 0 || take < 1 || take > pileCount) return;
    piles[pileIndex] -= take;
    lastEl.textContent = "你从 " + (pileIndex + 1) + " 堆取了 " + take;
    msgEl.textContent = "";
    if (totalMatches() === 0) { finish(true); return; }   // 你取了最后一根 → AI 赢
    playerTurn = false;
    render();
    setTimeout(aiTurn, 500);
  }

  // AI：misère Nim 最优 + 偶尔失误
  function aiTurn() {
    if (over) return;
    const move = aiBestMove();
    const pileCount = piles[move.pile];
    piles[move.pile] -= move.take;
    lastEl.textContent = "AI 从 " + (move.pile + 1) + " 堆取了 " + move.take;
    msgEl.textContent = "";
    if (totalMatches() === 0) { finish(false); return; }   // AI 取了最后一根 → 你赢
    playerTurn = true;
    render();
  }

  const xorOf = (arr) => arr.reduce((a, b) => a ^ b, 0);

  function aiBestMove() {
    if (totalMatches() <= 1) { const p = piles.findIndex((x) => x > 0); return { pile: p, take: piles[p] }; }
    // 非空堆全为 1（misère 关键局面）
    const nonEmpty = piles.filter((x) => x > 0);
    const allOnes = nonEmpty.every((x) => x === 1);
    if (allOnes) {
      // 奇数根：AI（先手）必败 → 只能取 1；偶数根：AI 取 1 留奇数根给玩家
      return { pile: piles.findIndex((x) => x === 1), take: 1 };
    }
    // misère Nim：一般局面按"压到 xor=0"走，但若那样会把局面变成"全 ≤1"，则改为留下奇数个 1
    const xor = xorOf(piles);
    let best = null;
    for (let i = 0; i < piles.length; i++) {
      const target = piles[i] ^ xor;
      if (target < piles[i]) {
        const take = piles[i] - target;
        if (!best || take >= best.take) best = { pile: i, take };
      }
    }
    if (best) {
      // 模拟走的这步是否会留下"全 ≤1"的局面
      const leaves = piles.slice(); leaves[best.pile] -= best.take;
      const left = leaves.filter((x) => x > 0);
      const allSmallOnes = left.length && left.every((x) => x === 1);
      if (allSmallOnes && left.length % 2 === 0) {
        // 会留下偶数个 1（对 AI 不利）→ 改成从某个堆取 1，留奇数个 1
        // 找一堆 >1 的（必存在，因为非全 1 且 xor 非零时），从中取到剩 1
        const bigIdx = piles.findIndex((x) => x > 1);
        if (bigIdx >= 0) return { pile: bigIdx, take: piles[bigIdx] - 1 };
      }
      // 65% 走最优，35% 随机失误
      if (Math.random() < 0.65) return best;
    }
    // 随机合法一步
    const pos = piles.map((x, i) => ({ i, x })).filter((p) => p.x > 0);
    const pick = pos[(Math.random() * pos.length) | 0];
    const take = 1 + ((Math.random() * pick.x) | 0);
    return { pile: pick.i, take };
  }

  function finish(aiWon) {
    over = true;
    msgEl.textContent = "";
    endTitle.textContent = aiWon ? "🤖 AI 赢了！" : "🎉 你赢了！";
    endMsg.textContent = aiWon ? "你被迫取走了最后一根，输给 AI。" : "AI 取走了最后一根，你赢了！再试一次？";
    msgEl.className = "msg " + (aiWon ? "win" : "lose");
    setTimeout(() => endModal.classList.add("show"), 400);
    // 清掉场上残留
    playerTurn = false;
    render();
  }

  function start() {
    makePiles();
    msgEl.textContent = "点击一堆里的火柴来取。取走最后一根的人输。";
    msgEl.className = "msg";
    lastEl.textContent = "—";
    endModal.classList.remove("show");
    render();
  }

  addBtn.addEventListener("click", () => {
    if (over) start();
    piles.push(2 + ((Math.random() * 4) | 0));
    render();
  });
  resetBtn.addEventListener("click", start);
  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });

  start();
})();
