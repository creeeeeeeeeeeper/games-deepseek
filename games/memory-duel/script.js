/* ============================================================
   记忆对战 · 棋牌对战（人机）
   6×3 卡面，轮流翻两张；配对得分并继续，配错换人
   ============================================================ */
(function () {
  "use strict";

  const cardsEl = document.getElementById("cards");
  const youEl = document.getElementById("you");
  const aiEl = document.getElementById("ai");
  const turnEl = document.getElementById("turn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const COLS = 6, ROWS = 3, TOTAL = COLS * ROWS;
  const EMOJIS = ["🍎", "🍌", "🍇", "🍓", "🍒", "🍑", "🥝", "🍍", "🍅"];

  let deck = [], flipped = [], matchedCount, scoreY, scoreA, turn, over, busy, lock;
  let openCount = 0, first = null;

  function build() {
    const emojis = [];
    for (let i = 0; i < TOTAL / 2; i++) { emojis.push(EMOJIS[i % EMOJIS.length]); emojis.push(EMOJIS[i % EMOJIS.length]); }
    for (let i = emojis.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [emojis[i], emojis[j]] = [emojis[j], emojis[i]]; }
    deck = emojis.map((e, i) => ({ emoji: e, open: false, matched: false, id: i }));
  }

  function render() {
    cardsEl.innerHTML = "";
    deck.forEach((c) => {
      const el = document.createElement("div");
      el.className = "mcard" + (c.open ? " open" : "") + (c.matched ? " matched" : "");
      el.innerHTML = '<div class="inner"><div class="face back">❓</div><div class="face front">' + c.emoji + "</div></div>";
      el.addEventListener("click", () => flip(c));
      cardsEl.appendChild(el);
    });
    youEl.textContent = scoreY;
    aiEl.textContent = scoreA;
    turnEl.textContent = turn === "player" ? "你" : "AI";
    turnEl.style.color = turn === "player" ? "var(--accent-2)" : "var(--danger)";
  }

  function flip(c) {
    if (over || busy || lock || turn !== "player") return;
    if (c.open || c.matched) return;
    c.open = true;
    render();
    if (!first) { first = c; return; }
    // 第二张
    lock = true;
    const second = first; first = null;
    setTimeout(() => {
      if (second.emoji === c.emoji) {
        second.matched = true; c.matched = true; second.open = true; c.open = true;
        scoreY++; render();
        msgEl.textContent = "✅ 配对成功，继续翻。";
        lock = false;
        if (deck.every((x) => x.matched)) { finish(); }
      } else {
        setTimeout(() => {
          second.open = false; c.open = false;
          render();
          turn = "ai"; lock = false; render();
          if (!over) { busy = true; setTimeout(aiTurn, 600); }
        }, 700);
      }
    }, 300);
  }

  function aiTurn() {
    if (over) return;
    // AI 记忆：找已开放的已知配对
    const openCards = deck.filter((x) => x.open && !x.matched);
    // 简单：随机翻两张（加一点点记忆：针对公开牌）
    let a, b;
    const unknown = deck.filter((x) => !x.open && !x.matched);
    if (unknown.length < 2) { // 只剩一对
      finish(); return;
    }
    a = unknown[(Math.random() * unknown.length) | 0];
    a.open = true; render();
    setTimeout(() => {
      const rest = unknown.filter((x) => x !== a);   // 排除已翻开的 a，避免"自己配自己"
      if (!rest.length) { a.open = false; render(); turn = "player"; busy = false; render(); return; }
      b = rest[(Math.random() * rest.length) | 0];
      b.open = true; render();
      setTimeout(() => {
        if (a.emoji === b.emoji) {
          a.matched = true; b.matched = true; scoreA++; render();
          msgEl.textContent = "AI 配对成功，继续翻。";
          if (deck.every((x) => x.matched)) { busy = false; finish(); return; }
          setTimeout(aiTurn, 500);
        } else {
          setTimeout(() => {
            a.open = false; b.open = false; render();
            turn = "player"; busy = false; render();
          }, 700);
        }
      }, 200);
    }, 200);
  }

  function finish() {
    over = true; busy = false;
    endTitle.textContent = scoreY > scoreA ? "🎉 你赢了！" : (scoreY < scoreA ? "🤖 AI 赢" : "🤝 平局");
    endMsg.textContent = "你 " + scoreY + " 对 · AI " + scoreA + " 对";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function start() {
    build();
    scoreY = 0; scoreA = 0; turn = "player"; over = false; busy = false; lock = false; first = null;
    msgEl.textContent = "点击两张卡翻牌，配对得分。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  start();
})();
