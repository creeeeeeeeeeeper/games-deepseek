/* ============================================================
   拔河气球 · 原创
   按住给气球打气往自己侧拉；先过中线者得分，五局三胜
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 520;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const youEl = document.getElementById("you");
  const roundEl = document.getElementById("round");
  const aiEl = document.getElementById("ai");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const GOAL = 110;          // 你要把气球拉过 x<GOAL 算你赢
  const TUG = { y: H / 2 };
  let you = 0, ai = 0, round = 1;
  let state = "ready";       // ready | count | play | over
  let countT = 0;
  let hold = false;
  let bx = W - TUG.y;        // 共用气球绳结位置：起点中间偏右
  let ropeX = W / 2 + 60;
  let aiForce = 0;
  let lastMs = 0, now = 0;

  function update(dt) {
    now += dt;
    if (state === "count") { countT += dt; if (countT >= 0.7) state = "play"; return; }
    if (state !== "play") return;

    // 你按住 → 往左拉；AI 自动 → 往右拉（力略弱且抖动）
    const aiTarget = 0.62 + Math.sin(now * 1.3) * 0.12 + Math.random() * 0.05;
    aiForce += (aiTarget - aiForce) * Math.min(1, dt * 6);
    const pull = (hold ? 1.0 : 0) - aiForce;
    ropeX += pull * 74 * dt;
    ropeX = Math.max(70, Math.min(W - 70, ropeX));

    if (ropeX <= GOAL) winRound(true);
    else if (ropeX >= W - GOAL) winRound(false);
  }

  function winRound(playerWon) {
    if (playerWon) you++; else ai++;
    youEl.textContent = you; aiEl.textContent = ai;
    if (you >= 3 || ai >= 3 || round >= 5) { endGame(); return; }
    round++;
    roundEl.textContent = round + "/5";
    ropeX = W / 2 + 60;
    state = "count";
    countT = 0;
  }

  function endGame() {
    state = "over";
    const win = you > ai;
    endTitle.textContent = win ? "🏆 你赢啦！" : "🤖 AI 赢了…";
    endMsg.textContent = "最终 " + you + " : " + ai + "（五局三胜）";
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function start() {
    you = 0; ai = 0; round = 1;
    youEl.textContent = 0; aiEl.textContent = 0; roundEl.textContent = "1/5";
    ropeX = W / 2 + 60;
    aiForce = 0;
    state = "count"; countT = 0;
    endModal.classList.remove("show");
  }

  function drawBalloon(x, y, color, mine) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 32, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(-9, -12, 6, 0, 7); ctx.fill();
    ctx.fillStyle = "#8a5a2b";
    ctx.beginPath();
    ctx.moveTo(-6, 32); ctx.lineTo(6, 32); ctx.lineTo(0, 44);
    ctx.closePath(); ctx.fill();
    if (mine) {
      ctx.fillStyle = "#fff";
      ctx.font = "11px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("我", 0, 61);
    }
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#13241a"); g.addColorStop(1, "#0c1309");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 中线
    ctx.strokeStyle = "rgba(236,224,200,0.4)";
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(W / 2, 40); ctx.lineTo(W / 2, H - 40); ctx.stroke();
    ctx.setLineDash([]);

    // 目标区
    ctx.fillStyle = "rgba(124,224,138,0.08)";
    ctx.fillRect(20, 40, GOAL - 20, H - 80);
    ctx.fillStyle = "rgba(255,93,108,0.07)";
    ctx.fillRect(W - GOAL, 40, GOAL - 20, H - 80);

    // 绳子
    ctx.strokeStyle = "#e8c96a";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(70, TUG.y + 10); ctx.lineTo(W - 70, TUG.y + 10); ctx.stroke();

    // 气球
    drawBalloon(ropeX - 46, TUG.y, "#ffb3c9", true);   // 你的（左）
    drawBalloon(ropeX + 46, TUG.y, "#ff5d6c", false);  // AI（右）

    // 充气特效
    if (hold) {
      ctx.fillStyle = "rgba(255,179,201,0.5)";
      ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("→", ropeX - 96, TUG.y + 22);
    }

    // 状态
    ctx.textAlign = "center";
    if (state === "count") {
      ctx.fillStyle = "rgba(10,15,8,0.7)"; ctx.fillRect(0, 0, W, H);
      const n = Math.max(1, Math.ceil(0.7 - countT));
      ctx.fillStyle = "#ece0c8"; ctx.font = "bold 60px sans-serif";
      ctx.fillText(String(n), W / 2, H / 2);
    } else if (state === "ready") {
      ctx.fillStyle = "rgba(10,15,8,0.7)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8"; ctx.font = "bold 26px sans-serif";
      ctx.fillText("🎈 拔河气球", W / 2, H / 2 - 26);
      ctx.font = "15px sans-serif"; ctx.fillStyle = "#9adcff";
      ctx.fillText("按住把气球拉向左线，先过线得分", W / 2, H / 2 + 8);
      ctx.fillStyle = "#ffe9b3"; ctx.font = "bold 16px sans-serif";
      ctx.fillText("点击开始", W / 2, H / 2 + 40);
    }
  }

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "ready") { state = "count"; countT = 0; return; }
    hold = true;
  });
  window.addEventListener("pointerup", () => { hold = false; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " " && !e.repeat) { if (state === "ready") { state = "count"; countT = 0; } else hold = true; }
  });
  document.addEventListener("keyup", (e) => { if (e.key === " ") hold = false; });
  againBtn.addEventListener("click", start);

  start();
  requestAnimationFrame(frame);
})();
