/* ============================================================
   猪骰子 · 桌游（对 AI）
   轮流掷骰；掷出 1 本回合清零并换人；先到 100 分获胜
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 200;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const youEl = document.getElementById("you");
  const aiEl = document.getElementById("ai");
  const turnEl = document.getElementById("turn");
  const turnScoreEl = document.getElementById("turnScore");
  const rollBtn = document.getElementById("rollBtn");
  const bankBtn = document.getElementById("bankBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const GOAL = 100;
  let you = 0, ai = 0, turnScore = 0, turn = "you", die = 6;
  let state = "ready";    // ready | play | over
  function msg(t, cls) { msgEl.textContent = t; msgEl.className = "msg" + (cls ? " " + cls : ""); }

  function whose() { return turn; }
  function startTurn() {    turnScore = 0;
    turnScoreEl.textContent = 0;
    turnEl.textContent = turn === "you" ? "你" : "AI";
    refresh();
    if (turn === "ai") setTimeout(aiTurn, 700);
  }

  function roll() {
    if (state !== "play" || turn !== "you") return;
    die = 1 + ((Math.random() * 6) | 0);
    if (die === 1) {
      turnScore = 0;
      msg("💥 掷出 1！本回合归零，换 AI。", "bust");
      pass();
      return;
    }
    turnScore += die;
    turnScoreEl.textContent = turnScore;
    msg("🎲 " + die + " 点！要结算还是继续？", "");
  }

  function bank() {
    if (state !== "play" || turn !== "you") return;
    you += turnScore;
    youEl.textContent = you; bump(youEl);
    msg("💰 你结算了 +" + turnScore + "，共 " + you + "。", "");
    if (you >= GOAL) { end(true); return; }
    pass();
  }

  function pass() {
    turn = turn === "you" ? "ai" : "you";
    startTurn();
  }

  function aiTurn() {
    if (state !== "play" || turn !== "ai") return;
    die = 1 + ((Math.random() * 6) | 0);
    if (die === 1) {
      turnScore = 0;
      turnScoreEl.textContent = 0;
      msg("🤖 AI 掷出 1，清零，轮到你了。", "bust");
      pass();
      return;
    }
    turnScore += die;
    turnScoreEl.textContent = turnScore;
    if (turnScore >= 20 || ai + turnScore >= GOAL) {
      ai += turnScore;
      aiEl.textContent = ai;
      msg("🤖 AI 结算 +" + turnScore + "，共 " + ai + "。", "");
      if (ai >= GOAL) { end(false); return; }
      pass();
    } else {
      msg("🤖 AI 掷出 " + die + "（本回合 " + turnScore + "），继续…", "");
      setTimeout(aiTurn, 600);
    }
  }

  function refresh() {
    rollBtn.disabled = turn !== "you" || state !== "play";
    bankBtn.disabled = turn !== "you" || state !== "play" || turnScore === 0;
  }

  function end(win) {
    state = "over";
    endTitle.textContent = win ? "🏆 你赢了！" : "🤖 AI 赢了…";
    endMsg.textContent = "最终 " + you + " : " + ai;
    msg("");
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#20233a"); g.addColorStop(1, "#0d0f1c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 骰子
    const s = 70, x = W / 2, y = H / 2;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - s / 2, y - s / 2, s, s, 12); else ctx.rect(x - s / 2, y - s / 2, s, s);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
    const p = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    const on = { 1: [0], 2: [1, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4] }[die];
    ctx.fillStyle = "#2a2f3a";
    for (const idx of on) { const [px, py] = p[idx]; ctx.beginPath(); ctx.arc(x + (px - 0.5) * s * 0.6, y + (py - 0.5) * s * 0.6, 7, 0, 7); ctx.fill(); }
    // 目标
    ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#9adcff";
    ctx.fillText("目标 100 · 你 " + you + " / AI " + ai, W / 2, 24);
  }

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  rollBtn.addEventListener("click", roll);
  bankBtn.addEventListener("click", bank);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " ") roll();
    if (e.key === "b" || e.key === "B") bank();
  });
  againBtn.addEventListener("click", start);

  let lastMs = 0;
  function frame(ts) {
    lastMs = ts;
    draw();
    requestAnimationFrame(frame);
  }

  function start() {
    you = 0; ai = 0; turnScore = 0; turn = "you";
    state = "play";
    youEl.textContent = 0; aiEl.textContent = 0;
    msg("");
    endModal.classList.remove("show");
    startTurn();
  }

  start();
  requestAnimationFrame(frame);
})();
