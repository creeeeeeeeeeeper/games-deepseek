/* ============================================================
   纸牌战争 · 桌游
   翻一张比大小；平局连翻两张再比（战争通吃）；先到 10 分
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 300;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const youEl = document.getElementById("you");
  const hsEl = document.getElementById("hs");
  const aiEl = document.getElementById("ai");
  const flipBtn = document.getElementById("flipBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const VALUES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = ["♠", "♥", "♦", "♣"];
  const TARGET = 10;

  let you = 0, ai = 0, roundYou = 0, roundAi = 0, war = 0;
  let state = "flip";        // flip | reveal | tie | over
  let youCard = null, aiCard = null, tieCard = null, revealLabel = "";
  let lastMs = 0;

  function rndCard() { return { v: 1 + ((Math.random() * 13) | 0), s: SUITS[(Math.random() * 4) | 0] }; }

  function flip() {
    if (state === "over") return;
    youCard = rndCard();
    aiCard = rndCard();
    state = "reveal";
  }

  function resolve() {
    // 战争：若平局，双方各加一张比较（简化：再各翻一张比总点数）
    let yv = youCard.v, av = aiCard.v, extraY = 0, extraA = 0, isWar = false;
    if (yv === av) {
      isWar = true;
      tieCard = rndCard();      // 第三张展示用
      extraY = rndCard().v;
      extraA = rndCard().v;
      yv += extraY; av += extraA;
    }
    let msg;
    if (yv > av) { roundYou++; msg = isWar ? "⚔️ 战争！你 " + youCard.v + "+" + extraY + " > AI " + aiCard.v + "+" + extraA + "，你通吃！" : "🎉 " + youCard.v + " > " + aiCard.v + "，你拿下这一分！"; msgEl.className = "msg win"; }
    else if (av > yv) { roundAi++; msg = isWar ? "⚔️ 战争！AI 通吃…" : "💪 " + aiCard.v + " > " + youCard.v + "，AI 拿下。"; msgEl.className = "msg"; }
    else { msg = "🤝 又平了，每人再翻一张定胜负！"; msgEl.className = "msg"; }

    // 达到目标分
    if (roundYou >= TARGET) { you++; roundYou = 0; roundAi = 0; war = 0; }
    if (roundAi >= TARGET) { ai++; roundYou = 0; roundAi = 0; war = 0; }

    youEl.textContent = you; aiEl.textContent = ai;
    hsEl.textContent = "你 " + roundYou + " : " + roundAi + " AI";
    msgEl.textContent = msg;

    if (you >= 3 || ai >= 3) { state = "over"; end(); return; }
    // 平局持续则继续翻（保持 reveal 等待下一次点击），否则回到 flip
    if (yv === av) { state = "tie"; youCard = rndCard(); aiCard = rndCard(); return; }
    state = "flip";
  }

  function end() {
    const win = you > ai;
    endTitle.textContent = win ? "🏆 你赢了！" : "🤖 AI 赢了…";
    endMsg.textContent = "大比分 " + you + " : " + ai;
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function drawCard(x, y, card, faceDown) {
    const w = 84, h = 116;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#f7f3ea";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 10); else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.strokeStyle = "#bdb29b"; ctx.lineWidth = 2; ctx.stroke();
    if (faceDown) {
      ctx.fillStyle = "#2a5fb8";
      ctx.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
      ctx.fillStyle = "#fff"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🂠", 0, 10);
      ctx.restore();
      return;
    }
    const red = card.s === "♥" || card.s === "♦";
    ctx.fillStyle = red ? "#d92b2b" : "#1a1a1a";
    ctx.font = "bold 20px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(VALUES[card.v], -w / 2 + 8, -h / 2 + 24);
    ctx.font = "20px sans-serif";
    ctx.fillText(card.s, -w / 2 + 8, -h / 2 + 46);
    ctx.textAlign = "center";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText(card.s, 0, 14);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#20233a"); g.addColorStop(1, "#0d0f1c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#9adcff"; ctx.fillText("你", W / 4, 24);
    ctx.fillStyle = "#ff8a97"; ctx.fillText("AI", W * 0.75, 24);

    if (youCard) drawCard(W / 4, 150, youCard, false);
    if (aiCard) drawCard(W * 0.75, 150, aiCard, false);
    if (tieCard && state === "tie") {
      ctx.fillStyle = "#ece0c8"; ctx.font = "13px sans-serif";
      ctx.fillText("⚔️ 战争！再翻定胜负", W / 2, 34);
    }
  }

  function frame(ts) {
    lastMs = ts;   // 无需 dt
    draw();
    requestAnimationFrame(frame);
  }

  flipBtn.addEventListener("click", () => {
    if (state === "over") return;
    flip();
    resolve();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " ") flipBtn.click();
  });
  againBtn.addEventListener("click", start);

  function start() {
    you = 0; ai = 0; roundYou = 0; roundAi = 0; war = 0;
    youCard = null; aiCard = null; tieCard = null;
    state = "flip";
    youEl.textContent = 0; aiEl.textContent = 0; hsEl.textContent = "你 0 : 0 AI";
    msgEl.textContent = ""; msgEl.className = "msg";
    endModal.classList.remove("show");
  }

  start();
  requestAnimationFrame(frame);
})();
