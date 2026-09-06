/* ============================================================
   猜大小 · 桌游
   3 骰总和 ≥11 为大、≤10 为小；先下单再掷骰，10 局
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 220;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const roundEl = document.getElementById("round");
  const scoreEl = document.getElementById("score");
  const streakEl = document.getElementById("streak");
  const bestEl = document.getElementById("best");
  const sumEl = document.getElementById("sum");
  const bigBtn = document.getElementById("bigBtn");
  const smallBtn = document.getElementById("smallBtn");
  const rollBtn = document.getElementById("rollBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const N = 10;
  let best = 0;
  try { best = parseInt(localStorage.getItem("dicesize-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let state = "bet";         // bet | rolling | settled | over
  let round = 1, score = 0, streak = 0, sum = 0, dice = [1, 1, 1];
  let bet = null, freeRoll = true, rollT = 0, lastMs = 0;

  function rnd() { return 1 + ((Math.random() * 6) | 0); }
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function pick(d) {
    if (state !== "bet") return;
    bet = d;
    state = "rolling";
    rollT = 0;
    bigBtn.disabled = true; smallBtn.disabled = true;
    msgEl.textContent = "";
  }

  function doRoll() {
    if (state === "bet" && !freeRoll) return;
    if (state === "bet") { freeRoll = false; }
    dice = [rnd(), rnd(), rnd()];
    state = "rolling";
    rollT = 0;
    bigBtn.disabled = true; smallBtn.disabled = true;
  }

  function settle() {
    sum = dice[0] + dice[1] + dice[2];
    sumEl.textContent = sum;
    const isBig = sum >= 11;
    const win = (bet === "big" && isBig) || (bet === "small" && !isBig);
    if (win) {
      streak++;
      score += 10 + (streak >= 5 ? 5 : streak >= 3 ? 3 : 0);
      msgEl.textContent = (bet === "big" ? "🟢" : "🔴") + " 猜中！" + (streak > 1 ? " 连中 ×" + streak : "");
      msgEl.className = "msg win";
    } else {
      streak = 0;
      msgEl.textContent = "猜错了… 这局是 " + (isBig ? "大(" + sum + ")" : "小(" + sum + ")");
      msgEl.className = "msg";
    }
    scoreEl.textContent = score;
    streakEl.textContent = streak;
    bump(scoreEl); bump(streakEl);
    if (score > best) bestEl.textContent = score;

    if (round >= N) { state = "over"; end(); return; }
    round++;
    roundEl.textContent = round + "/" + N;
    state = "bet";
    bet = null; freeRoll = true;
    bigBtn.disabled = false; smallBtn.disabled = false; rollBtn.disabled = false;
  }

  function end() {
    const isNew = score > best;
    if (isNew) { best = score; try { localStorage.setItem("dicesize-best", String(best)); } catch (_) {} bestEl.textContent = best; }
    endTitle.textContent = "🎰 十局打完！";
    endMsg.innerHTML = "得分 <b>" + score + "</b>" + (isNew ? "<br>🏆 新纪录！" : "<br>最高分 " + best);
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#20233a"); g.addColorStop(1, "#0d0f1c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const s = 62, y = H / 2;
    dice.forEach((v, i) => {
      const x = W / 2 + (i - 1) * (s + 20);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - s / 2, y - s / 2, s, s, 10); else ctx.rect(x - s / 2, y - s / 2, s, s);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
      const p = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
      const on = { 1: [0], 2: [1, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4] }[v];
      ctx.fillStyle = "#2a2f3a";
      for (const idx of on) { const [px, py] = p[idx]; ctx.beginPath(); ctx.arc(x + (px - 0.5) * s * 0.6, y + (py - 0.5) * s * 0.6, 6, 0, 7); ctx.fill(); }
    });
    // 提示
    ctx.font = "13px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = "#9adcff";
    ctx.fillText(state === "bet" ? "先下注：大 / 小？" : "总和 = " + sum, W / 2, 24);
  }

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    if (state === "rolling") {
      rollT += dt;
      dice = [rnd(), rnd(), rnd()];
      if (rollT > 0.5) settle();
    }
    draw();
    requestAnimationFrame(frame);
  }

  bigBtn.addEventListener("click", () => pick("big"));
  smallBtn.addEventListener("click", () => pick("small"));
  rollBtn.addEventListener("click", doRoll);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === "1") pick("big");
    if (e.key === "2") pick("small");
    if (e.key === " ") doRoll();
  });
  againBtn.addEventListener("click", start);

  function start() {
    round = 1; score = 0; streak = 0; sum = 0; bet = null; freeRoll = true;
    dice = [1, 1, 1];
    state = "bet";
    roundEl.textContent = "1/10";
    scoreEl.textContent = 0; streakEl.textContent = 0; sumEl.textContent = "—";
    msgEl.textContent = ""; msgEl.className = "msg";
    bigBtn.disabled = false; smallBtn.disabled = false; rollBtn.disabled = false;
    endModal.classList.remove("show");
  }

  start();
  requestAnimationFrame(frame);
})();
