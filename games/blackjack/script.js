/* ============================================================
   21 点 · 对庄家比点
   单人=单人 vs 庄家；双人=两位玩家轮流 vs 同一庄家
   ============================================================ */
(function () {
  "use strict";

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  const dealerCardsEl = document.getElementById("dealerCards");
  const dealerScoreEl = document.getElementById("dealerScore");
  const playersZone = document.getElementById("playersZone");
  const controls = document.getElementById("controls");
  const hitBtn = document.getElementById("hitBtn");
  const standBtn = document.getElementById("standBtn");
  const statusEl = document.getElementById("status");
  const msgEl = document.getElementById("msg");
  const newBtn = document.getElementById("newBtn");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");
  const modeBtns = Array.from(document.querySelectorAll(".mode-btn"));

  let mode = "ai";
  let deck = [];
  let dealer = [];
  let players = [];        // {name, hand:[], stand:false, bust:false}
  let seat = 0;            // 当前行动玩家下标
  let phase = "deal";      // deal | player | dealer | done
  let dealerRevealed = false;
  let aiModeTurn = false;  // 单人模式 flag

  /* ---------- 牌 ---------- */
  function buildDeck() {
    deck = [];
    SUITS.forEach((s) => RANKS.forEach((r) => deck.push({ rank: r, suit: s })));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  function deal() { return deck.pop(); }

  function value(card) {
    if (card.rank === "A") return 11;
    if (["K", "Q", "J"].includes(card.rank)) return 10;
    return parseInt(card.rank, 10);
  }
  function handValue(hand) {
    let v = 0, aces = 0;
    hand.forEach((c) => { v += value(c); if (c.rank === "A") aces++; });
    while (v > 21 && aces > 0) { v -= 10; aces--; }
    return v;
  }

  /* ---------- UI ---------- */
  function cardEl(card, hidden) {
    const el = document.createElement("div");
    el.className = "card-item" + (hidden ? " backface" : "") + (card && card.suit && (card.suit === "♥" || card.suit === "♦") ? " red" : "");
    if (hidden) el.textContent = "?";
    else el.innerHTML = "<span>" + card.rank + "</span><span style='font-size:16px'>" + card.suit + "</span>";
    return el;
  }
  function renderDealer() {
    dealerCardsEl.innerHTML = "";
    dealer.forEach((c, i) => {
      dealerCardsEl.appendChild(cardEl(c, !dealerRevealed && i === 0 && phase !== "done"));
    });
    dealerScoreEl.textContent = (dealerRevealed || phase === "done")
      ? "点数 " + handValue(dealer)
      : "点数 " + handValue([dealer[0]]);
  }
  function renderPlayers() {
    playersZone.innerHTML = "";
    players.forEach((p, i) => {
      const box = document.createElement("div");
      box.className = "player-box" + (phase === "player" && seat === i ? " active" : "") + (phase === "done" && !p.bust && !p.stand ? "" : "");
      const cards = document.createElement("div");
      cards.className = "cards";
      p.hand.forEach((c) => cards.appendChild(cardEl(c, false)));
      const info = document.createElement("div");
      info.className = "zone-score";
      info.textContent = p.name + "：" + handValue(p.hand) + (p.bust ? "（爆牌）" : p.stand ? "（停牌）" : "");
      if (p.result) info.textContent += " · " + p.result;
      box.appendChild(document.createElement("div")).className = "zone-title";
      box.firstChild.textContent = p.name + (phase === "player" && seat === i ? " 👉" : "");
      box.appendChild(cards);
      box.appendChild(info);
      playersZone.appendChild(box);
      if (p.result && p.result.startsWith("🎉")) box.classList.add("winner");
    });
  }
  function setStatus(t) {
    statusEl.textContent = t;
    statusEl.className = "hud-item" + (t.includes("轮到") ? " hot" : "");
  }

  /* ---------- 流程 ---------- */
  function newRound() {
    buildDeck();
    dealer = [];
    dealerRevealed = false;
    phase = "deal";
    seat = 0;
    dealer.push(deal(), deal());
    const n = mode === "ai" ? 1 : 2;
    players = [];
    for (let i = 0; i < n; i++) {
      players.push({ name: mode === "ai" ? (i === 0 ? "你" : "") : "玩家 " + (i + 1), hand: [deal(), deal()], stand: false, bust: false, result: "" });
    }
    if (mode === "ai") players[0].name = "你";
    endModal.classList.remove("show");
    msgEl.textContent = "";
    msgEl.className = "msg";
    // 进入玩家回合
    beginSeat();
    renderAll();
  }

  function beginSeat() {
    phase = "player";
    const p = players[seat];
    if (handValue(p.hand) === 21) {
      stand();
      return;
    }
    if (mode === "ai" && seat === 0) {
      controls.hidden = false;
      setStatus("你的回合：要牌还是停牌？");
    } else if (mode === "pvp") {
      controls.hidden = false;
      setStatus("轮到 " + p.name + "：" + (p.hand.length ? "要牌还是停牌？" : ""));
    }
    renderAll();
  }

  function hit() {
    const p = players[seat];
    if (phase !== "player") return;
    p.hand.push(deal());
    if (handValue(p.hand) > 21) {
      p.bust = true;
      showMsg("💥 " + p.name + " 爆牌了！", "bust");
      setTimeout(() => { next(); }, 700);
    } else {
      renderAll();
      if (handValue(p.hand) === 21) {
        setTimeout(() => { stand(); }, 500);
      }
    }
    renderAll();
  }

  function stand() {
    if (phase !== "player") return;
    players[seat].stand = true;
    next();
  }

  function next() {
    seat += 1;
    if (seat < players.length) {
      beginSeat();
      return;
    }
    // 所有玩家行动完毕 → 庄家
    dealerRevealed = true;
    phase = "dealer";
    setStatus("庄家行动…");
    controls.hidden = true;
    // 只要还有未爆牌的玩家，庄家补到 17
    const need = players.some((p) => !p.bust);
    let stop = false;
    const step = () => {
      if (need && handValue(dealer) < 17 && !stop) {
        dealer.push(deal());
        renderAll();
        setTimeout(step, 550);
      } else {
        stop = true;
        settle();
      }
    };
    setTimeout(step, 600);
  }

  function settle() {
    phase = "done";
    const dv = handValue(dealer);
    const dvText = dv > 21 ? "爆牌" : dv;
    players.forEach((p) => {
      if (p.bust) { p.result = "💥 爆牌"; return; }
      const pv = handValue(p.hand);
      if (dv > 21 || pv > dv) p.result = "🎉 赢！";
      else if (pv === dv) p.result = "🤝 平局";
      else p.result = "😔 输";
    });
    const wins = players.filter((p) => p.result.startsWith("🎉")).length;
    showMsg(
      wins
        ? "🎉 " + players.filter((p) => p.result.startsWith("🎉")).map((p) => p.name).join("、") + " 战胜庄家！"
        : "庄家点数 " + dvText + "，" + (dv > 21 ? "庄家爆牌，但你们也没能赢 😅" : "惜败于庄家"),
      wins ? "win" : ""
    );
    endTitle.textContent = "🃏 本局结束 · 庄家 " + dvText;
    endMsg.textContent = players.map((p) => p.name + " " + handValue(p.hand) + " 点 " + p.result).join(" ｜ ");
    renderAll();
    setTimeout(() => endModal.classList.add("show"), 700);
  }

  function renderAll() {
    renderDealer();
    renderPlayers();
  }

  function showMsg(t, cls) {
    msgEl.textContent = t;
    msgEl.className = "msg " + (cls || "");
  }

  /* ---------- 模式 ---------- */
  function setMode(m) {
    mode = m;
    modeBtns.forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    newRound();
  }

  /* ---------- 事件 ---------- */
  hitBtn.addEventListener("click", hit);
  standBtn.addEventListener("click", stand);
  newBtn.addEventListener("click", newRound);
  againBtn.addEventListener("click", newRound);
  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); newRound(); }
    if (e.key === "h" || e.key === "H") hit();
    if (e.key === "s" || e.key === "S") stand();
  });

  setMode("ai");
})();
