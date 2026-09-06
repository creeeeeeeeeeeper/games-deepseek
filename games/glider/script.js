/* ============================================================
   滑翔伞 · 竞速冒险（单人无尽）
   左右控制，利用热流上升，穿环得分，躲飞鸟
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const distEl = document.getElementById("dist");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 360, H = 520;
  canvas.width = W; canvas.height = H;

  const GRAV = 480, LIFT = -560, DRIFT = 200;
  const BEST_KEY = "glider-best";

  let p = { x: W / 2, y: 120 }, vy = 0, vx = 0;
  let dist = 0, score = 0, best = 0, over = false, keys = { left: false, right: false };
  let rings = [], birds = [], thermalX = W / 2, raf = 0, last = 0, scroll = 0;

  function reset() {
    p = { x: W / 2, y: 120 }; vy = 0; vx = 0; dist = 0; score = 0; over = false;
    rings = []; birds = []; thermalX = W / 2; scroll = 0;
    // 起步放两个环
    rings.push({ x: W / 2, y: 60, got: false });
  }

  function spawn() {
    // 前景移动：用于滚动感知
    scroll += 40;
    if (rings.length < 4) {
      rings.push({ x: 50 + Math.random() * (W - 100), y: Math.max(40, p.y - 200 - Math.random() * 120), got: false });
    }
    if (Math.random() < 0.008 && birds.length < 3) {
      birds.push({ x: Math.random() * W, y: 40 + Math.random() * (H - 120), vx: -40 - Math.random() * 40, vy: (Math.random() - 0.5) * 30 });
    }
  }

  function update(dt) {
    if (over) return;
    // 热流位置摆动
    thermalX = W / 2 + Math.sin(Date.now() / 1500) * 110;

    // 方向
    let steer = 0;
    if (keys.left) steer = -1; if (keys.right) steer = 1;
    vx += steer * 320 * dt;
    vx *= 0.92;
    // 重力 + 热流浮力
    let inThermal = Math.abs(p.x - thermalX) < 36;
    vy += (inThermal ? LIFT : GRAV) * dt;
    vy = Math.max(-320, Math.min(320, vy));

    p.x += (vx + DRIFT) * dt;
    p.y += vy * dt;
    p.x = Math.max(18, Math.min(W - 18, p.x));
    p.y = Math.max(18, Math.min(H - 90, p.y));

    dist += 40 * dt / 90;
    distEl.textContent = Math.floor(dist);
    spawn();

    // 碰撞环
    for (const r of rings) {
      if (!r.got && Math.hypot(p.x - r.x, p.y - r.y) < 26) { r.got = true; score += 10; scoreEl.textContent = score; }
    }
    ringtimer();
    // 撞鸟
    for (const b of birds) {
      if (Math.hypot(p.x - b.x, p.y - b.y) < 18) { crash(); return; }
    }
    // 鸟移动
    birds.forEach((b) => { b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < -30) b.x = W + 30; });
    rings = rings.filter((r) => r.y < p.y + 140);
  }
  let lastRing = 0;
  function ringtimer() {
    // 往上生成环（用时间驱动确保进度）
    if (Date.now() - lastRing > 2200) { lastRing = Date.now(); spawnRingAhead(); }
  }
  function spawnRingAhead() {
    rings.push({ x: 40 + Math.random() * (W - 80), y: Math.max(40, p.y - 260), got: false });
  }

  function crash() {
    over = true;
    const final = score;
    best = Math.max(best, final);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = "🦅 撞上飞鸟！";
    endMsg.textContent = "距离 " + Math.floor(dist) + " m · 分数 " + final + " · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#7ed0ff"); g.addColorStop(1, "#cfe7f7");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 热流
    ctx.fillStyle = "rgba(111,217,138,0.25)";
    ctx.beginPath(); ctx.moveTo(thermalX - 30, H); ctx.lineTo(thermalX + 30, H); ctx.lineTo(thermalX + 14, 40); ctx.lineTo(thermalX - 14, 40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(111,217,138,0.6)"; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = (Math.floor((scroll * 0.6 + i * 90 + Date.now() / 20) % H));
      ctx.beginPath(); ctx.moveTo(thermalX, y + 20); ctx.lineTo(thermalX, y); ctx.stroke();
    }
    // 环
    for (const r of rings) {
      ctx.strokeStyle = r.got ? "rgba(111,217,138,0.3)" : "#f0a32a"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(r.x, r.y, 22, 0, Math.PI * 2); ctx.stroke();
    }
    // 飞鸟
    for (const b of birds) {
      ctx.fillStyle = "#3a4150";
      ctx.beginPath(); ctx.moveTo(b.x - 8, b.y); ctx.lineTo(b.x + 4, b.y - 4); ctx.lineTo(b.x + 4, b.y + 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x - 8, b.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // 滑翔伞
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.max(-0.4, Math.min(0.4, vx / 1600)));
    ctx.fillStyle = "#d94b3a"; ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(-34, -22, 0, -40); ctx.quadraticCurveTo(34, -22, 0, -2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#8a5a33"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 14); ctx.stroke();
    ctx.fillStyle = "#8a5a33"; ctx.fillRect(-4, 14, 8, 6);
    ctx.fillStyle = "#f0c29a"; ctx.beginPath(); ctx.arc(0, 20, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
    bestEl.textContent = best; distEl.textContent = 0; scoreEl.textContent = 0;
    msgEl.textContent = "← / → 控制方向，进绿流上升。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); keys.left = true; }
    if (e.key === "ArrowRight") { e.preventDefault(); keys.right = true; }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < W / 2) { keys.left = true; keys.right = false; } else { keys.right = true; keys.left = false; }
  }, { passive: true });
  window.addEventListener("pointerup", () => { keys.left = false; keys.right = false; });

  start();
})();
