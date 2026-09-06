/* ============================================================
   喷气背包 · 竞速冒险（单人无尽）
   按住升/松开落，穿柱隙；触柱或坠地结束
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const distEl = document.getElementById("dist");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 360, H = 520;
  canvas.width = W; canvas.height = H;

  const GROUND = H - 24;
  const PLYR_X = 100, PLYR_W = 26, PLYR_H = 32;
  const GRAV = 1400, THRUST = -900, SPEED = 230;
  const PIPE_W = 66, BEST_KEY = "jetpack-best";

  let pY, vy, holding = false, dist = 0, best = 0, over = false;
  let pipes = [], pipeTimer = 0, raf = 0, last = 0, gy = 0;

  function reset() {
    pY = H * 0.4; vy = 0; dist = 0; over = false; pipes = []; pipeTimer = 1.6; holding = false;
  }

  function spawn(dt) {
    if (pipeTimer > 0) { pipeTimer -= dt; return; }
    pipeTimer = Math.max(1.15, 1.7 - dist * 0.004);
    const gapH = Math.max(168, 230 - dist * 0.8);
    const gapY = 60 + Math.random() * (GROUND - 120 - gapH);
    pipes.push({ x: W + 20, gapY, gapH });
  }

  function update(dt) {
    if (over) return;
    if (holding) vy += THRUST * dt; else vy += GRAV * dt;
    pY += vy * dt;
    if (pY > GROUND - PLYR_H / 2) { pY = GROUND - PLYR_H / 2; vy = 0; crash(1); return; }
    if (pY < PLYR_H / 2) { pY = PLYR_H / 2; vy = 0; }

    dist += SPEED * dt / 90;
    distEl.textContent = Math.floor(dist);

    for (const p of pipes) p.x -= SPEED * dt;
    pipes = pipes.filter((p) => p.x > -PIPE_W - 30);
    spawn(dt);

    // 碰撞
    for (const p of pipes) {
      if (PLYR_X + PLYR_W / 2 > p.x - PIPE_W / 2 && PLYR_X - PLYR_W / 2 < p.x + PIPE_W / 2) {
        if (pY - PLYR_H / 2 < p.gapY || pY + PLYR_H / 2 > p.gapY + p.gapH) { crash(0); return; }
      }
    }
  }

  function crash(grounded) {
    over = true;
    const d = Math.floor(dist);
    best = Math.max(best, d);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = grounded ? "🛬 坠地了" : "💥 撞上柱子！";
    endMsg.textContent = "飞了 " + d + " 米 · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#10161f"; ctx.fillRect(0, 0, W, H);
    // 城市背景
    ctx.fillStyle = "#1c2735";
    for (let i = 0; i < 8; i++) {
      const bh = 60 + ((i * 53) % 120);
      ctx.fillRect(i * 52 - (dist * 2 % 52), H - 24 - bh, 44, bh);
    }
    // 地面
    ctx.fillStyle = "#2f9e4f"; ctx.fillRect(0, GROUND, W, H - GROUND);
    // 柱子
    for (const p of pipes) {
      ctx.fillStyle = "#6f86ac"; ctx.fillRect(p.x - PIPE_W / 2, 0, PIPE_W, p.gapY);
      ctx.fillStyle = "#4a5a7a"; ctx.fillRect(p.x - PIPE_W / 2, p.gapY, PIPE_W, 6);
      ctx.fillStyle = "#6f86ac"; ctx.fillRect(p.x - PIPE_W / 2, p.gapY + p.gapH, PIPE_W, GROUND - p.gapY - p.gapH);
      ctx.fillStyle = "#4a5a7a"; ctx.fillRect(p.x - PIPE_W / 2, p.gapY + p.gapH - 6, PIPE_W, 6);
    }
    // 玩家
    ctx.save();
    ctx.translate(PLYR_X, pY);
    const ang = Math.max(-0.5, Math.min(0.5, vy / 900));
    ctx.rotate(ang);
    ctx.fillStyle = "#e2c266"; ctx.fillRect(-PLYR_W / 2, -PLYR_H / 2, PLYR_W, PLYR_H);
    ctx.fillStyle = "#8a5a33"; ctx.fillRect(-PLYR_W / 2, -PLYR_H / 2, PLYR_W, 6);
    ctx.fillStyle = "#d94b3a"; ctx.beginPath(); ctx.arc(0, -PLYR_H / 2 - 5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 尾焰
    if (holding) {
      ctx.fillStyle = "rgba(255,180,60,0.8)";
      ctx.beginPath(); ctx.moveTo(PLYR_X - 6, pY + PLYR_H / 2); ctx.lineTo(PLYR_X, pY + PLYR_H / 2 + 18); ctx.lineTo(PLYR_X + 6, pY + PLYR_H / 2); ctx.closePath(); ctx.fill();
    }
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
    bestEl.textContent = best; distEl.textContent = 0;
    msgEl.textContent = "按住上升，松开下落。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
    if (e.key === " " || e.code === "Space" || e.key === "ArrowUp") { e.preventDefault(); holding = true; }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === " " || e.code === "Space" || e.key === "ArrowUp") { e.preventDefault(); holding = false; }
  });
  canvas.addEventListener("pointerdown", (e) => { if (e.cancelable) e.preventDefault(); holding = true; }, { passive: false });
  window.addEventListener("pointerup", () => { holding = false; });

  start();
})();
