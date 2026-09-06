/* ============================================================
   神射手 · 动作街机（单人或双人轮流）
   按住蓄力、松手射箭；风影响弹道；总分定胜负
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const totalEl = document.getElementById("total");
  const arrowsEl = document.getElementById("arrows");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 440, H = 320;
  canvas.width = W; canvas.height = H;

  const BOW = { x: 60, y: H - 60 };
  const TARGET = { x: 380, y: H / 2 + 20, r: 62, rings: 5 };
  const MAX_ARROWS = 3;

  let wind = 0, charge = 0, charging = false, arrowsLeft = MAX_ARROWS;
  let total = 0, lastScore = 0, over = false, flying = null, raf = 0, last = 0;
  let stuckArrows = [];

  function reset() {
    wind = (Math.random() - 0.5) * 60;
    charge = 0; charging = false; arrowsLeft = MAX_ARROWS; total = 0; lastScore = 0;
    over = false; flying = null; stuckArrows = [];
  }

  function shoot() {
    if (over || arrowsLeft <= 0 || charging === false) return;
    charging = false;
    const power = 0.25 + charge * 0.9;   // 0.25..1.15
    const speed = 520 * power;
    // 瞄准靶心，角度朝右；风会横向偏移
    const dx = TARGET.x - BOW.x, dy = TARGET.y - BOW.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) + (wind / 900) * (dist / 200);
    // 蓄力越足，初速越大 → 能飞越重力下坠更远，落点越接近/越过靶心
    flying = { x: BOW.x, y: BOW.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    charge = 0;
  }

  function update(dt) {
    if (over) return;
    if (charging) charge = Math.min(1, charge + dt * 1.2);
    if (flying) {
      flying.vy += 240 * dt;               // 重力：蓄力不足会在靶前下坠
      flying.x += flying.vx * dt;
      flying.y += flying.vy * dt;
      // 到靶区判定
      if (flying.x >= TARGET.x - 10) {
        const dx = flying.x - TARGET.x, dy = flying.y - TARGET.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const s = scoreHit(d);
        lastScore = s;
        total += s;
        stuckArrows.push({ x: flying.x, y: flying.y, d });
        arrowsLeft--;
        totalEl.textContent = total;
        scoreEl.textContent = s;
        arrowsEl.textContent = arrowsLeft;
        msgEl.textContent = s > 0 ? "命中 " + s + " 环！" : "脱靶了…";
        flying = null;
        if (arrowsLeft <= 0) setTimeout(finish, 500);
      }
      if (flying && (flying.x > W + 40 || flying.y < -40 || flying.y > H + 40)) {
        lastScore = 0; total += 0;
        stuckArrows.push({ x: flying.x, y: flying.y, miss: true });
        arrowsLeft--; totalEl.textContent = total; scoreEl.textContent = 0; arrowsEl.textContent = arrowsLeft;
        msgEl.textContent = "脱靶…";
        flying = null;
        if (arrowsLeft <= 0) setTimeout(finish, 500);
      }
    }
  }

  function scoreHit(d) {
    if (d <= TARGET.r / TARGET.rings) return TARGET.rings;
    for (let i = 2; i <= TARGET.rings; i++) {
      if (d <= (TARGET.r / TARGET.rings) * i) return TARGET.rings - i + 1;
    }
    return 0;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#26343f"; ctx.fillRect(0, 0, W, H);
    // 地面
    ctx.fillStyle = "#2f9e4f"; ctx.fillRect(0, H - 24, W, 24);
    ctx.fillStyle = "#237a3b"; ctx.fillRect(0, H - 24, W, 4);

    // 靶
    for (let i = 0; i < TARGET.rings; i++) {
      const rr = (TARGET.r / TARGET.rings) * (TARGET.rings - i);
      ctx.fillStyle = i === 0 ? "#d94b3a" : (i % 2 ? "#f4f6f8" : "#d94b3a");
      ctx.beginPath(); ctx.arc(TARGET.x, TARGET.y, rr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#f0a32a"; ctx.beginPath(); ctx.arc(TARGET.x, TARGET.y, 3, 0, Math.PI * 2); ctx.fill();

    // 已射中的箭
    ctx.strokeStyle = "#8a5a33"; ctx.lineWidth = 3;
    for (const a of stuckArrows) {
      ctx.beginPath(); ctx.moveTo(a.x - 12, a.y); ctx.lineTo(a.x + 6, a.y); ctx.stroke();
    }

    // 弓
    ctx.strokeStyle = "#6f86ac"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(BOW.x, BOW.y, 26, -Math.PI / 2.6, Math.PI / 2.6); ctx.stroke();
    ctx.strokeStyle = "#c9c9c9"; ctx.lineWidth = 2;
    const bowTop = { x: BOW.x + 26 * Math.cos(-Math.PI / 2.6), y: BOW.y + 26 * Math.sin(-Math.PI / 2.6) };
    const bowBot = { x: BOW.x + 26 * Math.cos(Math.PI / 2.6), y: BOW.y + 26 * Math.sin(Math.PI / 2.6) };
    ctx.beginPath(); ctx.moveTo(bowTop.x, bowTop.y); ctx.lineTo(BOW.x, BOW.y + charge * 12); ctx.lineTo(bowBot.x, bowBot.y); ctx.stroke();

    // 飞行中的箭
    if (flying) {
      ctx.strokeStyle = "#8a5a33"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(flying.x - 14, flying.y); ctx.lineTo(flying.x + 8, flying.y); ctx.stroke();
      ctx.fillStyle = "#d94b3a"; ctx.beginPath(); ctx.arc(flying.x + 8, flying.y, 2, 0, Math.PI * 2); ctx.fill();
    }

    // 风力指示
    ctx.fillStyle = "#f4f6f8"; ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("风 " + (wind > 0 ? "→" : wind < 0 ? "←" : "—") + " " + Math.abs(Math.round(wind)), 14, 20);
    // 蓄力条
    ctx.fillStyle = "#2a2f3a"; ctx.fillRect(14, 30, 120, 8);
    ctx.fillStyle = charge > 0.85 ? "#d94b3a" : "#e2c266"; ctx.fillRect(14, 30, 120 * charge, 8);
    ctx.fillStyle = "#f4f6f8"; ctx.font = "12px sans-serif"; ctx.fillText("蓄力", 14, 50);
  }

  function finish() {
    over = true;
    endTitle.textContent = total >= 12 ? "🎉 神射手中了！" : "🏹 射完了";
    endMsg.textContent = "总得分 " + total + "（满分 " + MAX_ARROWS * 5 + "）";
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    reset();
    scoreEl.textContent = 0; totalEl.textContent = 0; arrowsEl.textContent = MAX_ARROWS;
    msgEl.textContent = "按住蓄力，松手射箭。共 " + MAX_ARROWS + " 支箭。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  againBtn.addEventListener("click", start);
  // 输入
  canvas.addEventListener("pointerdown", (e) => {
    if (e.cancelable) e.preventDefault();
    if (!over && arrowsLeft > 0 && !flying) charging = true;
  }, { passive: false });
  window.addEventListener("pointerup", () => { if (charging) shoot(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
    if ((e.key === " " || e.code === "Space") && !e.repeat) { e.preventDefault(); if (!over && arrowsLeft > 0 && !flying) charging = true; }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === " " || e.code === "Space") { e.preventDefault(); if (charging) shoot(); }
  });

  start();
})();
