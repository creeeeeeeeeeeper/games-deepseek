/* ============================================================
   快艇骰子 · 桌游
   掷 5 骰，选一个点数类别入账；10 轮，总分越高越好
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 200;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const roundEl = document.getElementById("round");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const catsEl = document.getElementById("cats");
  const rollBtn = document.getElementById("rollBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const N = 6;   // 每个点数类别只能用一次，因此共 6 轮
  let best = 0;
  try { best = parseInt(localStorage.getItem("yahtzee-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let round = 1, score = 0;
  let dice = [1, 1, 1, 1, 1];
  let used = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
  let state = "roll";        // roll | chose
  let lastMs = 0, rollT = 0;
  let cats = [];

  function rnd() { return 1 + ((Math.random() * 6) | 0); }
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function roll() {
    if (state !== "roll") return;
    state = "rolling"; rollT = 0;
    rollBtn.disabled = true;
  }

  function choose(v) {
    if (state !== "chose" || used[v]) return;
    used[v] = true;
    const cnt = dice.filter((d) => d === v).length;
    score += v * cnt;
    scoreEl.textContent = score; bump(scoreEl);
    if (score > best) bestEl.textContent = score;
    msgEl.textContent = v + " 点 × " + cnt + " = +" + (v * cnt);
    msgEl.className = "msg";
    refreshCats();

    if (round >= N) { end(); return; }
    round++;
    roundEl.textContent = round + "/" + N;
    state = "roll";
    rollBtn.disabled = false;
  }

  function end() {
    state = "over";
    const isNew = score > best;
    if (isNew) { best = score; try { localStorage.setItem("yahtzee-best", String(best)); } catch (_) {} bestEl.textContent = best; }
    endTitle.textContent = "🎲 六轮打完！";
    endMsg.innerHTML = "总分 <b>" + score + "</b>" + (isNew ? "<br>🏆 新纪录！" : "<br>最高分 " + best);
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function refreshCats() {
    cats.forEach((btn) => {
      const v = parseInt(btn.dataset.v, 10);
      btn.classList.toggle("used", used[v]);
      btn.disabled = used[v] || state !== "chose";
    });
    rollBtn.disabled = state !== "roll";
  }

  function drawDie(x, y, val) {
    const s = 60;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, 10); else ctx.rect(-s / 2, -s / 2, s, s);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
    const p = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    const on = { 1: [0], 2: [1, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4] }[val];
    ctx.fillStyle = "#2a2f3a";
    for (const idx of on) { const [px, py] = p[idx]; ctx.beginPath(); ctx.arc(x + (px - 0.5) * s * 0.6, y + (py - 0.5) * s * 0.6, 6, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#20233a"); g.addColorStop(1, "#0d0f1c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const step = 96;
    dice.forEach((v, i) => drawDie(W / 2 + (i - 2) * step, H / 2, v));
  }

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    if (state === "rolling") {
      rollT += dt;
      dice = [rnd(), rnd(), rnd(), rnd(), rnd()];
      if (rollT > 0.5) { state = "chose"; refreshCats(); }
    }
    draw();
    requestAnimationFrame(frame);
  }

  rollBtn.addEventListener("click", roll);
  cats = Array.from(catsEl.querySelectorAll("button"));
  cats.forEach((btn) => btn.addEventListener("click", () => choose(parseInt(btn.dataset.v, 10))));
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " ") roll();
  });
  againBtn.addEventListener("click", start);

  function start() {
    round = 1; score = 0;
    dice = [1, 1, 1, 1, 1];
    used = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
    state = "roll";
    roundEl.textContent = "1/" + N;
    scoreEl.textContent = 0;
    msgEl.textContent = ""; msgEl.className = "msg";
    endModal.classList.remove("show");
    refreshCats();
  }

  start();
  requestAnimationFrame(frame);
})();
