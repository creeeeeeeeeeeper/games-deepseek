/* ============================================================
   悬浮赛车 · 竞速冒险（单人无尽变道）
   三车道悬浮车，躲障碍，持续加速
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const distEl = document.getElementById("dist");
  const speedEl = document.getElementById("speed");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 360, H = 520;
  canvas.width = W; canvas.height = H;

  const LANES = 3, LANE_W = W / LANES;
  const CAR_W = 40, CAR_H = 26;
  const BEST_KEY = "hover-car-best";

  let lane = 1, carY = H - 120, speed = 260, dist = 0, best = 0, over = false;
  let obstacles = [], roadOff = 0, raf = 0, last = 0, keys = { left: false, right: false };

  function reset() {
    lane = 1; carY = H - 120; speed = 260; dist = 0; over = false; obstacles = []; roadOff = 0;
  }

  function spawn() {
    if (Math.random() < 0.02 * (speed / 260)) {
      const l = (Math.random() * LANES) | 0;
      // 尽量别堵死当前车道
      if (obstacles.length && obstacles[obstacles.length - 1].lane === l && Math.random() < 0.7) return;
      obstacles.push({ lane: l, y: -40 });
    }
  }

  function update(dt) {
    if (over) return;
    speed = Math.min(speed + dt * 12, 640);
    // 变道
    if (keys.left) lane = Math.max(0, lane - 1);
    if (keys.right) lane = Math.min(LANES - 1, lane + 1);
    carY = H - 120;
    roadOff += speed * dt;
    dist += speed * dt / 90;
    distEl.textContent = Math.floor(dist);
    speedEl.textContent = Math.floor(speed);

    for (const o of obstacles) o.y += speed * dt;
    obstacles = obstacles.filter((o) => o.y < H + 40);
    spawn();

    // 碰撞
    const cx = lane * LANE_W + LANE_W / 2;
    for (const o of obstacles) {
      const ox = o.lane * LANE_W + LANE_W / 2;
      if (Math.abs(cx - ox) < CAR_W && Math.abs(carY - o.y) < CAR_H) { crash(); return; }
    }
  }

  function crash() {
    over = true;
    const d = Math.floor(dist);
    best = Math.max(best, d);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = "💥 撞车了！";
    endMsg.textContent = "跑了 " + d + " 米 · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#18121f"; ctx.fillRect(0, 0, W, H);
    // 车道线
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 3;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath(); ctx.moveTo(i * LANE_W, 0); ctx.lineTo(i * LANE_W, H); ctx.stroke();
    }
    // 跑道纹理
    ctx.strokeStyle = "rgba(120,220,255,0.2)"; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 24) {
      const yy = (roadOff * 0.6) % 30;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x, yy + 10); ctx.stroke();
    }
    // 障碍
    for (const o of obstacles) {
      const ox = o.lane * LANE_W + LANE_W / 2;
      ctx.fillStyle = "#d94b3a";
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(ox - 20, o.y - 13, 40, 26, 8) : ctx.rect(ox - 20, o.y - 13, 40, 26); ctx.fill();
      ctx.fillStyle = "#f0a32a"; ctx.fillRect(ox - 6, o.y - 5, 12, 10);
    }
    // 悬浮车
    const cx = lane * LANE_W + LANE_W / 2;
    ctx.shadowColor = "#6fd98a"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#6fd98a";
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - 20, carY - 13, 40, 26, 8) : ctx.rect(cx - 20, carY - 13, 40, 26); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0d2a44"; ctx.fillRect(cx - 12, carY - 8, 24, 16);
    ctx.fillStyle = "#e2c266"; ctx.fillRect(cx - 4, carY - 6, 8, 12);
    // 尾焰
    ctx.fillStyle = "rgba(111,217,138,0.6)";
    ctx.beginPath(); ctx.moveTo(cx - 6, carY - 11); ctx.lineTo(cx - 20, carY); ctx.lineTo(cx - 6, carY + 11); ctx.closePath(); ctx.fill();
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
    bestEl.textContent = best; distEl.textContent = 0; speedEl.textContent = 0;
    msgEl.textContent = "← / → 变道躲车。";
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
