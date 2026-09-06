/* ============================================================
   加倍挑战 · 桌游（单人）
   掷骰 4-6 奖池翻倍、1-3 清空；「收手」入袋，12 轮
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 180;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const roundEl = document.getElementById("round");
  const potEl = document.getElementById("pot");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const goBtn = document.getElementById("goBtn");
  const bankBtn = document.getElementById("bankBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const N = 12, BASE = 10;
  let best = 0;
  try { best = parseInt(localStorage.getItem("doubleup-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let round = 1, pot = BASE, score = 0, die = 6, state = "play", lastMs = 0;

  function rnd() { return 1 + ((Math.random() * 6) | 0); }
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function go() {
    if (state !== "play") return;
    die = rnd();
    if (die >= 4) {
      pot *= 2;
      potEl.textContent = pot;
      bump(potEl);
      msgEl.textContent = "🎲 " + die + "！奖池翻倍到 " + pot + "，还要继续吗？";
      msgEl.className = "msg win";
    } else {
      // 1-3 清空：奖池清零入袋
      msgEl.textContent = "💥 掷出 " + die + "，奖池清零！本池 0 入袋。";
      msgEl.className = "msg bust";
      pot = 0;
      bank(true);
    }
  }

  function bank(busted) {
    if (state !== "play") return;
    score += pot;                 // 若 busted 则 pot 已为 0
    pot = BASE;
    scoreEl.textContent = score;
    bump(scoreEl);
    if (score > best) bestEl.textContent = score;
    msgEl.textContent = busted ? "💥 清零入袋 +0 → 换新一池。" : "收手入袋 +" + BASE + "（原池转入）。";
    if (round >= N) { end(); return; }
    round++;
    roundEl.textContent = round + "/" + N;
    potEl.textContent = pot;
  }

  function end() {
    state = "over";
    const isNew = score > best;
    if (isNew) { best = score; try { localStorage.setItem("doubleup-best", String(best)); } catch (_) {} bestEl.textContent = best; }
    endTitle.textContent = "💸 十二轮结束";
    endMsg.innerHTML = "成绩 <b>" + score + "</b>" + (isNew ? "<br>🏆 新纪录！" : "<br>最高 " + best);
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function drawDie(x, y, val) {
    const s = 76;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-s / 2, -s / 2, s, s, 12); else ctx.rect(-s / 2, -s / 2, s, s);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
    const p = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    const on = { 1: [0], 2: [1, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4] }[val];
    ctx.fillStyle = "#2a2f3a";
    for (const idx of on) { const [px, py] = p[idx]; ctx.beginPath(); ctx.arc(x + (px - 0.5) * s * 0.6, y + (py - 0.5) * s * 0.6, 7, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#20233a"); g.addColorStop(1, "#0d0f1c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawDie(W / 2, H / 2 + 8, die);
    ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#9adcff";
    ctx.fillText("奖池 " + pot + " · 掷 4-6 翻倍 / 1-3 清零", W / 2, 24);
  }

  function frame(ts) {
    lastMs = ts;
    draw();
    requestAnimationFrame(frame);
  }

  goBtn.addEventListener("click", go);
  bankBtn.addEventListener("click", bank);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " ") go();
    if (e.key === "b" || e.key === "B") bank();
  });
  againBtn.addEventListener("click", start);

  function start() {
    round = 1; pot = BASE; score = 0; die = 6; state = "play";
    roundEl.textContent = "1/12";
    potEl.textContent = pot;
    scoreEl.textContent = 0;
    msgEl.textContent = "奖池从 " + BASE + " 开始，赌一把？"; msgEl.className = "msg";
    endModal.classList.remove("show");
  }

  start();
  requestAnimationFrame(frame);
})();
