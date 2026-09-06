/* ============================================================
   骰子21点 · 桌游
   掷骰累加，越接近 21 越好；超 21 爆牌；庄家自动补到 ≥17
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 200;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const youEl = document.getElementById("you");
  const dealerEl = document.getElementById("dealer");
  const statusEl = document.getElementById("status");
  const hitBtn = document.getElementById("hitBtn");
  const standBtn = document.getElementById("standBtn");
  const newBtn = document.getElementById("newBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let you = [], dealer = [];
  let state = "player";     // player | dealer | done
  let lastMs = 0;

  const rnd = () => 1 + ((Math.random() * 6) | 0);
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  function hitPlayer() {
    if (state !== "player") return;
    you.push(rnd());
    youEl.textContent = sum(you);
    if (sum(you) > 21) { state = "done"; settle(true); }
  }

  function stand() {
    if (state !== "player") return;
    state = "dealer";
    dealer.push(rnd());
    dealerEl.textContent = sum(dealer);
    const step = () => {
      if (state !== "dealer") return;
      if (sum(dealer) < 17) {
        dealer.push(rnd());
        dealerEl.textContent = sum(dealer);
        setTimeout(step, 450);
      } else {
        state = "done";
        settle(false);
      }
    };
    setTimeout(step, 450);
  }

  function settle(playerBust) {
    const y = sum(you), d = sum(dealer);
    let win = false, txt;
    if (playerBust) { txt = "💥 你爆了（" + y + "），庄家赢。"; }
    else if (d > 21) { win = true; txt = "🎉 庄家爆了（" + d + "），你赢！"; }
    else if (y > d) { win = true; txt = "🎉 你 " + y + " 比庄家 " + d + " 更接近 21，赢！"; }
    else if (y === d) { txt = "🤝 平局（" + y + " = " + d + "）。"; }
    else { txt = "😅 庄家 " + d + " 压过你 " + y + "，这局输了。"; }
    msgEl.textContent = txt;
    msgEl.className = "msg " + (win ? "win" : playerBust ? "lose" : "");
    statusEl.textContent = "本局结束";
    hitBtn.disabled = true; standBtn.disabled = true;
    endTitle.textContent = win ? "🎉 你赢了！" : "🎲 本局结束";
    endMsg.textContent = txt;
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function drawDie(x, y, val) {
    const s = 56;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, 9); else ctx.rect(-s / 2, -s / 2, s, s);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
    const p = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    const on = { 1: [0], 2: [1, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4] }[val];
    ctx.fillStyle = "#2a2f3a";
    for (const idx of on) { const [px, py] = p[idx]; ctx.beginPath(); ctx.arc(x + (px - 0.5) * s * 0.6, y + (py - 0.5) * s * 0.6, 5, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#20233a"); g.addColorStop(1, "#0d0f1c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.font = "12px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = "#9adcff"; ctx.fillText("你（" + sum(you) + "）", W / 4, 20);
    ctx.fillStyle = "#ff8a97"; ctx.fillText("庄家（" + sum(dealer) + "）", W * 0.75, 20);
    you.forEach((v, i) => drawDie(W / 4 + (i - (you.length - 1) / 2) * 64, 110, v));
    dealer.forEach((v, i) => drawDie(W * 0.75 + (i - (dealer.length - 1) / 2) * 64, 110, v));
  }

  function frame(ts) {
    lastMs = ts;
    draw();
    requestAnimationFrame(frame);
  }

  hitBtn.addEventListener("click", hitPlayer);
  standBtn.addEventListener("click", stand);
  newBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === "h" || e.key === "H") hitPlayer();
    if (e.key === "s" || e.key === "S") stand();
  });
  againBtn.addEventListener("click", start);

  function start() {
    you = [rnd(), rnd()];
    dealer = [rnd()];
    state = "player";
    youEl.textContent = sum(you);
    dealerEl.textContent = sum(dealer);
    statusEl.textContent = "你的回合";
    msgEl.textContent = ""; msgEl.className = "msg";
    hitBtn.disabled = false; standBtn.disabled = false;
    endModal.classList.remove("show");
  }

  start();
  requestAnimationFrame(frame);
})();
