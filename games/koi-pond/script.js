/* ============================================================
   锦鲤池 · 休闲娱乐（单人休闲）
   撒鱼食引来锦鲤，聚群得分；越热闹越大，和谐分越高
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const koiEl = document.getElementById("koi");
  const scoreEl = document.getElementById("score");
  const feedBtn = document.getElementById("feedBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 400, H = 300;
  canvas.width = W; canvas.height = H;
  const GOAL = 300;

  let foods = [], kois = [], score = 0, over = false, time = 0, raf = 0, last = 0;

  const COLORS = ["#ff7a3d", "#ffd76b", "#e2c266", "#ff6b8a", "#9fd6ff", "#ffaa4a"];

  function makeKoi() {
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      size: 10 + Math.random() * 6,
      hungry: true,
    };
  }

  function spawnFood() {
    const x = 60 + Math.random() * (W - 120);
    const y = 60 + Math.random() * (H - 120);
    foods.push({ x, y, life: 6 });
    // 撒食也偶尔引来新锦鲤
    if (Math.random() < 0.5 && kois.length < 12) kois.push(makeKoi());
  }

  function feed() {
    if (over) return;
    spawnFood();
    if (foods.length > 6) foods = foods.slice(-6);
    msgEl.textContent = "鱼食落下，锦鲤围过来了~";
  }

  function update(dt) {
    if (over) return;
    time += dt;
    // 食物吸引锦鲤
    for (const k of kois) {
      let target = null, bd = 1e9;
      for (const f of foods) {
        const d = Math.hypot(k.x - f.x, k.y - f.y);
        if (d < bd) { bd = d; target = f; }
      }
      if (target) {
        const dx = target.x - k.x, dy = target.y - k.y;
        const dl = Math.hypot(dx, dy) || 1;
        k.vx += (dx / dl) * 120 * dt;
        k.vy += (dy / dl) * 120 * dt;
        // 靠近则吃
        if (dl < 14) { k.hungry = false; foodEaten(); }
      } else {
        // 慢悠悠回游
        k.vx += (Math.random() - 0.5) * 10 * dt;
        k.vy += (Math.random() - 0.5) * 10 * dt;
      }
      k.x += k.vx * dt; k.y += k.vy * dt;
      if (k.x < 8) k.vx = Math.abs(k.vx); if (k.x > W - 8) k.vx = -Math.abs(k.vx);
      if (k.y < 8) k.vy = Math.abs(k.vy); if (k.y > H - 8) k.vy = -Math.abs(k.vy);
      // 阻力
      k.vx *= (1 - 0.5 * dt); k.vy *= (1 - 0.5 * dt);
    }
    // 食物寿命
    foods = foods.filter((f) => { f.life -= dt; return f.life > 0; });

    // 和谐分：在场锦鲤越多、维持越久越高
    score += kois.length * 2 * dt;
    scoreEl.textContent = Math.floor(score);
    koiEl.textContent = kois.length;
    if (score >= GOAL) { finish(); }
  }

  function foodEaten() {
    // 食物被吃掉即消失（简单处理：随机移除一个 life 最少的食物）
    if (foods.length) foods.splice(0, 1);
    score += 30;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 水
    ctx.fillStyle = "#123a5a"; ctx.fillRect(0, 0, W, H);
    // 波纹
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = ((time * 20 + i * 50) % H);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.05 + time * 2) * 4);
      ctx.stroke();
    }
    // 食物
    for (const f of foods) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // 锦鲤
    for (const k of kois) {
      drawKoi(k);
    }
  }

  function drawKoi(k) {
    const ang = Math.atan2(k.vy, k.vx);
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(ang);
    // 尾巴
    ctx.fillStyle = k.color;
    ctx.beginPath(); ctx.moveTo(-k.size, 0); ctx.lineTo(-k.size - 8, -5); ctx.lineTo(-k.size - 8, 5); ctx.closePath(); ctx.fill();
    // 身体
    ctx.beginPath(); ctx.ellipse(0, 0, k.size, k.size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    // 眼
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(k.size * 0.5, -k.size * 0.15, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function finish() {
    over = true;
    endTitle.textContent = "🪷 完美一池";
    endMsg.textContent = "和谐分 " + Math.floor(score) + " · 在场锦鲤 " + kois.length;
    setTimeout(() => endModal.classList.add("show"), 300);
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    foods = []; kois = [];
    for (let i = 0; i < 3; i++) kois.push(makeKoi());
    score = 0; over = false; time = 0;
    msgEl.textContent = "点「撒鱼食」引来锦鲤。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    scoreEl.textContent = 0; koiEl.textContent = kois.length;
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  feedBtn.addEventListener("click", feed);
  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; } if (e.key === " " || e.code === "Space") { e.preventDefault(); feed(); } });

  start();
})();
