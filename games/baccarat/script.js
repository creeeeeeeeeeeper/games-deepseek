/* ============================================================
   百家乐 · 棋牌对战（单人押注）
   押你/庄/平，发牌比点数个位，押中赔筹码
   ============================================================ */
(function () {
  "use strict";

  const tableEl = document.getElementById("table");
  const chipsEl = document.getElementById("chips");
  const resultEl = document.getElementById("result");
  const betPlayerEl = document.getElementById("betPlayer");
  const betBankerEl = document.getElementById("betBanker");
  const betTieEl = document.getElementById("betTie");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const BET = 10;
  let chips = 100, over = false, busy = false;

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const VAL = { A: 1, J: 0, Q: 0, K: 0, "10": 0 };

  function drawCard() {
    return { s: SUITS[(Math.random() * 4) | 0], r: RANKS[(Math.random() * 13) | 0] };
  }
  function val(c) { return VAL[c.r] !== undefined ? VAL[c.r] : parseInt(c.r, 10); }
  function handTotal(hand) { return hand.reduce((s, c) => s + val(c), 0) % 10; }

  function renderHand(cls, title, hand) {
    const side = document.createElement("div");
    side.className = "side";
    const h = document.createElement("h3"); h.textContent = title;
    const cards = document.createElement("div"); cards.className = "cards";
    for (const c of hand) {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = '<span class="rank">' + c.r + '</span><span class="suit">' + c.s + "</span>";
      cards.appendChild(el);
    }
    const total = document.createElement("div");
    total.className = "total";
    total.innerHTML = "点数 <span class='points'>" + handTotal(hand) + "</span>";
    side.append(h, cards, total);
    return side;
  }

  function placeBet(pick) {
    if (over || busy) return;
    if (chips < BET) { msgEl.textContent = "筹码不足 10。"; return; }
    busy = true;
    chips -= BET;
    chipsEl.textContent = chips;

    const playerHand = [drawCard(), drawCard()];
    const bankerHand = [drawCard(), drawCard()];
    const pv = handTotal(playerHand), bv = handTotal(bankerHand);

    tableEl.innerHTML = "";
    tableEl.appendChild(renderHand("player", "你", playerHand));
    tableEl.appendChild(renderHand("banker", "庄家", bankerHand));

    const result = pv > bv ? "player" : (bv > pv ? "banker" : "tie");
    let payout = 0;
    if (result === "player" && pick === "player") payout = BET * 2;
    else if (result === "banker" && pick === "banker") payout = BET * 2 - Math.ceil(BET * 0.05);  // 庄家抽水
    else if (result === "tie" && pick === "tie") payout = BET * 9;
    if (payout > 0) { chips += payout; msgEl.textContent = "命中！返还 " + payout + " 筹码。"; msgEl.className = "msg win"; }
    else { msgEl.textContent = "这局是" + { player: "你", banker: "庄家", tie: "平局" }[result] + "赢，你输了。"; msgEl.className = "msg lose"; }
    resultEl.textContent = { player: "你胜", banker: "庄胜", tie: "平局" }[result];
    chipsEl.textContent = chips;

    if (chips <= 0) { setTimeout(() => { over = true; endTitle.textContent = "💸 筹码输光了"; endMsg.textContent = "运气不佳，再来一次。"; endModal.classList.add("show"); }, 500); }
    else busy = false;
  }

  function start() {
    chips = 100; over = false; busy = false;
    tableEl.innerHTML = "";
    chipsEl.textContent = chips; resultEl.textContent = "—";
    msgEl.textContent = "选择一个下注对象，然后自动发牌比点。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
  }

  betPlayerEl.addEventListener("click", () => placeBet("player"));
  betBankerEl.addEventListener("click", () => placeBet("banker"));
  betTieEl.addEventListener("click", () => placeBet("tie"));
  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });

  start();
})();
