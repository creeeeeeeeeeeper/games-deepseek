/* ============================================================
   冲浪高手 · 竞速冒险（单人保持平衡）
   站在摆动的浪尖上，左右移动维持平衡，站得越久分越高
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 360, H = 520;
  canvas.width = W; canvas.height = H;

  const SURF_Y = 360;
  const BEST_KEY = "surf-best";

  let surfer = { x: W / 2, tilt: 0 }, vx = 0;
  let score = 0, combo = 0, best = 0, over = false;
  let wavePhase = 0, waveX = W / 2, time = 0;
  let raf = 0, last = 0, keys = { left: false, right: false };

  function reset() {
    surfer = { x: W / 2, tilt: 0 }; vx = 0; score = 0; combo = 0;
    wavePhase = 0; waveX = W / 2; time = 0; over = false;
  }

  function update(dt) {
    if (over) return;
    time += dt;

    // 波浪尖左右摆动（越玩越快）
    wavePhase += (0.6 + time * 0.02) * dt;
    const amp = 60 + Math.min(90, time * 6);
    waveX = W / 2 + Math.sin(wavePhase) * amp;

    const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    vx += steer * 520 * dt;
    vx *= 0.9;
    surfer.x += vx * dt;
    surfer.x = Math.max(30, Math.min(W - 30, surfer.x));

    // 距离浪尖的偏差 → 倾斜
    const dx = surfer.x - waveX;
    surfer.tilt = dx * 0.03;

    // 若偏移过大，站不稳翻浪
    if (Math.abs(dx) > 88) { crash(); return; }

    // 连击：贴近浪尖维持连击，偏离则重置
    if (Math.abs(dx) < 18) combo += dt * 4;
    else combo = Math.max(0, combo - dt * 8);
    comboEl.textContent = Math.floor(combo);

    // 得分：跟随浪尖 + 连击加成
    score += dt * (10 + combo * 2);
    scoreEl.textContent = Math.floor(score);
  }

  function crash() {
    over = true;
    const final = Math.floor(score);
    best = Math.max(best, final);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = "🌊 翻浪了！";
    endMsg.textContent = "得分 " + final + " · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0d2a44"; ctx.fillRect(0, 0, W, H);
    // 天空渐层
    ctx.fillStyle = "rgba(90,140,190,0.2)"; ctx.fillRect(0, 0, W, SURF_Y - 20);

    // 海浪（一条摆动曲线）
    ctx.strokeStyle = "#3aa6c8"; ctx.lineWidth = 5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const p = x / W;
      // 浪峰在 waveX，两侧下落
      const dist = Math.abs(x - waveX) / 90;
      const h = SURF_Y + (x < waveX ? dist * 40 : dist * 46) + Math.sin(x * 0.05 + wavePhase * 3) * 6;
      x === 0 ? ctx.moveTo(x, h) : ctx.lineTo(x, h);
    }
    ctx.stroke();
    // 浪面填充
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = "#1c5a8a"; ctx.fill();
    ctx.strokeStyle = "#6fc0dc"; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const px = ((i * 30 + time * 30) % (W + 40)) - 20;
      const py = SURF_Y + 40 + Math.sin(time * 2 + i) * 6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 12, py); ctx.stroke();
    }

    // 冲浪者
    const sx = surfer.x, sy = SURF_Y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(surfer.tilt * 0.4);
    // 板
    ctx.fillStyle = "#f3b93a"; ctx.beginPath(); ctx.ellipse(0, 0, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    // 人
    ctx.fillStyle = "#f0c29a";
    ctx.beginPath(); ctx.arc(0, -14, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d94b3a";
    ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(7, -8); ctx.lineTo(4, 0); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
    ctx.restore();

    // 提示平衡条
    ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillRect(W / 2 - 60, 24, 120, 6);
    ctx.fillStyle = "#e2c266"; ctx.fillRect(W / 2 - 60, 24, 120 - Math.min(120, Math.abs(surfer.x - waveX)), 6);
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
    bestEl.textContent = best; scoreEl.textContent = 0; comboEl.textContent = 0;
    msgEl.textContent = "← / → 保持在浪尖上。";
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
  // 点击左右半屏移动
  canvas.addEventListener("pointerdown", (e) => {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < W / 2) keys.left = true; else keys.right = true;
  }, { passive: true });
  window.addEventListener("pointerup", () => { keys.left = false; keys.right = false; });

  start();
})();
