/* ============================================================
   骰子对决 · 桌游
   各掷两骰比大小，五局三胜
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 300;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const youEl = document.getElementById("you");
  const roundEl = document.getElementById("round");
  const aiEl = document.getElementById("ai");
  const rollBtn = document.getElementById("rollBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let you = 0, ai = 0, round = 1;
  let state = "ready";       // ready | rolling | settle | over
  let youDice = [1, 1], aiDice = [1, 1];
  let rollT = 0, settleT = 0, lastMs = 0;
  let diceShadow = [];

  function rnd() { return 1 + ((Math.random() * 6) | 0); }

  function roll() {
    if (state === "rolling" || state === "settle" || state === "over") return;
    state = "rolling";
    rollT = 0;
    youDice = [rnd(), rnd()];
    aiDice = [rnd(), rnd()];
    diceShadow = [];
    rollBtn.disabled = true;
  }

  function settle() {
    const y = youDice[0] + youDice[1], a = aiDice[0] + aiDice[1];
    let msg;
    if (y > a) { you++; msg = "🎉 你赢下第 " + round + " 局！（" + y + " : " + a + "）"; }
    else if (a > y) { ai++; msg = "💪 AI 赢下第 " + round + " 局…（" + y + " : " + a + "）"; }
    else { msg = "🤝 平局（" + y + " : " + a + "），本局不算。"; }
    youEl.textContent = you; aiEl.textContent = ai;
    msgEl.textContent = msg;
    msgEl.className = "msg " + (y > a ? "win" : "");
    rollBtn.disabled = false;

    if (you >= 3 || ai >= 3) { state = "over"; end(); return; }
    if (y !== a) {   // 平局不消耗"决胜局数"
      round++;
      roundEl.textContent = round + "/5";
    }
    state = "ready";
  }

  function end() {
    const win = you > ai;
    endTitle.textContent = win ? "🏆 你赢了！" : "🤖 AI 赢了…";
    endMsg.textContent = "最终 " + you + " : " + ai;
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function start() {
    you = 0; ai = 0; round = 1;
    youEl.textContent = 0; aiEl.textContent = 0; roundEl.textContent = "1/5";
    youDice = [1, 1]; aiDice = [1, 1];
    state = "ready";
    msgEl.textContent = "";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    rollBtn.disabled = false;
  }

  function drawDie(x, y, val, color) {
    const s = 52;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, 10); else ctx.rect(-s / 2, -s / 2, s, s);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
    const p = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.5]];
    const on = {
      1: [0], 2: [1, 2], 3: [0, 1, 2], 4: [1, 2, 3, 4], 5: [0, 1, 2, 3, 4], 6: [1, 2, 3, 4, 5, 0],
    }[val];
    ctx.fillStyle = "#2a2f3a";
    for (let i = 0; i < on.length; i++) {
      const [px, py] = p[on[i]];
      ctx.beginPath(); ctx.arc((px - 0.5) * s * 0.6, (py - 0.5) * s * 0.6, 6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#20233a"); g.addColorStop(1, "#0d0f1c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 玩家（左） AI（右）
    ctx.textAlign = "center";
    ctx.font = "14px sans-serif"; ctx.fillStyle = "#9adcff";
    ctx.fillText("你", W / 4, 30);
    ctx.fillStyle = "#ff8a97";
    ctx.fillText("AI", W * 0.75, 30);

    // 滚动阶段抖动数值
    let yd = youDice, ad = aiDice;
    if (state === "rolling") {
      rollT === 0 ? yd = [rnd(), rnd()] : 0;
      yd = youDice; ad = aiDice;
    }
    drawDie(W / 4 - 34, 120, yd[0], "#9adcff");
    drawDie(W / 4 + 34, 120, yd[1], "#9adcff");
    drawDie(W * 0.75 - 34, 120, ad[0], "#ff8a97");
    drawDie(W * 0.75 + 34, 120, ad[1], "#ff8a97");

    ctx.font = "bold 22px sans-serif"; ctx.fillStyle = "#ece0c8";
    ctx.fillText(yd[0] + yd[1], W / 4, 200);
    ctx.fillText(ad[0] + ad[1], W * 0.75, 200);
  }

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    if (state === "rolling") {
      rollT += dt;
      youDice = [rnd(), rnd()];
      aiDice = [rnd(), rnd()];
      if (rollT > 0.6) { state = "settle"; settleT = 0; }
    }
    draw();
    requestAnimationFrame(frame);
  }

  rollBtn.addEventListener("click", roll);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " " && !e.repeat) roll();
  });
  againBtn.addEventListener("click", start);

  start();
  requestAnimationFrame(frame);
})();
