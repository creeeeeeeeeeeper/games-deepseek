/* ============================================================
   抽乌龟 · 棋牌对战（人机）
   去掉一张"乌龟"牌；玩家/ AI 轮流抽对方一张，凑对打出，最后剩乌龟者输
   ============================================================ */
(function () {
  "use strict";

  const myHandEl = document.getElementById("myHand");
  const aiHandEl = document.getElementById("aiHand");
  const myCountEl = document.getElementById("myCount");
  const aiCountEl = document.getElementById("aiCount");
  const turnEl = document.getElementById("turn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let myHand = [], aiHand = [], turn = "player", over = false, busy = false;

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function makeDeck() {
    const deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ s, r });
    // 加一张"乌龟"
    deck.push({ s: "🐢", r: "T" });
    return deck;
  }
  function shuffle(d) { for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } return d; }
  const key = (c) => (c.r === "T" ? "TISTORT" : c.r);

  function deal() {
    const deck = shuffle(makeDeck());   // 53 张（52 + 乌龟）
    myHand = []; aiHand = [];
    for (let i = 0; i < deck.length; i++) (i % 2 === 0 ? myHand : aiHand).push(deck[i]);
    turn = "player"; over = false; busy = false;
    discardPairsFrom(myHand);
    discardPairsFrom(aiHand);
  }

  function discardPairsFrom(hand) {
    // 用计数而非边遍历边 splice，免得漏掉被跳过的元素
    const counts = new Map();
    for (const c of hand) counts.set(key(c), (counts.get(key(c)) || 0) + 1);
    // 保留：出现奇数次的牌（每只留一个）；成对的（剩 2 张）全部移除
    const kept = hand.filter((c) => (counts.get(key(c)) % 2) === 1);
    hand.length = 0;
    hand.push(...kept);
  }

  function render() {
    myHandEl.innerHTML = "";
    myHand.forEach((c, i) => {
      const el = makeCard(c, true);
      el.addEventListener("click", () => onPlayerDraw(i));
      myHandEl.appendChild(el);
    });
    aiHandEl.innerHTML = "";
    aiHand.forEach(() => {
      const el = makeCardBack();
      aiHandEl.appendChild(el);
    });
    myCountEl.textContent = myHand.length;
    aiCountEl.textContent = aiHand.length;
    turnEl.textContent = turn === "player" ? "你" : "AI";
    turnEl.style.color = turn === "player" ? "var(--accent-2)" : "var(--danger)";
  }

  function makeCard(c, faceup) {
    const el = document.createElement("div");
    el.className = "card " + (faceup ? "faceup" : "back");
    if (faceup) { el.innerHTML = '<span class="rank">' + c.r + '</span><span class="suit">' + c.s + "</span>"; }
    return el;
  }
  function makeCardBack() { return makeCard(null, false); }

  // 玩家从 AI 手中抽第 idx 张
  function onPlayerDraw(idx) {
    if (over || busy || turn !== "player") return;
    if (idx < 0 || idx >= aiHand.length) return;
    busy = true;
    const picked = aiHand.splice(idx, 1)[0];
    myHand.push(picked);
    msgEl.textContent = "你抽到 " + picked.s + picked.r + "。";
    matchAndDiscard(myHand);
    if (checkEnd()) return;
    turn = "ai"; busy = false;
    render();
    setTimeout(aiTurn, 650);
  }

  function matchAndDiscard(hand) {
    // 找配对个数
    const counts = new Map();
    for (const c of hand) { const k = key(c); counts.set(k, (counts.get(k) || 0) + 1); }
    for (const [k, n] of counts) {
      if (n >= 2 && k !== "TISTORT") {
        while (n >= 2) {
          const a = hand.findIndex((c) => key(c) === k);
          const b = hand.findIndex((c, i) => i !== a && key(c) === k);
          hand.splice(Math.max(a, b), 1); hand.splice(Math.min(a, b), 1);
          n -= 2;
        }
      }
    }
  }

  // AI 从玩家手中抽一张
  function aiTurn() {
    if (over || turn !== "ai") return;
    busy = true;
    if (myHand.length === 0) { checkEnd(); return; }
    const idx = (Math.random() * myHand.length) | 0;
    const picked = myHand.splice(idx, 1)[0];
    aiHand.push(picked);
    msgEl.textContent = "AI 抽了你一张。";
    matchAndDiscard(aiHand);
    if (checkEnd()) return;
    turn = "player"; busy = false;
    render();
  }

  function checkEnd() {
    // 当配对大部消除、全场仅剩乌龟一张时，持龟者输
    const total = myHand.length + aiHand.length;
    if (total === 1) {
      const myT = myHand.length === 1 && key(myHand[0]) === "TISTORT";
      finish(myT ? "ai" : "player");
      return true;
    }
    // 保护：若一人清空（0 张），另一人若只剩乌龟则输，否则继续
    if (myHand.length === 0 || aiHand.length === 0) return false;
    return false;
  }

  function finish(winner) {
    over = true; busy = false;
    endTitle.textContent = winner === "player" ? "🎉 你赢了！" : "🐢 乌龟落你手里了！";
    endMsg.textContent = winner === "player" ? "乌龟被 AI 抽走了，它替你把乌龟收下。" : "你手里最后剩下乌龟，这局是你输啦。";
    msgEl.className = "msg " + (winner === "player" ? "win" : "lose");
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function start() {
    deal();
    msgEl.textContent = "点击 AI 手牌中的一张来抽。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });

  start();
})();
